#!/usr/bin/env node
/**
 * Story 1.3 — Step 3: Transform Firestore data + Load into Supabase
 *
 * Pipeline:
 * 1. Read exported JSON files
 * 2. Extract & dedup customers by normalized phone
 * 3. Transform orders to Supabase schema
 * 4. Flatten items[] to order_items
 * 5. Transform settings
 * 6. Load into Supabase in FK dependency order
 * 7. Verify row counts
 *
 * Run: node scripts/migration/03-transform-and-load.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const DATA_DIR = path.resolve(__dirname, 'data');

// ========================================
// 1. READ EXPORTED DATA
// ========================================

function readExport(name) {
  const filePath = path.join(DATA_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ========================================
// 2. PHONE NORMALIZATION
// ========================================

function normalizePhone(phone, countryCode) {
  if (!phone) return null;
  // Convert to string, strip all non-digit characters except leading +
  let p = String(phone).trim();

  // If it starts with +, keep it
  if (p.startsWith('+')) {
    return p.replace(/[^\d+]/g, '');
  }

  // Remove all non-digit
  p = p.replace(/\D/g, '');

  if (!p) return null;

  // Add country prefix if missing
  const prefixes = { PT: '351', ES: '34', DE: '49' };
  const prefix = prefixes[countryCode] || '';

  // If phone starts with country prefix, add +
  if (prefix && p.startsWith(prefix)) {
    return '+' + p;
  }

  // If phone is a local number (doesn't start with country prefix), prepend it
  if (prefix && !p.startsWith(prefix)) {
    return '+' + prefix + p;
  }

  return '+' + p;
}

// ========================================
// 3. CUSTOMER EXTRACTION & DEDUPLICATION
// ========================================

function extractCustomers(orders) {
  const customerMap = new Map(); // normalized phone → customer data
  const ambiguous = [];

  for (const order of orders) {
    const customer = order.customer;
    if (!customer) continue;

    const countryCode = order.countryCode || order._countryCode;
    const phone = normalizePhone(customer.phone, countryCode);
    if (!phone) {
      ambiguous.push({ order: order._id, reason: 'no phone', customer });
      continue;
    }

    const existing = customerMap.get(phone);
    if (existing) {
      // Check if name differs significantly
      if (existing.name.toLowerCase() !== customer.name?.toLowerCase()) {
        // Same phone, different name — flag but keep first occurrence
        ambiguous.push({
          phone,
          existing: existing.name,
          new: customer.name,
          order: order._id,
          reason: 'name_mismatch',
        });
      }
      // Update address if current one is more complete
      if (customer.address && (!existing.address_raw || customer.address.length > existing.address_raw.length)) {
        existing.address_raw = customer.address;
        const parsed = parseAddress(customer.address, countryCode);
        Object.assign(existing, parsed);
      }
    } else {
      const parsed = parseAddress(customer.address, countryCode);
      customerMap.set(phone, {
        id: crypto.randomUUID(),
        name: customer.name || 'Unknown',
        email: null,
        phone,
        address_raw: customer.address,
        address_line1: parsed.address_line1,
        city: parsed.city,
        postal_code: parsed.postal_code,
        country_code: countryCode,
      });
    }
  }

  return {
    customers: Array.from(customerMap.values()),
    phoneToId: new Map(Array.from(customerMap.entries()).map(([phone, c]) => [phone, c.id])),
    ambiguous,
  };
}

function parseAddress(address, countryCode) {
  if (!address) return { address_line1: null, city: null, postal_code: null };

  // Address format: "Street, \nPostal, City\nCountry"
  // or: "Street\nPostal, City\nCountry"
  const lines = address.split('\n').map(l => l.trim()).filter(Boolean);

  let address_line1 = null;
  let city = null;
  let postal_code = null;

  if (lines.length >= 2) {
    address_line1 = lines[0].replace(/,\s*$/, '');

    // Second line usually has "postal, city" or "postal city"
    const secondLine = lines[1].replace(/,\s*$/, '');
    const postalMatch = secondLine.match(/^(\d[\d\-]+)\s*,?\s*(.+)/);
    if (postalMatch) {
      postal_code = postalMatch[1].trim();
      city = postalMatch[2].trim();
    } else {
      city = secondLine;
    }
  } else if (lines.length === 1) {
    address_line1 = lines[0];
  }

  return { address_line1, city, postal_code };
}

// ========================================
// 4. ORDER TRANSFORMATION
// ========================================

function transformOrders(firestoreOrders, phoneToId) {
  const orders = [];
  const orderItems = [];
  const orderIdMap = new Map(); // firestore doc ID → new UUID

  for (const fo of firestoreOrders) {
    const countryCode = fo.countryCode || fo._countryCode;
    const phone = normalizePhone(fo.customer?.phone, countryCode);
    const customerId = phone ? phoneToId.get(phone) : null;

    // Parse Firestore Timestamp
    let shopifyCreatedAt = null;
    if (fo.date?._seconds) {
      shopifyCreatedAt = new Date(fo.date._seconds * 1000).toISOString();
    } else if (fo.date?._type === 'Timestamp') {
      shopifyCreatedAt = new Date(fo.date._seconds * 1000).toISOString();
    } else if (typeof fo.date === 'string') {
      shopifyCreatedAt = fo.date;
    }

    // Map status: "Pending Production" → "open", "Shipped" → "fulfilled"
    let status = 'open';
    let fulfillmentStatus = 'unfulfilled';
    if (fo.status === 'Shipped') {
      status = 'fulfilled';
      fulfillmentStatus = 'fulfilled';
    }

    const orderId = crypto.randomUUID();
    const orderNumber = fo.order?.order_name || fo._id;
    const shopifyOrderId = fo.order?.order_id ? String(fo.order.order_id) : null;

    // Build shipping address JSONB
    const shippingAddress = fo.customer ? {
      name: fo.customer.name,
      address: fo.customer.address,
      phone: String(fo.customer.phone || ''),
    } : null;

    orders.push({
      id: orderId,
      order_number: orderNumber,
      shopify_order_id: shopifyOrderId,
      customer_id: customerId,
      country_code: countryCode,
      status,
      financial_status: 'paid',
      fulfillment_status: fulfillmentStatus,
      total_price: null, // Not in Firestore data
      currency: 'EUR',
      tracking_number: fo.trackingNumber || null,
      shipping_address: shippingAddress ? JSON.stringify(shippingAddress) : null,
      note: fo.note || null,
      shopify_created_at: shopifyCreatedAt,
    });

    orderIdMap.set(fo._id, orderId);

    // Extract items
    if (Array.isArray(fo.items)) {
      for (const item of fo.items) {
        orderItems.push({
          id: crypto.randomUUID(),
          order_id: orderId,
          shopify_line_item_id: item.variantId ? String(item.variantId) : null,
          product_name: item.name || 'Unknown Product',
          variant_name: null,
          quantity: item.quantity || 1,
          unit_price: null,
          total_price: null,
          size: item.size || null,
          customization: item.customization || null,
          version: item.version || null,
          thumbnail_url: item.thumbnailUrl || null,
        });
      }
    }
  }

  return { orders, orderItems, orderIdMap };
}

// ========================================
// 5. SETTINGS TRANSFORMATION
// ========================================

function transformSettings(firestoreSettings) {
  const settings = [];
  for (const doc of firestoreSettings) {
    if (doc._id === 'tracking' && doc.url) {
      settings.push({
        id: crypto.randomUUID(),
        key: 'webhook_url',
        value: JSON.stringify(doc.url),
      });
    }
  }
  return settings;
}

// ========================================
// 6. DATABASE LOADING
// ========================================

async function getClient() {
  const client = new Client({
    host: 'aws-1-eu-north-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.zpjpekjpszqwpnpkczgy',
    password: 'giqxa2-wabpum-xoFxaq',
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function loadCustomers(client, customers) {
  console.log(`Loading ${customers.length} customers...`);
  let loaded = 0;

  for (const c of customers) {
    await client.query(
      `INSERT INTO customers (id, name, email, phone, address_line1, city, postal_code, country_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [c.id, c.name, c.email, c.phone, c.address_line1, c.city, c.postal_code, c.country_code]
    );
    loaded++;
  }
  console.log(`  Loaded: ${loaded} customers`);
  return loaded;
}

async function loadOrders(client, orders) {
  console.log(`Loading ${orders.length} orders...`);
  let loaded = 0;

  for (const o of orders) {
    await client.query(
      `INSERT INTO orders (id, order_number, shopify_order_id, customer_id, country_code, status,
        financial_status, fulfillment_status, total_price, currency, tracking_number,
        shipping_address, note, shopify_created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (shopify_order_id) DO NOTHING`,
      [o.id, o.order_number, o.shopify_order_id, o.customer_id, o.country_code, o.status,
       o.financial_status, o.fulfillment_status, o.total_price, o.currency, o.tracking_number,
       o.shipping_address, o.note, o.shopify_created_at]
    );
    loaded++;
  }
  console.log(`  Loaded: ${loaded} orders`);
  return loaded;
}

async function loadOrderItems(client, items) {
  console.log(`Loading ${items.length} order items...`);
  let loaded = 0;

  for (const i of items) {
    await client.query(
      `INSERT INTO order_items (id, order_id, shopify_line_item_id, product_name, variant_name,
        quantity, unit_price, total_price, size, customization, version, thumbnail_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT DO NOTHING`,
      [i.id, i.order_id, i.shopify_line_item_id, i.product_name, i.variant_name,
       i.quantity, i.unit_price, i.total_price, i.size, i.customization, i.version, i.thumbnail_url]
    );
    loaded++;
  }
  console.log(`  Loaded: ${loaded} order items`);
  return loaded;
}

async function loadSettings(client, settings) {
  console.log(`Loading ${settings.length} settings...`);
  for (const s of settings) {
    await client.query(
      `INSERT INTO settings (id, key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [s.id, s.key, s.value]
    );
  }
  console.log(`  Loaded: ${settings.length} settings`);
}

// ========================================
// 7. VERIFICATION
// ========================================

async function verify(client, expected) {
  console.log('\n=== Verification ===\n');
  const tables = ['countries', 'customers', 'orders', 'order_items', 'settings'];
  const counts = {};
  let allMatch = true;

  for (const table of tables) {
    const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
    counts[table] = parseInt(result.rows[0].count);
    const exp = expected[table] || 'N/A';
    const match = exp === 'N/A' || counts[table] >= exp;
    console.log(`  ${table}: ${counts[table]} rows (expected: ${exp}) ${match ? 'OK' : 'MISMATCH!'}`);
    if (!match) allMatch = false;
  }

  // Spot-check: 5 random orders
  console.log('\nSpot-check (5 random orders):');
  const spotCheck = await client.query(`
    SELECT o.order_number, o.country_code, o.tracking_number, o.shopify_created_at,
           c.name as customer_name, c.phone as customer_phone,
           (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    ORDER BY RANDOM() LIMIT 5
  `);

  for (const row of spotCheck.rows) {
    console.log(`  ${row.order_number} | ${row.country_code} | customer: ${row.customer_name} (${row.customer_phone}) | ${row.item_count} items | tracking: ${row.tracking_number || 'none'}`);
  }

  // Check for orphaned records
  console.log('\nOrphan checks:');
  const orphanedItems = await client.query(`
    SELECT COUNT(*) FROM order_items oi
    WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = oi.order_id)
  `);
  console.log(`  Orphaned order_items: ${orphanedItems.rows[0].count}`);

  const orphanedOrders = await client.query(`
    SELECT COUNT(*) FROM orders o
    WHERE o.customer_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id)
  `);
  console.log(`  Orphaned orders (no customer): ${orphanedOrders.rows[0].count}`);

  const invalidCountry = await client.query(`
    SELECT COUNT(*) FROM orders o
    WHERE NOT EXISTS (SELECT 1 FROM countries c WHERE c.code = o.country_code)
  `);
  console.log(`  Orders with invalid country: ${invalidCountry.rows[0].count}`);

  return { counts, allMatch };
}

// ========================================
// MAIN PIPELINE
// ========================================

async function main() {
  console.log('=== Story 1.3: Data Migration Pipeline ===\n');

  // Step 1: Read exports
  console.log('Step 1: Reading exported data...');
  const firestoreOrders = readExport('orders');
  const firestoreSettings = readExport('settings');
  console.log(`  Orders: ${firestoreOrders.length}, Settings: ${firestoreSettings.length}\n`);

  // Step 2: Extract & dedup customers
  console.log('Step 2: Extracting & deduplicating customers...');
  const { customers, phoneToId, ambiguous } = extractCustomers(firestoreOrders);
  console.log(`  Unique customers: ${customers.length}`);
  console.log(`  Ambiguous matches: ${ambiguous.length}`);
  if (ambiguous.length > 0) {
    const dedupReport = path.join(DATA_DIR, 'dedup-report.json');
    fs.writeFileSync(dedupReport, JSON.stringify(ambiguous, null, 2));
    console.log(`  Dedup report: ${dedupReport}`);
  }

  // Step 3: Transform orders & items
  console.log('\nStep 3: Transforming orders & items...');
  const { orders, orderItems } = transformOrders(firestoreOrders, phoneToId);
  console.log(`  Orders: ${orders.length}, Items: ${orderItems.length}`);

  // Step 4: Transform settings
  console.log('\nStep 4: Transforming settings...');
  const settings = transformSettings(firestoreSettings);
  console.log(`  Settings: ${settings.length}`);

  // Write transformed data
  const transformDir = path.join(DATA_DIR, 'transformed');
  if (!fs.existsSync(transformDir)) fs.mkdirSync(transformDir, { recursive: true });
  fs.writeFileSync(path.join(transformDir, 'customers.json'), JSON.stringify(customers, null, 2));
  fs.writeFileSync(path.join(transformDir, 'orders.json'), JSON.stringify(orders, null, 2));
  fs.writeFileSync(path.join(transformDir, 'order-items.json'), JSON.stringify(orderItems, null, 2));
  fs.writeFileSync(path.join(transformDir, 'settings.json'), JSON.stringify(settings, null, 2));
  console.log(`\nTransformed data written to ${transformDir}`);

  // Step 5: Load into Supabase
  console.log('\n--- Loading into Supabase ---\n');
  const client = await getClient();

  try {
    // Start transaction
    await client.query('BEGIN');

    // Countries already seeded in migration
    const countriesCount = await client.query('SELECT COUNT(*) FROM countries');
    console.log(`Countries (pre-seeded): ${countriesCount.rows[0].count}`);

    // Load in FK dependency order
    await loadCustomers(client, customers);
    await loadOrders(client, orders);
    await loadOrderItems(client, orderItems);
    await loadSettings(client, settings);

    await client.query('COMMIT');
    console.log('\nAll data committed successfully.');

    // Step 6: Verify
    const { counts, allMatch } = await verify(client, {
      countries: 3,
      customers: customers.length,
      orders: orders.length,
      order_items: orderItems.length,
      settings: settings.length,
    });

    console.log(`\n=== Migration ${allMatch ? 'COMPLETE' : 'COMPLETED WITH WARNINGS'} ===`);

    // Write migration report
    const report = {
      completedAt: new Date().toISOString(),
      source: {
        project: process.env.FIREBASE_PROJECT_ID,
        firestoreOrders: firestoreOrders.length,
      },
      transform: {
        uniqueCustomers: customers.length,
        ambiguousMatches: ambiguous.length,
        totalOrders: orders.length,
        totalItems: orderItems.length,
        settings: settings.length,
      },
      supabase: counts,
      verification: { allMatch },
    };

    const reportPath = path.join(DATA_DIR, 'migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport: ${reportPath}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nMigration FAILED — rolled back!');
    throw err;
  } finally {
    await client.end();
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Pipeline error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
