const LABELS = {
  received: 'Order Received',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

// Colored, rounded status badge. received=theme, shipped=yellow, delivered=green.
export default function OrderStatusBadge({ status }) {
  const s = LABELS[status] ? status : 'received';
  return <span className={`status-badge status-${s}`}>{LABELS[s]}</span>;
}

export const ORDER_STATUS_LABELS = LABELS;
