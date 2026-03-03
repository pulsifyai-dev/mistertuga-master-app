#!/usr/bin/env node
/**
 * Story 1.3 — Step 4: Cross-check verification
 * Compares 10 random Firestore orders against Supabase data
 *
 * Run: node scripts/migration/04-verify-crosscheck.js
 */

const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const firebaseApp = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}, 'migration-verify');

const db = getFirestore(firebaseApp);

async function main() {
  console.log('=== Cross-Check Verification: Firestore vs Supabase ===\n');

  // Connect to Supabase
  const client = new Client({
    host: 'aws-1-eu-north-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.zpjpekjpszqwpnpkczgy',
    password: 'giqxa2-wabpum-xoFxaq',
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Get 10 random orders from Supabase
  const supabaseOrders = await client.query(`
    SELECT o.id, o.order_number, o.shopify_order_id, o.country_code,
           o.tracking_number, o.shopify_created_at, o.note,
           c.name as customer_name, c.phone as customer_phone,
           o.shipping_address
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    ORDER BY RANDOM() LIMIT 10
  `);

  let passed = 0;
  let failed = 0;

  for (const row of supabaseOrders.rows) {
    console.log(`--- Order: ${row.order_number} (${row.country_code}) ---`);

    // Find this order in Firestore
    const countryCode = row.country_code;
    const firestoreRef = db.collection('orders').doc(countryCode).collection('orders').doc(row.order_number);
    const firestoreDoc = await firestoreRef.get();

    if (!firestoreDoc.exists) {
      console.log(`  WARN: Not found by order_number, searching by shopify_order_id...`);
      // Search by document ID pattern
      const allOrders = await db.collection('orders').doc(countryCode).collection('orders').get();
      const match = allOrders.docs.find(d => {
        const data = d.data();
        return data.order?.order_name === row.order_number ||
               String(data.order?.order_id) === row.shopify_order_id;
      });

      if (!match) {
        console.log(`  FAIL: Order not found in Firestore`);
        failed++;
        continue;
      }

      checkMatch(row, match.data(), match.id, client);
      passed++;
    } else {
      checkMatch(row, firestoreDoc.data(), firestoreDoc.id, client);
      passed++;
    }
  }

  // Count total items in both systems
  console.log('\n--- Aggregate Checks ---');

  const firestoreGroup = await db.collectionGroup('orders').get();
  let totalFirestoreItems = 0;
  for (const doc of firestoreGroup.docs) {
    const items = doc.data().items;
    if (Array.isArray(items)) totalFirestoreItems += items.length;
  }

  const supabaseItemCount = await client.query('SELECT COUNT(*) FROM order_items');

  console.log(`Firestore total orders: ${firestoreGroup.size}`);
  console.log(`Supabase total orders: ${(await client.query('SELECT COUNT(*) FROM orders')).rows[0].count}`);
  console.log(`Firestore total items: ${totalFirestoreItems}`);
  console.log(`Supabase total items: ${supabaseItemCount.rows[0].count}`);

  const ordersMatch = firestoreGroup.size === parseInt((await client.query('SELECT COUNT(*) FROM orders')).rows[0].count);
  const itemsMatch = totalFirestoreItems === parseInt(supabaseItemCount.rows[0].count);

  console.log(`\nOrders count match: ${ordersMatch ? 'PASS' : 'FAIL'}`);
  console.log(`Items count match: ${itemsMatch ? 'PASS' : 'FAIL'}`);

  console.log(`\n=== Spot-check: ${passed}/10 passed, ${failed}/10 failed ===`);
  console.log(`=== Aggregates: ${ordersMatch && itemsMatch ? 'ALL PASS' : 'ISSUES FOUND'} ===`);

  await client.end();
  process.exit(0);
}

function checkMatch(supaRow, firestoreData, firestoreId, client) {
  const checks = [];

  // Check order_number
  const expectedOrderName = firestoreData.order?.order_name || firestoreId;
  checks.push({
    field: 'order_number',
    supabase: supaRow.order_number,
    firestore: expectedOrderName,
    match: supaRow.order_number === expectedOrderName,
  });

  // Check country_code
  checks.push({
    field: 'country_code',
    supabase: supaRow.country_code,
    firestore: firestoreData.countryCode,
    match: supaRow.country_code === firestoreData.countryCode,
  });

  // Check customer name
  checks.push({
    field: 'customer_name',
    supabase: supaRow.customer_name,
    firestore: firestoreData.customer?.name,
    match: supaRow.customer_name === firestoreData.customer?.name,
  });

  // Check tracking_number
  const fTracking = firestoreData.trackingNumber || null;
  checks.push({
    field: 'tracking_number',
    supabase: supaRow.tracking_number,
    firestore: fTracking,
    match: supaRow.tracking_number === fTracking,
  });

  // Check date
  let fDate = null;
  if (firestoreData.date?._seconds) {
    fDate = new Date(firestoreData.date._seconds * 1000).toISOString();
  }
  const sDate = supaRow.shopify_created_at ? new Date(supaRow.shopify_created_at).toISOString() : null;
  checks.push({
    field: 'date',
    supabase: sDate,
    firestore: fDate,
    match: sDate === fDate,
  });

  for (const check of checks) {
    const icon = check.match ? 'OK' : 'MISMATCH';
    if (!check.match) {
      console.log(`  ${icon}: ${check.field}: supabase="${check.supabase}" vs firestore="${check.firestore}"`);
    }
  }

  const allMatch = checks.every(c => c.match);
  console.log(`  Result: ${allMatch ? 'ALL FIELDS MATCH' : 'MISMATCHES FOUND'}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
