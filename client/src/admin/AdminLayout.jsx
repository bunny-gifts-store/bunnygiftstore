import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAdminAuth } from './AdminApp.jsx';

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <div className="admin-topbar-row">
          <div className="admin-brand">🐰 Bunny Admin <span>· {admin?.username}</span></div>
          <button
            type="button"
            className={`admin-menu-toggle${menuOpen ? ' open' : ''}`}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
        <nav className={`admin-nav${menuOpen ? ' open' : ''}`}>
          <NavLink to="/admin" end onClick={close}>Dashboard</NavLink>
          <NavLink to="/admin/products" onClick={close}>Products</NavLink>
          <NavLink to="/admin/categories" onClick={close}>Categories</NavLink>
          <NavLink to="/admin/orders" onClick={close}>Orders</NavLink>
          <NavLink to="/admin/users" onClick={close}>Customers</NavLink>
          <NavLink to="/admin/settings" onClick={close}>Settings</NavLink>
          <Link to="/" target="_blank" rel="noopener" onClick={close}>View Store ↗</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); close(); logout(); }}>Logout</a>
        </nav>
      </div>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
