// Shared order-status vocabulary for the storefront (My Orders) and the admin
// panel, so labels/colours/order never drift between the two surfaces.

// The linear fulfilment flow, in order. `cancelled` is a terminal side-state
// and is intentionally not part of the progress track.
export const ORDER_STATUS_FLOW = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'out_for_delivery',
  'delivered',
];

// Options an admin can set (flow + cancelled).
export const ORDER_STATUS_OPTIONS = [...ORDER_STATUS_FLOW, 'cancelled'];

export const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  packed: 'Packed',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  // Legacy 3-state values (older orders) map onto the new lifecycle.
  received: 'Pending',
  shipped: 'Out for Delivery',
};

const LEGACY = { received: 'pending', shipped: 'out_for_delivery' };

// Normalise any stored value to a canonical status key.
export function normalizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (LEGACY[s]) return LEGACY[s];
  return ORDER_STATUS_LABELS[s] ? s : 'pending';
}

export function statusLabel(status) {
  return ORDER_STATUS_LABELS[normalizeStatus(status)];
}

export const PAYMENT_STATUS_LABELS = {
  paid: 'Paid',
  pending: 'Payment Pending',
  failed: 'Payment Failed',
  refunded: 'Refunded',
};

export function paymentLabel(status) {
  return PAYMENT_STATUS_LABELS[String(status || '').toLowerCase()] || 'Paid';
}
