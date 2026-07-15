import { useEffect, useMemo, useState, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminFetchOrders, adminFetchProducts, adminUpdateOrder, apiError } from '../api.js';
import { formatPrice, resolveImage, formatOrderNo } from '../utils.js';
import {
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  REFUND_STATUS_OPTIONS,
  REFUND_STATUS_LABELS,
  refundLabel,
} from '../orderStatus.js';
import OrderStatusBadge from './OrderStatusBadge.jsx';

// Derive the weekday name from a YYYY-MM-DD value without timezone drift.
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const dayFromDate = (dateStr) => {
  const dt = parseLocalDate(dateStr);
  return dt ? dt.toLocaleDateString('en-US', { weekday: 'long' }) : '';
};
const formatDeliveryDate = (dateStr) => {
  const dt = parseLocalDate(dateStr);
  return dt
    ? dt.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '';
};
// cancelledAt is stored as an ISO timestamp (with a 'Z'), so it parses directly.
const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const cancelledByLabel = (by) => {
  const v = String(by || '').toLowerCase();
  if (v === 'user') return 'Customer';
  if (v === 'admin') return 'Admin (store)';
  return '—';
};

export default function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [imageByCode, setImageByCode] = useState({});
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || 'all';
  const [open, setOpen] = useState(null);
  const [deliveryDate, setDeliveryDate] = useState(''); // draft for the open order
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [savedDelivery, setSavedDelivery] = useState(false);
  // Staged "Update Order" workflow drafts (nothing is saved / visible to the
  // customer until the admin clicks Update Order).
  const [draftStatus, setDraftStatus] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [refund, setRefund] = useState({ status: '', note: '' });
  const [savingOrder, setSavingOrder] = useState(false);
  const [savedOrder, setSavedOrder] = useState(false);
  const [orderError, setOrderError] = useState('');

  const patchOrder = async (id, patch) => {
    setError('');
    const prev = orders;
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o))); // optimistic
    try {
      const updated = await adminUpdateOrder(id, patch);
      setOrders((os) => os.map((o) => (o.id === id ? updated : o)));
      return updated;
    } catch (err) {
      setOrders(prev); // revert
      setError(apiError(err));
      throw err;
    }
  };

  const openDetails = (o) => {
    if (open === o.id) { setOpen(null); return; }
    setOpen(o.id);
    setDeliveryDate(o.deliveryDate || '');
    setSavedDelivery(false);
    // Seed the staged edit drafts from the order's saved values.
    setDraftStatus(o.status);
    setCancelReason(o.cancellationReason || '');
    setRefund({ status: o.refundStatus || '', note: o.refundNote || '' });
    setSavedOrder(false);
    setOrderError('');
  };

  const saveDelivery = async (id) => {
    setSavingDelivery(true);
    try {
      // Day is auto-derived from the date, so admins only pick the date.
      await patchOrder(id, { deliveryDay: dayFromDate(deliveryDate), deliveryDate });
      setSavedDelivery(true);
    } catch { /* error already surfaced */ } finally {
      setSavingDelivery(false);
    }
  };

  // Commit the whole staged edit (status + cancellation reason + refund) in a
  // single request. Only now do the changes become visible to the customer.
  const updateOrder = async (id) => {
    setOrderError('');
    const isCancel = draftStatus === 'cancelled';
    if (isCancel) {
      if (cancelReason.trim().length < 3) { setOrderError('Please enter a cancellation reason.'); return; }
      if (!refund.status) { setOrderError('Please select a refund status.'); return; }
      if (refund.status === 'successful' && !refund.note.trim()) {
        setOrderError('A UTR / transaction number is required for a successful refund.'); return;
      }
    }
    const patch = { status: draftStatus };
    if (isCancel) {
      patch.cancellationReason = cancelReason.trim();
      patch.refundStatus = refund.status;
      patch.refundNote = refund.note.trim();
    }
    setSavingOrder(true);
    try {
      await patchOrder(id, patch);
      setSavedOrder(true);
    } catch (err) {
      setOrderError(apiError(err));
    } finally {
      setSavingOrder(false);
    }
  };

  // Update just the refund on an already-cancelled order (status/reason stay
  // locked; this is how a user-cancelled order gets its refund recorded).
  const saveRefund = async (id) => {
    setOrderError('');
    if (refund.status === 'successful' && !refund.note.trim()) {
      setOrderError('A UTR / transaction number is required for a successful refund.'); return;
    }
    setSavingOrder(true);
    try {
      await patchOrder(id, { refundStatus: refund.status, refundNote: refund.note.trim() });
      setSavedOrder(true);
    } catch (err) {
      setOrderError(apiError(err));
    } finally {
      setSavingOrder(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [ord, products] = await Promise.all([adminFetchOrders(), adminFetchProducts()]);
        setOrders(ord);
        // Map code -> current image so older orders (no image in snapshot) still show a thumbnail.
        setImageByCode(Object.fromEntries(products.map((p) => [p.code, p.image])));
      } catch (err) { setError(apiError(err)); }
    })();
  }, []);

  const statusCounts = useMemo(() => {
    const m = Object.fromEntries(ORDER_STATUS_OPTIONS.map((s) => [s, 0]));
    for (const o of orders) if (m[o.status] !== undefined) m[o.status] += 1;
    return m;
  }, [orders]);

  const filteredOrders = useMemo(
    () => (statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter)),
    [orders, statusFilter],
  );

  const setFilter = (s) => {
    setOpen(null); // collapse any open details when switching filters
    if (s === 'all') setSearchParams({});
    else setSearchParams({ status: s });
  };

  const filterChips = [
    { key: 'all', label: 'All', count: orders.length },
    ...ORDER_STATUS_OPTIONS.map((s) => ({ key: s, label: ORDER_STATUS_LABELS[s], count: statusCounts[s] })),
  ];

  return (
    <>
      <h2 className="mb-4">Orders <span className="text-muted fs-6">({filteredOrders.length})</span></h2>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="order-filter">
        {filterChips.map((c) => (
          <button
            key={c.key}
            className={`order-filter-chip st-${c.key}${statusFilter === c.key ? ' active' : ''}`}
            onClick={() => setFilter(c.key)}
          >
            {c.label}<span className="order-filter-count">{c.count}</span>
          </button>
        ))}
      </div>

      <div className="admin-card">
        {orders.length === 0 ? (
          <p className="text-muted mb-0">No orders yet.</p>
        ) : filteredOrders.length === 0 ? (
          <p className="text-muted mb-0">No {ORDER_STATUS_LABELS[statusFilter] || ''} orders.</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>#</th><th>Customer</th><th>Phone</th><th>City</th><th>Amount</th>
                  <th>Items</th><th>Status</th><th>Payment</th><th>Delivery</th><th>Date</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <Fragment key={o.id}>
                    <tr>
                      <td className="fw-semibold">{formatOrderNo(o.id)}</td>
                      <td>{o.name}</td>
                      <td>{o.phone}</td>
                      <td>{o.city}</td>
                      <td>{formatPrice(o.totalAmount)}</td>
                      <td>{o.totalItems}</td>
                      <td>
                        <div className="order-status-cell">
                          <OrderStatusBadge status={o.status} />
                          {(o.status === 'cancelled' || o.status === 'delivered') && (
                            <span className="status-locked" title="This order is locked">🔒 Locked</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {/* Payment is confirmed at checkout (customer sends the UTR),
                            so it's shown read-only — the admin never changes it. */}
                        <span className={`payment-chip payment-${o.paymentStatus || 'paid'}`}>
                          {PAYMENT_STATUS_LABELS[o.paymentStatus] || 'Paid'}
                        </span>
                      </td>
                      <td className="small">
                        {o.deliveryDate ? (
                          <>
                            <div className="fw-semibold">{dayFromDate(o.deliveryDate) || o.deliveryDay}</div>
                            <div className="text-muted">{formatDeliveryDate(o.deliveryDate)}</div>
                          </>
                        ) : o.deliveryDay ? (
                          <div>{o.deliveryDay}</div>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td>{new Date(o.createdAt).toLocaleString()}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => openDetails(o)}>
                          {open === o.id ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {open === o.id && (
                      <tr>
                        <td colSpan="11" className="bg-light">
                          <div className="p-2">
                            <p className="mb-1"><strong>Email:</strong> {o.email}</p>
                            <p className="mb-1"><strong>Address:</strong> {o.address}, {o.city}, {o.state} - {o.pincode}</p>
                            <p className="mb-1"><strong>Transaction ID:</strong> <code>{o.transactionId}</code></p>

                            {(() => {
                              const locked = o.status === 'cancelled';
                              const delivered = o.status === 'delivered';
                              const isCancel = draftStatus === 'cancelled';
                              const dirty = draftStatus !== o.status
                                || (isCancel && (
                                  cancelReason !== (o.cancellationReason || '')
                                  || refund.status !== (o.refundStatus || '')
                                  || refund.note !== (o.refundNote || '')
                                ));
                              const valid = !isCancel || (
                                cancelReason.trim().length >= 3
                                && !!refund.status
                                && (refund.status !== 'successful' || refund.note.trim().length > 0)
                              );
                              const canUpdate = dirty && valid && !savingOrder;

                              return (
                                <div className={`order-update-editor mt-3${(locked || delivered) ? ' is-locked' : ''}`}>
                                  <div className="order-update-head">
                                    <span className="order-update-icon" aria-hidden="true">📝</span>
                                    <h6 className="mb-0">Update Order</h6>
                                    {(locked || delivered) && <span className="order-lock-pill">🔒 Locked</span>}
                                  </div>

                                  {locked ? (
                                    <div className="order-update-locked">
                                      <div className="oul-row"><span className="oul-label">Status</span><OrderStatusBadge status={o.status} /></div>
                                      <div className="oul-row"><span className="oul-label">Cancelled By</span><span className="oul-value">{cancelledByLabel(o.cancelledBy)}</span></div>
                                      <div className="oul-row"><span className="oul-label">Cancelled On</span><span className="oul-value">{formatDateTime(o.cancelledAt)}</span></div>
                                      <div className="oul-row"><span className="oul-label">Cancellation Reason</span><span className="oul-value">{o.cancellationReason || '—'}</span></div>
                                      <div className="order-lock-msg">Status &amp; reason are locked. You can still record the refund below.</div>

                                      {(() => {
                                        const refundDirty = refund.status !== (o.refundStatus || '') || refund.note !== (o.refundNote || '');
                                        const canSaveRefund = refundDirty && !savingOrder;
                                        return (
                                          <div className="order-refund-inline">
                                            <div className="order-update-field">
                                              <label className="delivery-label">Refund Status</label>
                                              <select
                                                className="form-select"
                                                value={refund.status}
                                                onChange={(e) => { setRefund((r) => ({ ...r, status: e.target.value })); setSavedOrder(false); setOrderError(''); }}
                                              >
                                                <option value="">Not set</option>
                                                {REFUND_STATUS_OPTIONS.map((s) => (
                                                  <option key={s} value={s}>{REFUND_STATUS_LABELS[s]}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="order-update-field">
                                              <label className="delivery-label">
                                                UTR / Txn No. {refund.status === 'successful' ? <span className="req">*</span> : <span className="opt">(optional)</span>}
                                              </label>
                                              <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. UTR21343456"
                                                value={refund.note}
                                                onChange={(e) => { setRefund((r) => ({ ...r, note: e.target.value })); setSavedOrder(false); setOrderError(''); }}
                                              />
                                            </div>
                                            {orderError && <div className="order-update-err order-update-field-full">{orderError}</div>}
                                            <div className="order-update-field-full">
                                              <button
                                                className={`btn order-update-btn${savedOrder && !refundDirty ? ' is-saved' : ''}`}
                                                onClick={() => saveRefund(o.id)}
                                                disabled={!canSaveRefund}
                                              >
                                                {savingOrder ? 'Saving…' : savedOrder && !refundDirty ? '✓ Saved' : (o.refundStatus || o.refundNote) ? 'Update Refund' : 'Save Refund'}
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  ) : delivered ? (
                                    <div className="order-update-locked">
                                      <div className="oul-row"><span className="oul-label">Status</span><OrderStatusBadge status={o.status} /></div>
                                      <div className="oul-row"><span className="oul-label">Delivery Day</span><span className="oul-value">{dayFromDate(o.deliveryDate) || o.deliveryDay || '—'}</span></div>
                                      <div className="oul-row"><span className="oul-label">Delivery Date</span><span className="oul-value">{formatDeliveryDate(o.deliveryDate) || '—'}</span></div>
                                      <div className="order-lock-msg">This order is delivered — its status and delivery schedule are locked.</div>
                                    </div>
                                  ) : (
                                    <div className="order-update-body">
                                      <div className="order-update-field">
                                        <label className="delivery-label">Order Status</label>
                                        <select
                                          className="form-select"
                                          value={draftStatus}
                                          onChange={(e) => { setDraftStatus(e.target.value); setSavedOrder(false); setOrderError(''); }}
                                        >
                                          {ORDER_STATUS_OPTIONS.map((s) => (
                                            <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                                          ))}
                                        </select>
                                      </div>

                                      {isCancel && (
                                        <>
                                          <div className="order-update-field order-update-field-full">
                                            <label className="delivery-label">Cancellation Reason <span className="req">*</span></label>
                                            <textarea
                                              className="form-control"
                                              rows={2}
                                              placeholder="Why is this order being cancelled? (visible to the customer)"
                                              value={cancelReason}
                                              onChange={(e) => { setCancelReason(e.target.value); setSavedOrder(false); setOrderError(''); }}
                                            />
                                          </div>
                                          <div className="order-update-field">
                                            <label className="delivery-label">Refund Status <span className="req">*</span></label>
                                            <select
                                              className="form-select"
                                              value={refund.status}
                                              onChange={(e) => { setRefund((r) => ({ ...r, status: e.target.value })); setSavedOrder(false); setOrderError(''); }}
                                            >
                                              <option value="">Select…</option>
                                              {REFUND_STATUS_OPTIONS.map((s) => (
                                                <option key={s} value={s}>{REFUND_STATUS_LABELS[s]}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="order-update-field">
                                            <label className="delivery-label">
                                              UTR / Txn No. {refund.status === 'successful' ? <span className="req">*</span> : <span className="opt">(optional)</span>}
                                            </label>
                                            <input
                                              type="text"
                                              className="form-control"
                                              placeholder="e.g. UTR21343456"
                                              value={refund.note}
                                              onChange={(e) => { setRefund((r) => ({ ...r, note: e.target.value })); setSavedOrder(false); setOrderError(''); }}
                                            />
                                          </div>
                                          <div className="order-update-warn order-update-field-full">
                                            ⚠️ Once you update a cancelled order, it will be permanently locked.
                                          </div>
                                        </>
                                      )}

                                      {orderError && <div className="order-update-err order-update-field-full">{orderError}</div>}

                                      <div className="order-update-field-full">
                                        <button
                                          className={`btn order-update-btn${savedOrder && !dirty ? ' is-saved' : ''}`}
                                          onClick={() => updateOrder(o.id)}
                                          disabled={!canUpdate}
                                        >
                                          {savingOrder ? 'Updating…' : savedOrder && !dirty ? '✓ Updated' : 'Update Order'}
                                        </button>
                                        {dirty && !savedOrder && (
                                          <span className="order-update-pending">Pending — not yet visible to the customer</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {o.status !== 'cancelled' && o.status !== 'delivered' && (() => {
                              const derivedDay = dayFromDate(deliveryDate);
                              const dirty = deliveryDate !== (o.deliveryDate || '');
                              const canSave = !!deliveryDate && dirty && !savingDelivery;
                              const today = new Date();
                              const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
                                .toISOString().slice(0, 10);
                              return (
                                <div className="delivery-editor mt-3">
                                  <div className="delivery-editor-head">
                                    <span className="delivery-editor-icon" aria-hidden="true">🚚</span>
                                    <h6 className="mb-0">Delivery Schedule</h6>
                                  </div>
                                  <div className="delivery-editor-body">
                                    <div className="delivery-field">
                                      <label className="delivery-label">Delivery Date</label>
                                      <input
                                        type="date"
                                        className="form-control delivery-date-input"
                                        value={deliveryDate}
                                        min={minDate}
                                        onChange={(e) => { setDeliveryDate(e.target.value); setSavedDelivery(false); }}
                                      />
                                    </div>

                                    <div className="delivery-field">
                                      <label className="delivery-label">Day (auto)</label>
                                      <div className={`delivery-day-pill${derivedDay ? '' : ' is-empty'}`}>
                                        {derivedDay || 'Pick a date'}
                                      </div>
                                    </div>

                                    <button
                                      className={`btn delivery-save-btn${savedDelivery && !dirty ? ' is-saved' : ''}`}
                                      onClick={() => saveDelivery(o.id)}
                                      disabled={!canSave}
                                    >
                                      {savingDelivery
                                        ? 'Saving…'
                                        : savedDelivery && !dirty
                                          ? '✓ Saved'
                                          : o.deliveryDate
                                            ? 'Update Delivery'
                                            : 'Save Delivery'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {Array.isArray(o.items) && o.items.length > 0 && (
                              <div className="order-items mt-3">
                                {o.items.map((it, i) => (
                                  <div className="order-item-row" key={i}>
                                    <img
                                      className="order-item-thumb"
                                      src={resolveImage(it.image || imageByCode[it.code])}
                                      alt={it.name}
                                      loading="lazy"
                                    />
                                    <div className="order-item-info">
                                      <span className="order-item-name">{it.name}</span>
                                      <span className="order-item-meta">
                                        <span className="order-item-code">{it.code}</span>
                                        {it.size ? ` · ${it.size}` : ''} · Qty {it.quantity}
                                      </span>
                                    </div>
                                    <div className="order-item-total">
                                      {formatPrice((it.unitPrice || 0) * (it.quantity || 1))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
