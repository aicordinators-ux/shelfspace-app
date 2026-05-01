// Firebase Configuration for shelfspace-app project
//
// SECURITY NOTE: It's safe to commit these keys to GitHub.
// Real security comes from Firestore Security Rules (see firestore.rules file).
//
// For production deployment via GitHub Actions, these values are also
// available as environment variables (see .github/workflows/deploy.yml)

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC1loKsFHmUNOQE4ERxoQ1qNN2ifIrgreM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "shelfspace-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "shelfspace-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "shelfspace-app.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "462741596417",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:462741596417:web:1329ced224a8434cce1300",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;
