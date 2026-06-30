// Simple Role-Based Auth Service (No Firebase Auth)
// Uses localStorage to remember the user's role and identity

const SESSION_KEY = 'shelfspace_session_v1';

// IMPORTANT: Change this PIN after first deployment!
// This is the manager PIN. The PIN is in the frontend code,
// so it's not 100% secure - it's a simple gate for non-technical users.
//
// To change the PIN: change this value, rebuild, and redeploy.
export const MANAGER_PIN = '2024';

/**
 * Get current session from localStorage
 * @returns {Object|null} { role: 'rep'|'manager', name: string }
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save session to localStorage
 */
export function setSession(session) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

/**
 * Login as manager (verify PIN)
 */
export function loginAsManager(pin, name = 'مشرف') {
  if (String(pin).trim() !== MANAGER_PIN) {
    return { success: false, error: 'PIN غير صحيح' };
  }
  const session = { role: 'manager', name: name.trim() || 'مشرف' };
  setSession(session);
  return { success: true, session };
}

/**
 * Login as rep (just by name)
 */
export function loginAsRep(name) {
  if (!name || !name.trim()) {
    return { success: false, error: 'اختر اسم المنسق' };
  }
  const session = { role: 'rep', name: name.trim() };
  setSession(session);
  return { success: true, session };
}

/**
 * Logout
 */
export function logout() {
  setSession(null);
}

/**
 * Check if current session can edit a specific visit
 */
export function canEditVisit(session, visit) {
  if (!session) return false;
  if (session.role === 'manager') return true;
  // Rep can only edit their own visits
  return visit?.savedBy?.name === session.name;
}
