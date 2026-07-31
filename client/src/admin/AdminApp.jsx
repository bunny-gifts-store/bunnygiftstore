import { createContext, useContext, useMemo, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './AdminLogin.jsx';
import AdminLayout from './AdminLayout.jsx';
import Dashboard from './Dashboard.jsx';
import ProductsAdmin from './ProductsAdmin.jsx';
import CategoriesAdmin from './CategoriesAdmin.jsx';
import OrdersAdmin from './OrdersAdmin.jsx';
import UsersAdmin from './UsersAdmin.jsx';
import Settings from './Settings.jsx';

const AdminAuthContext = createContext(null);
export const useAdminAuth = () => useContext(AdminAuthContext);

export default function AdminApp() {
  const [admin, setAdmin] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bunnyAdmin') || 'null'); }
    catch { return null; }
  });

  const login = ({ token, admin: a }) => {
    localStorage.setItem('bunnyAdminToken', token);
    localStorage.setItem('bunnyAdmin', JSON.stringify(a));
    setAdmin(a);
  };
  const logout = () => {
    localStorage.removeItem('bunnyAdminToken');
    localStorage.removeItem('bunnyAdmin');
    setAdmin(null);
  };

  const value = useMemo(() => ({ admin, login, logout }), [admin]);

  return (
    <AdminAuthContext.Provider value={value}>
      {!admin ? (
        <AdminLogin />
      ) : (
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<ProductsAdmin />} />
            <Route path="categories" element={<CategoriesAdmin />} />
            <Route path="orders" element={<OrdersAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      )}
    </AdminAuthContext.Provider>
  );
}
