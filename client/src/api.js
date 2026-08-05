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
    : sessionStorage.getItem('bunnyUserToken');
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
  // A timeout has no response body, and axios's own text ("timeout of 90000ms
  // exceeded") means nothing to a shopper.
  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
    return 'The server is taking too long to respond. Please check your connection and try again.';
  }
  // No response at all = the API is unreachable (offline, or the host is down).
  if (err?.request && !err?.response) {
    return 'Could not reach the store server. Please check your connection and try again.';
  }
  return err?.response?.data?.error || err?.message || fallback;
}

// Sign-in and registration must never hang forever. Axios has NO default
// timeout, so without this a request to a server that accepts the connection but
// never replies leaves the button stuck on "Signing in…" indefinitely with no
// error — which is exactly how a sleeping/hung API presents to the user.
// The window is generous because it may legitimately include a cold start.
export const AUTH_TIMEOUT = 90000;

// ---------------------------------------------------------------------------
// Warm-up.
//
// The production API runs on a host that spins down when idle, so the first
// request after an idle period pays a 50s+ cold start. Firing this the moment
// the app loads lets the server boot while the user is still typing, so by the
// time they press Login it is usually already awake.
//
// It hits /api/ping (no database, no auth, no rate limit) and keeps retrying, so
// one failed attempt doesn't leave the app cold for the whole session. Callers
// can await `warmUpApi()` to know whether the API is actually reachable yet.
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let warmPromise = null;
export let apiIsWarm = false;

export function warmUpApi() {
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    // Delays between attempts; a cold start is ~1 min, so keep trying past it.
    for (const delay of [0, 3000, 8000, 15000, 30000]) {
      if (delay) await sleep(delay);
      try {
        await api.get('/ping', { timeout: 120000 });
        apiIsWarm = true;
        return true;
      } catch {
        /* keep trying */
      }
    }
    // Allow a later call (e.g. on form submit) to start a fresh round.
    warmPromise = null;
    return false;
  })();
  return warmPromise;
}

// ---- Public catalog ----
export const fetchCategories = () => api.get('/categories').then((r) => r.data);
export const fetchProducts = (category) =>
  api.get('/products', { params: category ? { category } : {} }).then((r) => r.data);

// Categories + products in one call, carrying the staleness flag the API sets
// when it is serving its last known-good snapshot because the database is
// unreachable. Shoppers can still browse in that state, but nothing can be
// ordered — so the UI has to be able to say so.
export const fetchCatalogSnapshot = async () => {
  const [cats, prods] = await Promise.all([api.get('/categories'), api.get('/products')]);
  const stale =
    cats.headers?.['x-catalog-stale'] === 'true' || prods.headers?.['x-catalog-stale'] === 'true';
  return {
    categories: cats.data,
    products: prods.data,
    stale,
    cachedAt: prods.headers?.['x-catalog-cached-at'] || cats.headers?.['x-catalog-cached-at'] || null,
  };
};

// ---- Customer auth (password based) ----
export const checkMobileExists = (mobile) =>
  api.get('/auth/exists', { params: { mobile } }).then((r) => r.data.exists);
// Register a first-time user: { mobile, username, password }.
export const registerUser = (payload) =>
  api.post('/auth/register', payload, { timeout: AUTH_TIMEOUT }).then((r) => r.data);
// Log in a returning user: { identifier (mobile or username), password }.
export const loginUser = (payload) =>
  api.post('/auth/login', payload, { timeout: AUTH_TIMEOUT }).then((r) => r.data);
// Password reset, step 1: confirm the account exists before asking for a new
// password. Rejects with a 404 when there is no such mobile/username.
export const lookupResetAccount = (identifier) =>
  api.post('/auth/reset/lookup', { identifier }, { timeout: AUTH_TIMEOUT }).then((r) => r.data);
// Password reset, step 2: { identifier, password, confirmPassword }.
export const resetPassword = (payload) =>
  api.post('/auth/reset', payload, { timeout: AUTH_TIMEOUT }).then((r) => r.data);

// ---- Orders ----
export const placeOrder = (payload) => api.post('/orders', payload).then((r) => r.data);
// Customer's own orders (requires a logged-in user token).
export const fetchMyOrders = () => api.get('/orders/mine').then((r) => r.data);
// Customer self-cancellation within the 1-hour window (server-enforced).
export const cancelMyOrder = (id, reason) =>
  api.post(`/orders/${id}/cancel`, { reason }).then((r) => r.data);

// ---- Admin ----
export const adminLogin = (payload) =>
  api.post('/admin/login', payload, { timeout: AUTH_TIMEOUT }).then((r) => r.data);
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
// Registered customers, with each one's order history summarised.
export const adminFetchUsers = () => api.get('/admin/users').then((r) => r.data);
// Unified order update: pass any subset of { status, deliveryDay, deliveryDate, paymentStatus }.
export const adminUpdateOrder = (id, patch) =>
  api.patch(`/admin/orders/${id}`, patch).then((r) => r.data);
export const adminUpdateOrderStatus = (id, status) => adminUpdateOrder(id, { status });
