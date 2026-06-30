// Optional: Migration script to push CUSTOMERS_DATA to Firestore
// Run only if you want to switch from "customers in code" to "customers in database"
//
// Usage:
//   1. Make sure .env has Firebase credentials
//   2. Run: npm run migrate
//
// This is OPTIONAL. Currently, customers are bundled with the app (faster, simpler).
// Use this only if you want managers to add/edit customers from the UI in the future.

import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, writeBatch, collection } from 'firebase/firestore';
import 'dotenv/config';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error('❌ Missing Firebase credentials in .env');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Read customers data (we use eval since the file uses ES module export)
const customersFile = readFileSync('./src/data/customers.js', 'utf-8');
const match = customersFile.match(/export const CUSTOMERS_DATA = (\[[\s\S]*\]);/);
if (!match) {
  console.error('❌ Could not parse customers.js');
  process.exit(1);
}
const CUSTOMERS_DATA = JSON.parse(match[1]);

console.log(`📦 Loaded ${CUSTOMERS_DATA.length} customer records`);

// Group by unique customer (code + name + address)
const grouped = new Map();
CUSTOMERS_DATA.forEach((c) => {
  const key = [c.code, c.acc_code, c.name, c.address].join('|');
  if (!grouped.has(key)) {
    grouped.set(key, { ...c, contracts: [] });
  }
  grouped.get(key).contracts.push({
    source: c.source,
    categories: c.categories,
  });
});

const uniqueCustomers = Array.from(grouped.values());
console.log(`📊 ${uniqueCustomers.length} unique customers (after dedup)`);

// Upload in batches of 500 (Firestore limit)
async function migrate() {
  const BATCH_SIZE = 500;
  let uploaded = 0;

  for (let i = 0; i < uniqueCustomers.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const slice = uniqueCustomers.slice(i, i + BATCH_SIZE);

    slice.forEach((customer, idx) => {
      const docId = `customer_${i + idx}_${customer.code || 'nocode'}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      batch.set(doc(db, 'customers', docId), customer);
    });

    await batch.commit();
    uploaded += slice.length;
    console.log(`✓ Uploaded ${uploaded}/${uniqueCustomers.length}`);
  }

  console.log('✅ Migration complete!');
  process.exit(0);
}

migrate().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
