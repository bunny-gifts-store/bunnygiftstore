import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyOrders, cancelMyOrder, apiError } from '../api.js';
import { STORE_WHATSAPP, STORE_WHATSAPP_INTL } from '../config.js';
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

// Customer self-cancellation is allowed only within 1 hour, and only while the
// order is still in an early ("Placed") state. The server enforces both.
const CANCEL_WINDOW_MS = 60 * 60 * 1000;
const USER_CANCELLABLE = ['pending', 'confirmed'];
const CANCEL_REASONS = [
  'Ordered by mistake',
  'Want to change the design / customization',
  'Found a better option',
  'Delivery is taking too long',
  'No longer needed',
];

// SQLite CURRENT_TIMESTAMP is UTC with no timezone marker; normalise so the
// browser doesn't misread it as local time.
function parseServerDate(value) {
  if (!value) return null;
  const s = String(value);
  const iso = /[TZ]|[+]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const didLoad = useRef(false);

  // Merge a single updated order back into the list (used after a cancellation)
  // and optionally flash a success message.
  const handleUpdated = useCallback((updated, message) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    if (message) {
      setNotice(message);
      setTimeout(() => setNotice(''), 6000);
    }
  }, []);

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
    window.addEventListener('bunny:order-placed', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('bunny:order-placed', load);
    };
  }, [load]);

  return (
    <main className="container py-5 my-orders-page">
      <div className="my-orders-head d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <h1 className="my-orders-title mb-0"><span className="mot-icon" aria-hidden="true">🎁</span>My Orders</h1>
        {orders.length > 0 && <span className="text-muted small">Auto-updates every few seconds</span>}
      </div>

      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="my-orders-empty"><p className="text-muted">Loading your orders…</p></div>
      ) : orders.length === 0 ? (
        <div className="my-orders-empty">
          <div className="my-orders-empty-icon" aria-hidden="true">📦</div>
          <h5 className="my-orders-empty-title">You haven't placed any orders yet</h5>
          <p className="my-orders-empty-text">Once you place an order, you can track its status here.</p>
          <Link to="/all-gifts" className="my-orders-empty-btn">🛍️ Start shopping</Link>
        </div>
      ) : (
        <div className="my-orders-list">
          {orders.map((o) => <OrderCard key={o.id} order={o} onUpdated={handleUpdated} />)}
        </div>
      )}
    </main>
  );
}

function OrderCard({ order: o, onUpdated }) {
  const status = normalizeStatus(o.status);
  const cancelled = status === 'cancelled';
  // A refund is only "confirmed" for the customer once the admin marks it
  // Successful AND records a UTR / transaction number. Until then we don't
  // surface any refund status to the user.
  const refundConfirmed =
    cancelled && o.refundStatus === 'successful' && !!(o.refundNote || '').trim();
  // A customer-cancelled order shows a "call us for the refund" note until the
  // admin marks the refund Successful (then the real status replaces it).
  const showRefundCallNote = cancelled && o.cancelledBy === 'user' && !refundConfirmed;
  const placed = parseServerDate(o.createdAt);

  // Customer self-cancellation gating (mirrors the server rules).
  const elapsed = placed ? Date.now() - placed.getTime() : Infinity;
  const withinWindow = elapsed < CANCEL_WINDOW_MS;
  const earlyState = USER_CANCELLABLE.includes(status);
  const canUserCancel = earlyState && withinWindow;
  const windowExpired = earlyState && !withinWindow;
  const minutesLeft = Math.max(0, Math.ceil((CANCEL_WINDOW_MS - elapsed) / 60000));

  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelErr, setCancelErr] = useState('');

  const submitCancel = async (reason) => {
    setCancelling(true);
    setCancelErr('');
    try {
      const updated = await cancelMyOrder(o.id, reason);
      onUpdated?.(updated, 'Your order has been cancelled successfully.');
      setShowCancel(false);
    } catch (err) {
      setCancelErr(apiError(err, 'Could not cancel the order. Please try again.'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <article className="my-order-card">
      <header className="my-order-head">
        <div className="my-order-headmain">
          <div className="my-order-no">Order {formatOrderNo(o.id)}</div>
          <div className="my-order-date">Placed on {formatDateTime(o.createdAt)}</div>
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

        {showRefundCallNote && (
          <div className="my-order-refund refund-call">
            📞 Call us for the refund and confirm your order number
            <a href={`tel:+${STORE_WHATSAPP_INTL}`}>{STORE_WHATSAPP}</a>
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

      {/* Cancelled: product and the cancelled stamp sit side by side on desktop
          (flex) and stack on mobile (block) via Bootstrap's responsive grid. */}
      {cancelled && (
        <div className="row g-3 align-items-center my-order-cancelled-row">
          <div className="col-12 col-md-6">
            <OrderItems items={o.items} stacked />
          </div>
          <div className="col-12 col-md-6">
            <div className="cancelled-banner" role="status">
              <div className="cancelled-stamp">
                <span className="cancelled-label">CANCELLED</span>
              </div>
              <span className="cancelled-sub">This order has been cancelled.</span>
              {o.cancellationReason && (
                <span className="cancelled-reason"><strong>Reason:</strong> {o.cancellationReason}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active orders keep the tracker on top and the product list below. */}
      {!cancelled && <StatusTracker status={status} />}
      {!cancelled && <OrderItems items={o.items} />}

      <footer className="my-order-foot">
        <div className="my-order-facts">
          <div><span className="fact-label">Total</span><span className="fact-value">{formatPrice(o.totalAmount)}</span></div>
          <div><span className="fact-label">Payment</span><span className="fact-value">{paymentLabel(o.paymentStatus)}</span></div>
          {cancelled ? (
            <>
              <div><span className="fact-label">Delivery</span><span className="fact-value text-muted">Cancelled</span></div>
              <div><span className="fact-label">Cancelled On</span><span className="fact-value">{formatDateTime(o.cancelledAt)}</span></div>
            </>
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

      {canUserCancel && (
        <div className="my-order-actions">
          <button type="button" className="btn-cancel-order" onClick={() => setShowCancel(true)}>
            Cancel Order
          </button>
          <span className="cancel-window-note">
            ⏱ You can cancel this order within 1 hour of placing it
            {minutesLeft > 0 ? ` — about ${minutesLeft} min left.` : '.'}
          </span>
        </div>
      )}
      {windowExpired && (
        <div className="my-order-actions">
          <span className="cancel-expired-note">
            This order can no longer be cancelled because the 1-hour cancellation window has expired.
          </span>
        </div>
      )}

      {showCancel && (
        <CancelOrderDialog
          order={o}
          busy={cancelling}
          error={cancelErr}
          onClose={() => { if (!cancelling) { setShowCancel(false); setCancelErr(''); } }}
          onConfirm={submitCancel}
        />
      )}
    </article>
  );
}

// Confirmation dialog with a mandatory cancellation reason (preset list + Other).
function CancelOrderDialog({ order, busy, error, onClose, onConfirm }) {
  const [choice, setChoice] = useState('');
  const [other, setOther] = useState('');
  const reason = choice === 'Other' ? other.trim() : choice;
  const valid = choice && (choice !== 'Other' || other.trim().length >= 3);

  return (
    <div
      className="cancel-modal"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target.classList.contains('cancel-modal')) onClose(); }}
    >
      <div className="cancel-modal-card">
        <h5 className="cancel-modal-title">Cancel Order {formatOrderNo(order.id)}</h5>
        <p className="cancel-modal-sub">
          Please tell us why you'd like to cancel. This action can't be undone.
        </p>

        <label className="cancel-modal-label">Reason for cancellation <span className="req">*</span></label>
        <select
          className="form-select"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={busy}
        >
          <option value="">Select a reason…</option>
          {CANCEL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          <option value="Other">Other</option>
        </select>

        {choice === 'Other' && (
          <textarea
            className="form-control mt-2"
            rows={3}
            placeholder="Please tell us the reason…"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            disabled={busy}
          />
        )}

        {error && <div className="cancel-modal-err">{error}</div>}

        <div className="cancel-modal-actions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
            Keep Order
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => onConfirm(reason)}
            disabled={!valid || busy}
          >
            {busy ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Product rows. `stacked` puts each price directly under the product details
// (used for cancelled orders); otherwise the price sits on the right.
function OrderItems({ items, stacked = false }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="my-order-body">
      <div className="order-items">
        {items.map((it, i) => {
          const price = formatPrice((it.unitPrice || 0) * (it.quantity || 1));
          return (
            <div className={`order-item-row${stacked ? ' is-stacked' : ''}`} key={i}>
              <img className="order-item-thumb" src={resolveImage(it.image)} alt={it.name} loading="lazy" />
              {stacked ? (
                <dl className="order-item-details">
                  <dt>Product Code</dt><dd>{it.code}</dd>
                  <dt>Product Name</dt><dd>{it.name}</dd>
                  {it.size ? (<><dt>Size</dt><dd>{it.size}</dd></>) : null}
                  <dt>Qty</dt><dd>{it.quantity}</dd>
                  <dt>Price</dt><dd className="oi-price">{price}</dd>
                </dl>
              ) : (
                <>
                  <div className="order-item-info">
                    <span className="order-item-name">{it.name}</span>
                    <span className="order-item-meta">
                      <span className="order-item-code">{it.code}</span>
                      {it.size ? ` · ${it.size}` : ''} · Qty {it.quantity}
                    </span>
                  </div>
                  <div className="order-item-total">{price}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
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

function formatDateTime(value) {
  const d = parseServerDate(value);
  if (!d) return '—';
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
