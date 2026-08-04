// Time-range options shared by the follow-up card and the visits log, so the
// two screens always offer the same windows.
// `days` = how many days back (including today) count as "in range";
// null means no time limit.
export const PERIODS = [
  { value: 'today', label: 'اليوم', days: 1 },
  { value: '7d', label: 'آخر 7 أيام', days: 7 },
  { value: '10d', label: 'آخر 10 أيام', days: 10 },
  { value: '30d', label: 'آخر 30 يوم', days: 30 },
  { value: 'all', label: 'كل الوقت', days: null },
];

// Start of the period as a millisecond timestamp (local time).
// Returns null for "all time".
export function periodStart(period) {
  const opt = PERIODS.find((p) => p.value === period);
  if (!opt || opt.days == null) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (opt.days - 1));
  return d.getTime();
}

export function periodLabel(period) {
  return PERIODS.find((p) => p.value === period)?.label || '';
}

// Visits carry an ISO string timestamp (normalized in services/visits.js).
export function visitTime(v) {
  const raw = v.timestamp || v.clientTimestamp;
  if (!raw) return NaN;
  const t = new Date(raw).getTime();
  return isNaN(t) ? NaN : t;
}
