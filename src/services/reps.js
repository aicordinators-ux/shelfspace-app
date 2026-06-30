// Reps Service - Manages the list of sales representatives
// Manager can add/edit/delete reps from the app

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

const REPS_COLLECTION = 'reps';

/**
 * Subscribe to reps list in real-time
 */
export function subscribeToReps(callback) {
  const q = query(collection(db, REPS_COLLECTION), orderBy('name'));
  return onSnapshot(
    q,
    (snapshot) => {
      const reps = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(reps);
    },
    (error) => {
      console.error('Error subscribing to reps:', error);
      callback([]);
    }
  );
}

/**
 * Add a new rep
 */
export async function addRep(name) {
  const repId = `rep_${Date.now()}`;
  await setDoc(doc(db, REPS_COLLECTION, repId), {
    id: repId,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  });
  return repId;
}

/**
 * Delete a rep
 */
export async function deleteRep(repId) {
  await deleteDoc(doc(db, REPS_COLLECTION, repId));
}
