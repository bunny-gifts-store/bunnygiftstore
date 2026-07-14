import { normalizeStatus, statusLabel, ORDER_STATUS_LABELS } from '../orderStatus.js';

// Colored, rounded status badge driven by the shared status vocabulary.
export default function OrderStatusBadge({ status }) {
  const s = normalizeStatus(status);
  return <span className={`status-badge status-${s}`}>{statusLabel(s)}</span>;
}

export { ORDER_STATUS_LABELS };
