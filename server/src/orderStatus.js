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

// Refund lifecycle for cancelled orders. An empty value means "not set yet".
export const REFUND_STATUSES = ['pending', 'successful', 'failed'];

// A UPI / bank UTR (Unique Transaction Reference) is a 12-digit number — the
// reference the payer and payee share for every UPI/IMPS/NEFT payment. It's what
// customers read off their PhonePe receipt and what the admin records for a
// refund, so both the checkout transaction ID and the refund note must match it.
export const UTR_REGEX = /^\d{12}$/;
export const UTR_HELP = 'Enter the 12-digit UTR (Unique Transaction Reference) number.';

export function isValidUtr(value) {
  return UTR_REGEX.test(String(value || '').trim());
}

// A customer may self-cancel only while the order is still in an early state
// (the "Placed" phase — before it is being processed/shipped/delivered).
export const USER_CANCELLABLE_STATUSES = ['pending', 'confirmed'];

// Customer self-cancellation is allowed only within this window after placing.
export const CANCELLATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Elapsed time since an order was placed. SQLite CURRENT_TIMESTAMP is UTC and
// lacks a timezone marker, so normalise it before parsing.
export function orderAgeMs(createdAt) {
  const s = String(createdAt || '');
  if (!s) return Infinity;
  const iso = /[TZ]|[+]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Infinity : Date.now() - t;
}

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

// An empty refund status is allowed (clears the field); otherwise it must be
// one of the known refund states.
export function isValidRefundStatus(value) {
  const v = String(value || '').toLowerCase();
  return v === '' || REFUND_STATUSES.includes(v);
}
