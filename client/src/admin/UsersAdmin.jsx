import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminFetchUsers, apiError } from '../api.js';
import { formatPrice } from '../utils.js';

// SQLite's CURRENT_TIMESTAMP is UTC with no timezone marker — normalise before
// parsing so registration dates don't display shifted by the local offset.
function formatDate(value, { withTime = false } = {}) {
  if (!value) return '—';
  const s = String(value);
  const iso = /[TZ]|[+]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s;
  return withTime ? d.toLocaleString() : d.toLocaleDateString();
}

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setUsers(await adminFetchUsers()); }
      catch (err) { setError(apiError(err)); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.username || ''} ${u.mobile || ''}`.toLowerCase().includes(q));
  }, [users, query]);

  const withOrders = users.filter((u) => u.orderCount > 0).length;

  return (
    <>
      <h2 className="mb-4">Customers</h2>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3 mb-4">
        {[
          { num: users.length, label: 'Registered' },
          { num: withOrders, label: 'Have Ordered' },
          { num: users.length - withOrders, label: 'No Orders Yet' },
        ].map((s) => (
          <div className="col-6 col-md-4" key={s.label}>
            <div className="admin-stat">
              <div className="num">{s.num}</div>
              <div className="label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="row g-2 mb-3">
          <div className="col-sm-8 col-md-6">
            <input
              className="form-control"
              placeholder="Search by name or mobile number…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {query && (
            <div className="col-sm-4 col-md-3 d-flex align-items-center">
              <span className="text-muted small">
                {filtered.length} of {users.length} shown
              </span>
            </div>
          )}
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Mobile</th><th>Registered</th>
                <th className="text-end">Orders</th><th className="text-end">Total Spent</th><th>Last Order</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="text-muted">{u.id}</td>
                  <td className="fw-semibold">{u.username}</td>
                  <td><a href={`tel:${u.mobile}`} className="text-decoration-none">{u.mobile}</a></td>
                  <td>{formatDate(u.createdAt, { withTime: true })}</td>
                  <td className="text-end">
                    {u.orderCount > 0
                      ? <Link to="/admin/orders" className="text-decoration-none">{u.orderCount}</Link>
                      : <span className="text-muted">0</span>}
                  </td>
                  <td className="text-end">{u.totalSpent > 0 ? formatPrice(u.totalSpent) : <span className="text-muted">—</span>}</td>
                  <td>{formatDate(u.lastOrderAt)}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-muted text-center py-4">
                    {users.length === 0
                      ? 'No customers have registered yet.'
                      : 'No customer matches that search.'}
                  </td>
                </tr>
              )}
              {loading && <tr><td colSpan="7" className="text-muted text-center py-4">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
