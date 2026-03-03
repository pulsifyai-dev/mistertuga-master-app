#!/usr/bin/env node
/**
 * Story 1.3 — Step 1b: Explore orders subcollection structure
 * Run: node scripts/migration/01b-explore-orders.js
 */

const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}, 'orders-explorer');

const db = getFirestore(app);

async function explore() {
  console.log('=== Orders Structure Exploration ===\n');

  // 1. Find all country documents under orders/
  const ordersRef = db.collection('orders');
  const countriesSnap = await ordersRef.listDocuments();
  console.log(`Country documents under orders/: ${countriesSnap.length}`);

  for (const countryDoc of countriesSnap) {
    console.log(`\n--- Country: ${countryDoc.id} ---`);

    // Check if the country doc has fields
    const docSnap = await countryDoc.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && Object.keys(data).length > 0) {
        console.log(`  Document fields: ${JSON.stringify(data)}`);
      } else {
        console.log('  (empty document — container only)');
      }
    } else {
      console.log('  (no document data — subcollection container)');
    }

    // Count orders in this country
    const ordersSnap = await countryDoc.collection('orders').get();
    console.log(`  Orders count: ${ordersSnap.size}`);

    // Show first 2 orders as samples
    const sampleDocs = ordersSnap.docs.slice(0, 2);
    for (const orderDoc of sampleDocs) {
      const data = orderDoc.data();
      console.log(`\n  Sample Order: ${orderDoc.id}`);
      console.log(`  Fields: ${Object.keys(data).join(', ')}`);

      // Show full structure for first sample
      for (const [key, value] of Object.entries(data)) {
        if (key === 'customer' && typeof value === 'object') {
          console.log(`    customer: ${JSON.stringify(value)}`);
        } else if (key === 'items' && Array.isArray(value)) {
          console.log(`    items: [${value.length} items]`);
          if (value.length > 0) {
            console.log(`      Sample item: ${JSON.stringify(value[0])}`);
          }
        } else if (key === 'date' && value?._seconds) {
          console.log(`    date: (Timestamp) ${new Date(value._seconds * 1000).toISOString()}`);
        } else {
          const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
          console.log(`    ${key}: (${typeof value}) ${str.substring(0, 100)}`);
        }
      }
    }
  }

  // 2. Check unique status values
  console.log('\n\n=== Status Values ===');
  const allOrders = await db.collectionGroup('orders').get();
  const statuses = new Map();
  const dateTypes = new Map();
  const fieldNames = new Set();

  for (const doc of allOrders.docs) {
    const data = doc.data();

    // Collect all field names
    Object.keys(data).forEach(k => fieldNames.add(k));

    // Status counts
    const status = data.status || '(none)';
    statuses.set(status, (statuses.get(status) || 0) + 1);

    // Date types
    const dateType = data.date?._seconds ? 'Timestamp' : typeof data.date;
    dateTypes.set(dateType, (dateTypes.get(dateType) || 0) + 1);
  }

  console.log('\nAll field names across orders:');
  console.log([...fieldNames].sort().join(', '));

  console.log('\nStatus distribution:');
  for (const [status, count] of statuses) {
    console.log(`  ${status}: ${count}`);
  }

  console.log('\nDate field types:');
  for (const [type, count] of dateTypes) {
    console.log(`  ${type}: ${count}`);
  }

  // 3. Check customer field variations
  console.log('\n\n=== Customer Field Analysis ===');
  let customersWithPhone = 0;
  let customersWithoutPhone = 0;
  let phoneTypes = new Map();
  let customerFields = new Set();

  for (const doc of allOrders.docs) {
    const customer = doc.data().customer;
    if (customer) {
      Object.keys(customer).forEach(k => customerFields.add(k));
      if (customer.phone) {
        customersWithPhone++;
        const pt = typeof customer.phone;
        phoneTypes.set(pt, (phoneTypes.get(pt) || 0) + 1);
      } else {
        customersWithoutPhone++;
      }
    }
  }

  console.log(`Customer fields: ${[...customerFields].join(', ')}`);
  console.log(`With phone: ${customersWithPhone}, Without: ${customersWithoutPhone}`);
  console.log('Phone field types:');
  for (const [type, count] of phoneTypes) {
    console.log(`  ${type}: ${count}`);
  }

  // 4. Metrics/profit-stats structure
  console.log('\n\n=== Metrics Collection ===');
  const metricsSnap = await db.collection('metrics').get();
  for (const doc of metricsSnap.docs) {
    const data = doc.data();
    console.log(`Document: ${doc.id}`);
    console.log(`  Fields: ${Object.keys(data).join(', ')}`);
    if (data.expenses) {
      console.log(`  Expense categories: ${Object.keys(data.expenses).join(', ')}`);
    }
    if (data.dailyNetProfit) {
      console.log(`  Daily data points: ${data.dailyNetProfit.length}`);
      console.log(`  Date range: ${data.dailyNetProfit[0]?.date} to ${data.dailyNetProfit[data.dailyNetProfit.length - 1]?.date}`);
    }
  }

  console.log('\n=== Exploration Complete ===');
  process.exit(0);
}

explore().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
