import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { config, PROJECT_ROOT } from './config.js';
import { persistence, persist } from './db.js';
import { seedStatus } from './seed.js';
import { usingCloudinary } from './storage.js';
import authRoutes from './routes/auth.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import adminRoutes from './routes/admin.routes.js';

// NOTE: seeding is intentionally NOT run here. It is kicked off by server.js
// AFTER the HTTP port is open, because the first-boot seed writes ~100 rows to
// the remote Turso primary one round-trip at a time — running it before
// app.listen() would delay the port opening and fail Render's health check.

const app = express();
app.set('trust proxy', 1);

// CORS: the API uses bearer-token auth (no cookies), so reflecting any origin
// is safe. This avoids http/https/www mismatches from the static frontend host.
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// Flush every data-changing request into the main .db file.
//
// SQLite has already COMMITTED the write by this point — nothing can be lost —
// but in WAL mode the committed rows sit in bunnystore.db-wal until a
// checkpoint. Doing it here, once, for every mutating method means no individual
// route can forget to (three of them previously did), so the database file on
// disk always reflects the live application's state.
//
// It runs on 'finish' — after the response has been flushed — so the checkpoint
// never adds latency to the request. The file therefore trails an acknowledged
// write by well under a millisecond, not by a request.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  // Unconditional: a request that failed part-way may still have committed rows,
  // and checkpointing an empty log costs nothing.
  res.on('finish', persist);
  next();
});

// Basic rate limiting on auth to slow brute-force on the admin login.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  message: 'Bunny Gift Store API is live',
  // Surface persistence so a misconfigured (data-losing) deploy is visible.
  persistence: { mode: persistence.mode, durable: persistence.durable },
  // Whether product images are stored durably (Cloudinary) or on ephemeral disk.
  images: { durable: usingCloudinary, store: usingCloudinary ? 'cloudinary' : 'local-disk' },
  // Surface the last seed outcome (counts + first failure) so the state of the
  // catalogue — and any seeding error — is verifiable without server logs.
  seed: seedStatus,
}));

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
