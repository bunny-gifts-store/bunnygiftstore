import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { config, PROJECT_ROOT } from './config.js';
import { persistence, dbStatus } from './db.js';
import { seedStatus } from './seed.js';
import { catalogCacheStatus } from './catalogCache.js';
import { usingCloudinary } from './storage.js';
import authRoutes from './routes/auth.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import adminRoutes from './routes/admin.routes.js';

// NOTE: neither the schema nor the seed runs here. Both are kicked off by
// server.js AFTER the HTTP port is open, because they are network round trips to
// Postgres — running them before app.listen() delays (or, if the database is
// unreachable, permanently prevents) the port opening, which fails the health
// check and leaves the API answering nothing at all.

const app = express();
app.set('trust proxy', 1);

// CORS: the API uses bearer-token auth (no cookies), so reflecting any origin
// is safe. This avoids http/https/www mismatches from the static frontend host.
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// (There is no post-request flush step any more. That existed to fold SQLite's
// write-ahead log into the .db file; Postgres commits are durable on the server
// the moment the query returns, with nothing local left to check point.)

// Basic rate limiting on auth to slow brute-force on the admin login.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

// Cheapest possible liveness endpoint: no database, no JSON building of any
// consequence, never rate limited. This is what the keep-alive pinger and the
// browser's warm-up call hit, so waking a sleeping instance costs one trivial
// request and can't be blocked by a database problem.
app.get('/api/ping', (_req, res) => res.type('text/plain').send('ok'));

// Deliberately touches NO database. A health check that queries the database
// reports "unhealthy" during a database outage and gets the whole service
// restarted or marked down, which is precisely when you most need it to answer.
// It reports the database's state as data instead.
app.get('/api/health', (_req, res) => res.json({
  ok: true,
  message: 'Bunny Gift Store API is live',
  // Surface persistence so a misconfigured (data-losing) deploy is visible.
  persistence: { mode: persistence.mode, durable: persistence.durable },
  // Schema readiness: `ready:false` with an `error` means the API is up but the
  // database is unreachable — the one thing worth knowing during an incident.
  db: { ready: dbStatus.ready, error: dbStatus.error, attempts: dbStatus.attempts, ms: dbStatus.ms },
  // Whether product images are stored durably (Cloudinary) or on ephemeral disk.
  images: { durable: usingCloudinary, store: usingCloudinary ? 'cloudinary' : 'local-disk' },
  // Surface the last seed outcome (counts + first failure) so the state of the
  // catalogue — and any seeding error — is verifiable without server logs.
  seed: seedStatus,
  // Whether the storefront can still be browsed if the database is unreachable.
  catalogCache: catalogCacheStatus(),
}));

// Guard every data route until the schema exists. Without this, requests
// arriving during a database outage each sit on a connection attempt that will
// not succeed, piling up until the pool is exhausted and the API stops answering
// anything at all. A fast, explicit 503 keeps it responsive and tells the client
// what is actually wrong.
//
// The message distinguishes the two cases deliberately. Telling someone to
// "try again in a few seconds" during an hour-long database outage is not a
// harmless inaccuracy — it makes them retry a login that cannot succeed, and it
// hides a real incident behind routine-sounding text.
const BOOT_GRACE_MS = 60_000;
const bootedAt = Date.now();

const requireDb = (_req, res, next) => {
  if (dbStatus.ready) return next();

  const stillStarting = !dbStatus.error && Date.now() - bootedAt < BOOT_GRACE_MS;
  res.set('Retry-After', stillStarting ? '10' : '60').status(503).json({
    error: stillStarting
      ? 'The store is starting up. Please try again in a few seconds.'
      : 'The store is temporarily unavailable while we restore our database. '
        + 'Your account and past orders are safe — please try again a little later.',
    detail: dbStatus.error || 'Database is initialising.',
  });
};

// MOUNTED FIRST, and intentionally NOT gated by requireDb: the catalogue falls
// back to the last known-good snapshot so the storefront stays browsable during
// a database outage.
//
// Order matters. `app.use('/api', requireDb, authRoutes)` below applies
// requireDb to EVERY path under /api, not just the ones authRoutes handles, so
// mounting the catalogue after it would let that gate 503 these routes before
// they ever run. Requests the catalogue doesn't handle fall through untouched.
app.use('/api', catalogRoutes);                // /api/categories, /api/products

app.use('/api/auth', authLimiter, requireDb, authRoutes);
// Admin login lives under /api/admin/login but is defined in authRoutes.
app.use('/api', requireDb, authRoutes);        // exposes /api/admin/login, /api/admin/change-password
app.use('/api/orders', requireDb, ordersRoutes);
app.use('/api/admin', requireDb, adminRoutes); // protected CRUD

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
