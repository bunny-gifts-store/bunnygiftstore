import { useEffect, useState, Fragment } from 'react';
import { adminFetchOrders, adminFetchProducts, adminUpdateOrder, apiError } from '../api.js';
import { formatPrice, resolveImage, formatOrderNo } from '../utils.js';
import {
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../orderStatus.js';
import OrderStatusBadge from './OrderStatusBadge.jsx';

export default function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [imageByCode, setImageByCode] = useState({});
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [delivery, setDelivery] = useState({ day: '', date: '' }); // draft for the open order
  const [savingDelivery, setSavingDelivery] = useState(false);

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

  const changeStatus = (id, status) => patchOrder(id, { status }).catch(() => {});
  const changePayment = (id, paymentStatus) => patchOrder(id, { paymentStatus }).catch(() => {});

  const openDetails = (o) => {
    if (open === o.id) { setOpen(null); return; }
    setOpen(o.id);
    setDelivery({ day: o.deliveryDay || '', date: o.deliveryDate || '' });
  };

  const saveDelivery = async (id) => {
    setSavingDelivery(true);
    try {
      await patchOrder(id, { deliveryDay: delivery.day, deliveryDate: delivery.date });
    } catch { /* error already surfaced */ } finally {
      setSavingDelivery(false);
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

  return (
    <>
      <h2 className="mb-4">Orders <span className="text-muted fs-6">({orders.length})</span></h2>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="admin-card">
        {orders.length === 0 ? (
          <p className="text-muted mb-0">No orders yet.</p>
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
                {orders.map((o) => (
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
                          <select
                            className="form-select form-select-sm order-status-select"
                            value={o.status}
                            onChange={(e) => changeStatus(o.id, e.target.value)}
                            aria-label="Change order status"
                          >
                            {ORDER_STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td>
                        <select
                          className={`form-select form-select-sm order-status-select payment-${o.paymentStatus || 'paid'}`}
                          value={o.paymentStatus || 'paid'}
                          onChange={(e) => changePayment(o.id, e.target.value)}
                          aria-label="Change payment status"
                        >
                          {Object.entries(PAYMENT_STATUS_LABELS).map(([s, label]) => (
                            <option key={s} value={s}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="small">
                        {o.deliveryDate || o.deliveryDay ? (
                          <>
                            {o.deliveryDay && <div>{o.deliveryDay}</div>}
                            {o.deliveryDate && <div className="text-muted">{o.deliveryDate}</div>}
                          </>
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

                            <div className="delivery-editor mt-3">
                              <h6 className="mb-2">Delivery Schedule</h6>
                              <div className="row g-2 align-items-end">
                                <div className="col-sm-4">
                                  <label className="form-label small mb-1">Delivery Day</label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="e.g. Wednesday or 3–5 days"
                                    value={delivery.day}
                                    onChange={(e) => setDelivery((d) => ({ ...d, day: e.target.value }))}
                                  />
                                </div>
                                <div className="col-sm-4">
                                  <label className="form-label small mb-1">Delivery Date</label>
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={delivery.date}
                                    onChange={(e) => setDelivery((d) => ({ ...d, date: e.target.value }))}
                                  />
                                </div>
                                <div className="col-sm-4">
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => saveDelivery(o.id)}
                                    disabled={savingDelivery}
                                  >
                                    {savingDelivery ? 'Saving…' : 'Save Delivery'}
                                  </button>
                                </div>
                              </div>
                            </div>

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
