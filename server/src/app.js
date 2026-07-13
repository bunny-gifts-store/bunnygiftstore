import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { config, PROJECT_ROOT } from './config.js';
import './db.js';
import { seedDatabase } from './seed.js';
import authRoutes from './routes/auth.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import adminRoutes from './routes/admin.routes.js';

seedDatabase();

const app = express();
app.set('trust proxy', 1);

// CORS: restrict to configured origins in prod, allow all in dev.
app.use(cors(config.corsOrigins.length ? { origin: config.corsOrigins } : {}));
app.use(express.json({ limit: '1mb' }));

// Basic rate limiting on auth to slow brute-force on the admin login.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

app.get('/api/health', (_req, res) => res.json({ ok: true, message: 'Bunny Gift Store API is live' }));

app.use('/api/auth', authLimiter, authRoutes);
// Admin login lives under /api/admin/login but is defined in authRoutes.
app.use('/api', authRoutes);        // exposes /api/admin/login, /api/admin/change-password
app.use('/api', catalogRoutes);     // /api/categories, /api/products
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', adminRoutes); // protected CRUD

// Serve uploaded item images.
app.use('/uploads', express.static(config.uploadsDir));

// Serve the bundled storefront images/css/js so a single Node host can serve
// both the API and the existing static assets when needed.
app.use('/images', express.static(path.join(PROJECT_ROOT, 'images')));

// Serve the built React app (client/dist) if present; otherwise fall back to
// the legacy static storefront at project root. SPA fallback to index.html.
const clientDist = path.join(PROJECT_ROOT, 'client', 'dist');
const hasBuild = fs.existsSync(path.join(clientDist, 'index.html'));
const staticRoot = hasBuild ? clientDist : PROJECT_ROOT;
app.use(express.static(staticRoot));

app.get(/^\/(?!api|uploads).*/, (_req, res) => {
  res.sendFile(path.join(staticRoot, 'index.html'));
});

// 404 for unknown API routes.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (err.message?.includes('image') ? 400 : 500);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

export default app;
