#!/usr/bin/env node
/**
 * Story 1.3 — Step 1: Explore Firestore data structure
 * Lists all top-level collections, document counts, and sample documents.
 * Run: node scripts/migration/01-explore-firestore.js
 */

const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Load .env.local
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}, 'migration-explorer');

const db = getFirestore(app);

async function explore() {
  console.log('=== Firestore Data Exploration ===\n');
  console.log(`Project: ${process.env.FIREBASE_PROJECT_ID}\n`);

  // 1. List all top-level collections
  const collections = await db.listCollections();
  console.log(`Top-level collections (${collections.length}):`);
  for (const col of collections) {
    console.log(`  - ${col.id}`);
  }
  console.log();

  // 2. For each top-level collection, count docs and show structure
  for (const col of collections) {
    const snapshot = await col.get();
    console.log(`\n--- Collection: ${col.id} (${snapshot.size} documents) ---`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      console.log(`\n  Document: ${doc.id}`);
      console.log(`  Fields: ${Object.keys(data).join(', ')}`);

      // Show first-level field types and sample values
      for (const [key, value] of Object.entries(data)) {
        const type = getType(value);
        const preview = getPreview(value);
        console.log(`    ${key}: (${type}) ${preview}`);
      }

      // Check for subcollections
      const subcols = await doc.ref.listCollections();
      if (subcols.length > 0) {
        console.log(`  Subcollections: ${subcols.map(s => s.id).join(', ')}`);

        for (const subcol of subcols) {
          const subSnap = await subcol.get();
          console.log(`    ${subcol.id}: ${subSnap.size} documents`);

          // Show first doc as sample
          if (subSnap.size > 0) {
            const sampleDoc = subSnap.docs[0];
            const sampleData = sampleDoc.data();
            console.log(`    Sample doc (${sampleDoc.id}):`);
            for (const [key, value] of Object.entries(sampleData)) {
              const type = getType(value);
              const preview = getPreview(value);
              console.log(`      ${key}: (${type}) ${preview}`);
            }
          }
        }
      }
    }
  }

  // 3. Also check collectionGroup('orders') count
  console.log('\n\n--- CollectionGroup: orders ---');
  const ordersGroup = await db.collectionGroup('orders').get();
  console.log(`Total orders across all countries: ${ordersGroup.size}`);

  console.log('\n=== Exploration Complete ===');
  process.exit(0);
}

function getType(value) {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return 'Date';
  if (value._seconds !== undefined) return 'Timestamp';
  if (Array.isArray(value)) return `Array[${value.length}]`;
  if (typeof value === 'object') return 'Object';
  return typeof value;
}

function getPreview(value, maxLen = 80) {
  if (value === null || value === undefined) return 'null';
  if (value._seconds !== undefined) {
    return new Date(value._seconds * 1000).toISOString();
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const first = JSON.stringify(value[0]);
    return `[${first.substring(0, maxLen)}${first.length > maxLen ? '...' : ''}, ...]`;
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.substring(0, maxLen) + (str.length > maxLen ? '...' : '');
  }
  const str = String(value);
  return str.substring(0, maxLen) + (str.length > maxLen ? '...' : '');
}

explore().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
