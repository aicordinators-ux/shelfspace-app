// Visits Service - Handles all Firestore operations for visits

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const VISITS_COLLECTION = 'visits';

/**
 * Subscribe to all visits in real-time
 * @param {Function} callback - Called with array of visits whenever data changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToVisits(callback) {
  const q = query(collection(db, VISITS_COLLECTION), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const visits = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore Timestamp to ISO string for compatibility
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp,
      }));
      callback(visits);
    },
    (error) => {
      console.error('Error subscribing to visits:', error);
      callback([]);
    }
  );
}

/**
 * Save a visit (create or update)
 * @param {Object} visit - Visit data
 * @returns {Promise<string>} The visit ID
 */
export async function saveVisit(visit) {
  const visitId = String(visit.id || Date.now());
  const visitRef = doc(db, VISITS_COLLECTION, visitId);

  // Strip undefined fields (Firestore doesn't accept them)
  const cleanData = JSON.parse(JSON.stringify({
    ...visit,
    id: visitId,
    timestamp: serverTimestamp(),
  }));

  await setDoc(visitRef, cleanData);
  return visitId;
}

/**
 * Delete a visit
 * @param {string} visitId
 */
export async function deleteVisit(visitId) {
  await deleteDoc(doc(db, VISITS_COLLECTION, String(visitId)));
}

/**
 * One-time fetch all visits (for export, etc.)
 * @returns {Promise<Array>}
 */
export async function fetchAllVisits() {
  const q = query(collection(db, VISITS_COLLECTION), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp,
  }));
}
