// Canonical order lifecycle, shared by the order + admin routes.
// Kept in one place so validation and normalization never drift.

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

export const PAYMENT_STATUSES = ['paid', 'pending', 'failed', 'refunded'];

// Older databases used a 3-state model; map those to the new lifecycle so
// existing orders keep displaying (and tracking) correctly.
const LEGACY_STATUS = { received: 'pending', shipped: 'out_for_delivery' };

export function normalizeStatus(value) {
  const v = String(value || '').toLowerCase();
  if (LEGACY_STATUS[v]) return LEGACY_STATUS[v];
  return ORDER_STATUSES.includes(v) ? v : 'pending';
}

export function isValidStatus(value) {
  return ORDER_STATUSES.includes(String(value || '').toLowerCase());
}

export function isValidPaymentStatus(value) {
  return PAYMENT_STATUSES.includes(String(value || '').toLowerCase());
}
