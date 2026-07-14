import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyOrders, apiError } from '../api.js';
import { formatPrice, resolveImage, formatOrderNo } from '../utils.js';
import {
  ORDER_STATUS_FLOW,
  normalizeStatus,
  statusLabel,
  paymentLabel,
  refundLabel,
} from '../orderStatus.js';
import OrderStatusBadge from '../admin/OrderStatusBadge.jsx';

const POLL_MS = 15000; // keep My Orders in sync with admin status changes

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const didLoad = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyOrders();
      setOrders(data);
      setError('');
    } catch (err) {
      setError(apiError(err, 'Could not load your orders.'));
    } finally {
      if (!didLoad.current) { setLoading(false); didLoad.current = true; }
    }
  }, []);

  // Initial load + polling + refresh when the tab regains focus, so an admin
  // status update shows up here automatically without a manual reload.
  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  return (
    <main className="container py-5 my-orders-page">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <h1 className="section-title mb-0">My Orders</h1>
        {orders.length > 0 && <span className="text-muted small">Auto-updates every few seconds</span>}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <p className="text-muted">Loading your orders…</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-5">
          <div style={{ fontSize: '2.5rem' }} aria-hidden="true">📦</div>
          <h5 className="mt-2">You haven't placed any orders yet</h5>
          <p className="text-muted">Once you place an order, you can track its status here.</p>
        </div>
      ) : (
        <div className="my-orders-list">
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </main>
  );
}

function OrderCard({ order: o }) {
  const status = normalizeStatus(o.status);
  const cancelled = status === 'cancelled';
  // A refund is only "confirmed" for the customer once the admin marks it
  // Successful AND records a UTR / transaction number. Until then we don't
  // surface any refund status to the user.
  const refundConfirmed =
    cancelled && o.refundStatus === 'successful' && !!(o.refundNote || '').trim();
  const placed = new Date(o.createdAt);

  return (
    <article className="my-order-card">
      <header className="my-order-head">
        <div className="my-order-headmain">
          <div className="my-order-no">Order {formatOrderNo(o.id)}</div>
          <div className="my-order-date">Placed on {placed.toLocaleDateString()} · {placed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>

        {refundConfirmed && (
          <div className="my-order-refund refund-successful">
            <span className="mor-label">Refund Status</span>
            <span className="mor-sep">:</span>
            <span className="mor-value">{refundLabel(o.refundStatus)}</span>
            <span className="mor-sep">·</span>
            <span className="mor-label">TXN ID</span>
            <span className="mor-sep">:</span>
            <span className="mor-txn">{o.refundNote}</span>
          </div>
        )}

        <div className="my-order-badges">
          <OrderStatusBadge status={status} />
          {/* Once the refund is confirmed (Successful + UTR), the "Paid" chip is dropped. */}
          {!refundConfirmed && (
            <span className={`payment-chip payment-${o.paymentStatus || 'paid'}`}>{paymentLabel(o.paymentStatus)}</span>
          )}
        </div>
      </header>

      {!cancelled && <StatusTracker status={status} />}
      {cancelled && (
        <div className="cancelled-banner" role="status">
          <div className="cancelled-stamp">
            <span className="cancelled-label">CANCELLED</span>
          </div>
          <span className="cancelled-sub">This order has been cancelled.</span>
          {o.cancellationReason && (
            <span className="cancelled-reason"><strong>Reason:</strong> {o.cancellationReason}</span>
          )}
        </div>
      )}

      <div className="my-order-body">
        {Array.isArray(o.items) && o.items.length > 0 && (
          <div className="order-items">
            {o.items.map((it, i) => (
              <div className="order-item-row" key={i}>
                <img className="order-item-thumb" src={resolveImage(it.image)} alt={it.name} loading="lazy" />
                <div className="order-item-info">
                  <span className="order-item-name">{it.name}</span>
                  <span className="order-item-meta">
                    <span className="order-item-code">{it.code}</span>
                    {it.size ? ` · ${it.size}` : ''} · Qty {it.quantity}
                  </span>
                </div>
                <div className="order-item-total">{formatPrice((it.unitPrice || 0) * (it.quantity || 1))}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="my-order-foot">
        <div className="my-order-facts">
          <div><span className="fact-label">Total</span><span className="fact-value">{formatPrice(o.totalAmount)}</span></div>
          <div><span className="fact-label">Payment</span><span className="fact-value">{paymentLabel(o.paymentStatus)}</span></div>
          {cancelled ? (
            <div><span className="fact-label">Delivery</span><span className="fact-value text-muted">Cancelled</span></div>
          ) : (
            <>
              <div><span className="fact-label">Delivery Day</span><span className="fact-value">{o.deliveryDay || 'To be scheduled'}</span></div>
              <div><span className="fact-label">Delivery Date</span><span className="fact-value">{formatDeliveryDate(o.deliveryDate)}</span></div>
            </>
          )}
        </div>
        <div className="my-order-ship">
          <span className="fact-label">Deliver to</span>
          {refundConfirmed ? (
            <span className="fact-value back-to-store">Back to Store</span>
          ) : (
            <span className="fact-value">{o.address}, {o.city}, {o.state} - {o.pincode}</span>
          )}
        </div>
      </footer>
    </article>
  );
}

// Horizontal progress track through the fulfilment flow.
function StatusTracker({ status }) {
  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);
  return (
    <ol className="status-tracker" aria-label="Order progress">
      {ORDER_STATUS_FLOW.map((s, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
        return (
          <li key={s} className={`tracker-step tracker-${state}`}>
            <span className="tracker-dot" aria-hidden="true">{i < currentIndex ? '✓' : i + 1}</span>
            <span className="tracker-label">{statusLabel(s)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function formatDeliveryDate(date) {
  if (!date) return 'To be scheduled';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
