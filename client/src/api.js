import axios from 'axios';
import { API_BASE } from './config.js';

export const api = axios.create({ baseURL: `${API_BASE}/api` });

// Attach the appropriate bearer token per request.
// Admin calls (/admin/*) use the admin token; everything else the user token.
api.interceptors.request.use((cfg) => {
  const url = cfg.url || '';
  const isAdmin = url.startsWith('/admin');
  const token = isAdmin
    ? localStorage.getItem('bunnyAdminToken')
    : localStorage.getItem('bunnyUserToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// On an expired/invalid admin token, clear the session so the panel returns
// to the login screen instead of showing broken data.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err?.config?.url || '';
    // Ignore the login request itself (bad credentials shouldn't reload).
    if (err?.response?.status === 401 && url.startsWith('/admin') && url !== '/admin/login') {
      localStorage.removeItem('bunnyAdminToken');
      localStorage.removeItem('bunnyAdmin');
      if (window.location.pathname.startsWith('/admin')) window.location.assign('/admin');
    }
    return Promise.reject(err);
  }
);

// Normalise error messages coming back from the API.
export function apiError(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.error || err?.message || fallback;
}

// ---- Public catalog ----
export const fetchCategories = () => api.get('/categories').then((r) => r.data);
export const fetchProducts = (category) =>
  api.get('/products', { params: category ? { category } : {} }).then((r) => r.data);

// ---- Customer auth ----
export const checkMobileExists = (mobile) =>
  api.get('/auth/exists', { params: { mobile } }).then((r) => r.data.exists);
export const loginUser = (payload) => api.post('/auth/login', payload).then((r) => r.data);

// ---- Orders ----
export const placeOrder = (payload) => api.post('/orders', payload).then((r) => r.data);

// ---- Admin ----
export const adminLogin = (payload) => api.post('/admin/login', payload).then((r) => r.data);
export const adminChangePassword = (payload) =>
  api.post('/admin/change-password', payload).then((r) => r.data);
export const adminFetchProducts = () => api.get('/admin/products').then((r) => r.data);
export const adminCreateProduct = (p) => api.post('/admin/products', p).then((r) => r.data);
export const adminUpdateProduct = (id, p) => api.put(`/admin/products/${id}`, p).then((r) => r.data);
export const adminToggleStatus = (id, status) =>
  api.patch(`/admin/products/${id}/status`, status).then((r) => r.data);
export const adminDeleteProduct = (id) => api.delete(`/admin/products/${id}`).then((r) => r.data);
export const adminFetchCategories = () => api.get('/admin/categories').then((r) => r.data);
export const adminCreateCategory = (c) => api.post('/admin/categories', c).then((r) => r.data);
export const adminUpdateCategory = (id, c) => api.put(`/admin/categories/${id}`, c).then((r) => r.data);
export const adminDeleteCategory = (id) => api.delete(`/admin/categories/${id}`).then((r) => r.data);
export const adminUploadImage = (file) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post('/admin/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
};
export const adminFetchOrders = () => api.get('/admin/orders').then((r) => r.data);
export const adminUpdateOrderStatus = (id, status) =>
  api.patch(`/admin/orders/${id}/status`, { status }).then((r) => r.data);
