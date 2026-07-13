import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminFetchProducts, adminFetchCategories, adminFetchOrders, adminUpdateOrderStatus, apiError,
} from '../api.js';
import { formatPrice, buildOrderSerials, formatOrderNo } from '../utils.js';
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
  const deliveredCount = useMemo(() => orders.filter((o) => o.status === 'delivered').length, [orders]);
  const recentOrders = useMemo(() => orders.filter((o) => o.status !== 'delivered').slice(0, 10), [orders]);
  const serials = useMemo(() => buildOrderSerials(orders), [orders]);

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

  const stats = [
    { num: counts.products, label: 'Products', to: '/admin/products' },
    { num: counts.categories, label: 'Categories', to: '/admin/categories' },
    { num: orders.length, label: 'Orders', to: '/admin/orders' },
    { num: deliveredCount, label: 'Delivered Orders', to: '/admin/orders' },
    { num: counts.outOfStock, label: 'Out of Stock', to: '/admin/products?filter=oos' },
    { num: counts.unavailable, label: 'Unavailable', to: '/admin/products?filter=unavailable' },
  ];

  return (
    <>
      <h2 className="mb-4">Dashboard</h2>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3 mb-4">
        {stats.map((s) => (
          <div className="col-6 col-md-4 col-lg-2" key={s.label}>
            <Link to={s.to} className="text-decoration-none">
              <div className="admin-stat">
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
                    <td className="fw-semibold">{formatOrderNo(serials[o.id])}</td>
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
