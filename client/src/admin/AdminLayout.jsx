import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAdminAuth } from './AdminApp.jsx';

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <div className="admin-brand">🐰 Bunny Admin <span>· {admin?.username}</span></div>
        <nav className="admin-nav">
          <NavLink to="/admin" end>Dashboard</NavLink>
          <NavLink to="/admin/products">Products</NavLink>
          <NavLink to="/admin/categories">Categories</NavLink>
          <NavLink to="/admin/orders">Orders</NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
          <Link to="/" target="_blank" rel="noopener">View Store ↗</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>Logout</a>
        </nav>
      </div>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
