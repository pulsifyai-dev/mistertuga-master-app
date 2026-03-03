#!/usr/bin/env node
/**
 * Story 1.3 — Step 2: Export ALL Firestore data to JSON
 * Exports: orders (all countries), users, settings, metrics
 * Output: scripts/migration/data/*.json
 *
 * Run: node scripts/migration/02-export-firestore.js
 */

const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}, 'migration-export');

const db = getFirestore(app);
const DATA_DIR = path.resolve(__dirname, 'data');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function serializeDoc(doc) {
  const data = doc.data();
  const result = { _id: doc.id, _path: doc.ref.path };

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && '_seconds' in value) {
      result[key] = { _type: 'Timestamp', _seconds: value._seconds, _nanoseconds: value._nanoseconds };
    } else {
      result[key] = value;
    }
  }

  return result;
}

async function exportOrders() {
  console.log('Exporting orders...');
  const orders = [];
  const countryDocs = await db.collection('orders').listDocuments();

  for (const countryDoc of countryDocs) {
    const countryCode = countryDoc.id;
    const ordersSnap = await countryDoc.collection('orders').get();
    console.log(`  ${countryCode}: ${ordersSnap.size} orders`);

    for (const doc of ordersSnap.docs) {
      const serialized = serializeDoc(doc);
      serialized._countryCode = countryCode;
      orders.push(serialized);
    }
  }

  // Also export via collectionGroup as cross-check
  const groupSnap = await db.collectionGroup('orders').get();
  console.log(`  collectionGroup cross-check: ${groupSnap.size} orders`);

  if (orders.length !== groupSnap.size) {
    console.warn(`  WARNING: Subcollection count (${orders.length}) differs from collectionGroup (${groupSnap.size})!`);
  }

  return orders;
}

async function exportCollection(name) {
  console.log(`Exporting ${name}...`);
  const snap = await db.collection(name).get();
  const docs = snap.docs.map(serializeDoc);
  console.log(`  ${docs.length} documents`);
  return docs;
}

async function main() {
  ensureDir(DATA_DIR);

  console.log('=== Firestore Export ===\n');
  console.log(`Project: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`Output: ${DATA_DIR}\n`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Export all collections
  const orders = await exportOrders();
  const users = await exportCollection('users');
  const settings = await exportCollection('settings');
  const metrics = await exportCollection('metrics');
  const profitStats = await exportCollection('profit-stats');

  // Write to JSON files
  const exports = {
    orders,
    users,
    settings,
    metrics,
    'profit-stats': profitStats,
  };

  for (const [name, data] of Object.entries(exports)) {
    const filePath = path.join(DATA_DIR, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`\nWritten: ${filePath} (${data.length} records)`);
  }

  // Write export manifest
  const manifest = {
    exportedAt: new Date().toISOString(),
    project: process.env.FIREBASE_PROJECT_ID,
    collections: Object.entries(exports).map(([name, data]) => ({
      name,
      count: data.length,
      file: `${name}.json`,
    })),
    totalRecords: Object.values(exports).reduce((sum, d) => sum + d.length, 0),
  };

  const manifestPath = path.join(DATA_DIR, 'export-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${manifestPath}`);

  console.log('\n=== Export Complete ===');
  console.log(`Total: ${manifest.totalRecords} records across ${manifest.collections.length} collections`);
  process.exit(0);
}

main().catch(err => {
  console.error('Export error:', err.message);
  process.exit(1);
});
