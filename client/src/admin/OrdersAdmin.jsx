import { useEffect, useMemo, useState, Fragment } from 'react';
import { adminFetchOrders, adminFetchProducts, adminUpdateOrderStatus, apiError } from '../api.js';
import { formatPrice, resolveImage, buildOrderSerials, formatOrderNo } from '../utils.js';
import OrderStatusBadge from './OrderStatusBadge.jsx';

export default function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [imageByCode, setImageByCode] = useState({});
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const serials = useMemo(() => buildOrderSerials(orders), [orders]);

  const changeStatus = async (id, status) => {
    setError('');
    const prev = orders;
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status } : o))); // optimistic
    try {
      await adminUpdateOrderStatus(id, status);
    } catch (err) {
      setOrders(prev); // revert
      setError(apiError(err));
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
                <tr><th>#</th><th>Customer</th><th>Phone</th><th>City</th><th>Amount</th><th>Items</th><th>Status</th><th>Txn ID</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <Fragment key={o.id}>
                    <tr>
                      <td className="fw-semibold">{formatOrderNo(serials[o.id])}</td>
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
                            value={o.status || 'received'}
                            onChange={(e) => changeStatus(o.id, e.target.value)}
                            aria-label="Change order status"
                          >
                            <option value="received">Order Received</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                          </select>
                        </div>
                      </td>
                      <td><code>{o.transactionId}</code></td>
                      <td>{new Date(o.createdAt).toLocaleString()}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-secondary"
                                onClick={() => setOpen(open === o.id ? null : o.id)}>
                          {open === o.id ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {open === o.id && (
                      <tr>
                        <td colSpan="10" className="bg-light">
                          <div className="p-2">
                            <p className="mb-1"><strong>Email:</strong> {o.email}</p>
                            <p className="mb-1"><strong>Address:</strong> {o.address}, {o.city}, {o.state} - {o.pincode}</p>
                            {Array.isArray(o.items) && o.items.length > 0 && (
                              <div className="order-items mt-2">
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
