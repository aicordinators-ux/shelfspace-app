// Incomplete visit reasons
// Used when a rep visits a customer but cannot record measurements
// (closed, refused contract, delayed, etc.)
//
// These visits ARE saved (so manager knows the rep visited) and show up in the
// visits log, the customer tracker and the Excel export (with their reason), but:
// - Don't count toward achievement %
// - Don't appear in dashboard stats
// - Don't count as coverage in the customer tracker

export const INCOMPLETE_REASONS = [
  { id: 'refused', label: 'رافض التنسيق' },
  { id: 'closed', label: 'مغلق نهائياً' },
  { id: 'delayed', label: 'تأجيل الزيارة' },
  { id: 'other', label: 'سبب آخر' },
];

export function getReasonLabel(id) {
  return INCOMPLETE_REASONS.find((r) => r.id === id)?.label || id || '';
}
