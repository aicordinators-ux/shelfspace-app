// Visits Service - Handles all Firestore operations for visits

import {
  collection,
  doc,
  getDoc,
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

// Convert any timestamp shape (Firestore Timestamp / ISO string / seconds object / null)
// into a stable ISO string. Returns '' when no usable date is present.
function normalizeTimestamp(ts) {
  if (!ts) return '';
  // Firestore Timestamp object
  if (typeof ts.toDate === 'function') {
    try {
      const d = ts.toDate();
      return isNaN(d.getTime()) ? '' : d.toISOString();
    } catch { return ''; }
  }
  // Raw timestamp object {seconds, nanoseconds}
  if (typeof ts === 'object' && typeof ts.seconds === 'number') {
    const d = new Date(ts.seconds * 1000);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  // Already a string or a Date
  if (typeof ts === 'string' || ts instanceof Date) {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  return '';
}

function shapeVisit(docSnap) {
  const data = docSnap.data() || {};
  // Prefer the server timestamp; fall back to clientTimestamp if server one
  // hasn't been resolved yet (this avoids "Invalid Date" right after save).
  const ts = normalizeTimestamp(data.timestamp) || normalizeTimestamp(data.clientTimestamp);
  return {
    id: docSnap.id,
    ...data,
    timestamp: ts,
    lastEditedAt: normalizeTimestamp(data.lastEditedAt),
  };
}

/**
 * Subscribe to all visits in real-time
 */
export function subscribeToVisits(callback) {
  const q = query(collection(db, VISITS_COLLECTION), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map(shapeVisit)),
    (error) => {
      console.error('Error subscribing to visits:', error);
      callback([]);
    }
  );
}

/**
 * Save a visit (create or update).
 * - On create: sets timestamp + clientTimestamp + savedBy
 * - On update: sets lastEditedAt + lastEditedBy (preserves original timestamp/savedBy)
 */
export async function saveVisit(visit) {
  const visitId = String(visit.id || Date.now());
  const visitRef = doc(db, VISITS_COLLECTION, visitId);

  // Check if a doc already exists at this id (so we can preserve original timestamp/savedBy)
  let isUpdate = false;
  let originalCreatedAt = null;
  let originalSavedBy = null;
  let originalClientTimestamp = null;
  try {
    const existing = await getDoc(visitRef);
    if (existing.exists()) {
      isUpdate = true;
      const existingData = existing.data();
      originalCreatedAt = existingData.timestamp || null;
      originalSavedBy = existingData.savedBy || null;
      originalClientTimestamp = existingData.clientTimestamp || null;
    }
  } catch (e) {
    console.warn('Could not check for existing visit:', e);
  }

  // Strip undefined fields and Date objects via JSON serialize.
  // This produces a clean primitive-only object Firestore accepts.
  const cleanData = JSON.parse(JSON.stringify(visit));

  // Always set/refresh the id and clientTimestamp
  cleanData.id = visitId;
  // ISO string from the client - works even if serverTimestamp() takes a moment
  // and serves as a reliable fallback for Excel/UI display.
  cleanData.clientTimestamp = new Date().toISOString();

  if (isUpdate) {
    // UPDATE: preserve original creation time and original author
    if (originalCreatedAt) cleanData.timestamp = originalCreatedAt;
    if (originalClientTimestamp) cleanData.clientTimestamp = originalClientTimestamp;
    if (originalSavedBy) cleanData.savedBy = originalSavedBy;
    // Track who edited and when
    cleanData.lastEditedAt = serverTimestamp();
    cleanData.lastEditedAtClient = new Date().toISOString();
    cleanData.lastEditedBy = visit.savedBy || originalSavedBy || null;
  } else {
    // CREATE: set both server and client timestamps
    cleanData.timestamp = serverTimestamp();
  }

  // Strip any remaining undefined / null edit fields if not used
  Object.keys(cleanData).forEach((k) => {
    if (cleanData[k] === undefined) delete cleanData[k];
  });

  await setDoc(visitRef, cleanData);
  return visitId;
}

/**
 * Delete a visit
 */
export async function deleteVisit(visitId) {
  await deleteDoc(doc(db, VISITS_COLLECTION, String(visitId)));
}

/**
 * One-time fetch all visits (for export, etc.)
 */
export async function fetchAllVisits() {
  const q = query(collection(db, VISITS_COLLECTION), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(shapeVisit);
}
