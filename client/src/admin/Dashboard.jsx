import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminFetchProducts, adminFetchCategories, adminFetchOrders, adminUpdateOrderStatus, apiError,
} from '../api.js';
import { formatPrice, formatOrderNo } from '../utils.js';
import { ORDER_STATUS_OPTIONS, ORDER_STATUS_LABELS } from '../orderStatus.js';
import OrderStatusBadge from './OrderStatusBadge.jsx';

export default function Dashboard() {
  const [counts, setCounts] = useState({ products: 0, categories: 0, outOfStock: 0, unavailable: 0 });
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [products, categories, allOrders] = await Promise.all([
          adminFetchProducts(), adminFetchCategories(), adminFetchOrders(),
        ]);
        setCounts({
          products: products.length,
          categories: categories.length,
          outOfStock: products.filter((p) => p.outOfStock).length,
          unavailable: products.filter((p) => p.unavailable).length,
        });
        setOrders(allOrders);
      } catch (err) {
        setError(apiError(err));
      }
    })();
  }, []);

  // Derived, so every count/section updates instantly when a status changes.
  const recentOrders = useMemo(
    () => orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').slice(0, 10),
    [orders],
  );
  const statusCounts = useMemo(() => {
    const m = Object.fromEntries(ORDER_STATUS_OPTIONS.map((s) => [s, 0]));
    for (const o of orders) if (m[o.status] !== undefined) m[o.status] += 1;
    return m;
  }, [orders]);

  const markDelivered = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await adminUpdateOrderStatus(id, 'delivered');
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'delivered' } : o)));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const catalogStats = [
    { num: counts.products, label: 'Products', to: '/admin/products' },
    { num: counts.categories, label: 'Categories', to: '/admin/categories' },
    { num: counts.outOfStock, label: 'Out of Stock', to: '/admin/products?filter=oos' },
    { num: counts.unavailable, label: 'Unavailable', to: '/admin/products?filter=unavailable' },
  ];

  // Total + one card per order status; each opens the Orders page pre-filtered.
  const orderStats = [
    { num: orders.length, label: 'Total Orders', to: '/admin/orders', key: 'all' },
    ...ORDER_STATUS_OPTIONS.map((s) => ({
      num: statusCounts[s], label: ORDER_STATUS_LABELS[s], to: `/admin/orders?status=${s}`, key: s,
    })),
  ];

  return (
    <>
      <h2 className="mb-4">Dashboard</h2>
      {error && <div className="alert alert-danger">{error}</div>}

      <h6 className="admin-section-title">Catalog</h6>
      <div className="row g-3 mb-4">
        {catalogStats.map((s) => (
          <div className="col-6 col-md-3" key={s.label}>
            <Link to={s.to} className="text-decoration-none">
              <div className="admin-stat">
                <div className="num">{s.num}</div>
                <div className="label">{s.label}</div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <h6 className="admin-section-title">Orders</h6>
      <div className="row g-3 mb-4">
        {orderStats.map((s) => (
          <div className="col-6 col-md-4 col-lg-3" key={s.key}>
            <Link to={s.to} className="text-decoration-none">
              <div className={`admin-stat admin-stat-order st-${s.key}`}>
                <span className="stat-dot" aria-hidden="true"></span>
                <div className="num">{s.num}</div>
                <div className="label">{s.label}</div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Recent Orders <span className="text-muted fs-6">(pending delivery)</span></h5>
          <Link to="/admin/orders" className="btn btn-sm btn-outline-secondary">View all orders</Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-muted mb-0">No pending orders — everything is delivered. 🎉</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr><th>#</th><th>Customer</th><th>Phone</th><th>Amount</th><th>Items</th><th>Status</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="fw-semibold">{formatOrderNo(o.id)}</td>
                    <td>{o.name}</td>
                    <td>{o.phone}</td>
                    <td>{formatPrice(o.totalAmount)}</td>
                    <td>{o.totalItems}</td>
                    <td><OrderStatusBadge status={o.status} /></td>
                    <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => markDelivered(o.id)}
                        disabled={busyId === o.id}
                      >
                        {busyId === o.id ? 'Saving…' : 'Delivered'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
