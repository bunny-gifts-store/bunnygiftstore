import Database from 'libsql';
import fs from 'fs';
import { config } from './config.js';

// Ensure uploads dir exists.
fs.mkdirSync(config.uploadsDir, { recursive: true });

// ---------------------------------------------------------------------------
// Persistence via Turso (libSQL) — an EMBEDDED REPLICA.
//
// `libsql` is a drop-in, better-sqlite3-compatible synchronous driver, so every
// existing `db.prepare(...).get()/.all()/.run()` call keeps working unchanged.
//
//   - Production (Turso env vars set): the DB is a local SQLite file that syncs
//     with a remote Turso primary. Reads are served locally (fast, synchronous);
//     writes are forwarded to the primary. The local file is disposable — on an
//     ephemeral host (e.g. Render free tier) it is recreated and re-synced from
//     Turso on every boot, so users / orders / products PERSIST across restarts
//     instead of being wiped overnight.
//   - Local dev (no Turso env vars): falls back to a plain local SQLite file,
//     behaving exactly like the previous better-sqlite3 setup.
// ---------------------------------------------------------------------------
const syncUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
export const usingTurso = Boolean(syncUrl && authToken);

export const db = usingTurso
  ? new Database(config.dbPath, {
      syncUrl,
      authToken,
      // Pull remote changes in the background every N seconds (0/undefined = off).
      syncInterval: Number(process.env.TURSO_SYNC_INTERVAL) || 60,
    })
  : new Database(config.dbPath);

if (usingTurso) {
  // Pull the latest schema + data from the Turso primary BEFORE running the
  // migrations/seed below, so existing data is visible and the seed correctly
  // skips re-inserting products.
  try {
    db.sync();
    console.log('[turso] Embedded replica synced with remote primary.');
  } catch (err) {
    console.error('[turso] Initial sync failed:', err.message);
  }
  // WAL is managed internally by libSQL for replicas; only foreign keys matter
  // here (for our ON DELETE behaviour).
  try { db.pragma('foreign_keys = ON'); } catch { /* non-critical on replicas */ }
} else {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile    TEXT NOT NULL UNIQUE,
    username  TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    createdAt    TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL UNIQUE,
    slug      TEXT NOT NULL UNIQUE,
    sortOrder INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    price       REAL,
    priceLabel  TEXT,
    categoryId  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    image       TEXT,
    sizeOptions TEXT,               -- JSON array for frame-style variable pricing (nullable)
    outOfStock  INTEGER DEFAULT 0,  -- 0/1
    unavailable INTEGER DEFAULT 0,  -- 0/1 (hidden from storefront)
    sortOrder   INTEGER DEFAULT 0,
    createdAt   TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    userId        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL,
    phone         TEXT NOT NULL,
    address       TEXT NOT NULL,
    city          TEXT NOT NULL,
    state         TEXT NOT NULL,
    pincode       TEXT NOT NULL,
    transactionId TEXT NOT NULL,
    totalAmount   REAL NOT NULL,
    totalItems    INTEGER NOT NULL,
    items         TEXT,             -- JSON snapshot of cart items
    status        TEXT DEFAULT 'pending',  -- pending|confirmed|processing|packed|out_for_delivery|delivered|cancelled
    paymentStatus TEXT DEFAULT 'paid',     -- paid | pending | failed | refunded
    deliveryDay   TEXT,             -- owner's planned delivery day, e.g. "Monday" or "3-5 days"
    deliveryDate  TEXT,             -- owner's planned delivery date, e.g. "2026-07-20"
    refundStatus  TEXT,             -- for cancelled orders: pending|successful|failed (manual refund)
    refundNote    TEXT,             -- optional refund transaction details / note
    refundUpdatedAt TEXT,           -- when the refund status was last set by the admin
    cancellationReason TEXT,        -- required when an order is cancelled
    cancelledAt   TEXT,             -- system timestamp when the order was cancelled
    cancelledBy   TEXT,             -- who cancelled: 'user' | 'admin'
    createdAt     TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId);
`);

// ---------------------------------------------------------------------------
// Persistence self-check.
//
// Data loss ("products/users disappear after some time") happens when the API
// runs on an EPHEMERAL filesystem (e.g. Render's free tier) using the plain
// local SQLite file: every restart/sleep wipes the file, the schema is
// recreated, and the seed repopulates only the built-in catalogue — so
// admin-added products, registered users and their orders all vanish.
//
// The durable fix is Turso (env vars above). When it is NOT configured on a
// production-like host we make the problem impossible to miss: a loud boot-time
// warning, and (opt-in) a hard refusal so a misconfigured deploy can't quietly
// take real orders onto disposable storage.
// ---------------------------------------------------------------------------
export const persistence = {
  mode: usingTurso ? 'turso-embedded-replica' : 'local-sqlite-file',
  durable: usingTurso,
  dbPath: config.dbPath,
};

const isProdLike = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
if (!usingTurso && isProdLike) {
  const banner = '='.repeat(74);
  const message = [
    '',
    banner,
    '[persistence] ⚠  DURABLE STORAGE IS NOT CONFIGURED — DATA WILL BE LOST.',
    '',
    '  This host looks like production but is using the local SQLite file:',
    `    ${config.dbPath}`,
    '  On an ephemeral filesystem this file is wiped on every restart/sleep,',
    '  deleting all registered users, orders and admin-added products.',
    '',
    '  Fix (free): set these env vars to use Turso, then redeploy —',
    '    TURSO_DATABASE_URL=libsql://<your-db>.turso.io',
    '    TURSO_AUTH_TOKEN=<token>',
    '  Setup:  turso db create bunnygiftstore',
    '          turso db show bunnygiftstore --url',
    '          turso db tokens create bunnygiftstore',
    '',
    '  To intentionally allow ephemeral storage (e.g. a throwaway demo) set',
    '  ALLOW_EPHEMERAL_DB=1 to silence this and skip the safety refusal below.',
    banner,
    '',
  ].join('\n');

  if (process.env.ALLOW_EPHEMERAL_DB === '1') {
    console.warn(message);
  } else {
    console.error(message);
    console.error('[persistence] Refusing to start on ephemeral storage without ALLOW_EPHEMERAL_DB=1.');
    // Exit so the misconfiguration is caught during deploy rather than after
    // customers have placed orders that later disappear.
    process.exit(1);
  }
}

// The original orders table (from the previous version) may lack the newer
// columns. Add them defensively so existing databases keep working.
const orderCols = db.prepare(`PRAGMA table_info(orders)`).all().map((c) => c.name);
if (!orderCols.includes('userId')) {
  db.exec(`ALTER TABLE orders ADD COLUMN userId INTEGER`);
}
if (!orderCols.includes('items')) {
  db.exec(`ALTER TABLE orders ADD COLUMN items TEXT`);
}
if (!orderCols.includes('status')) {
  db.exec(`ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'`);
}
// Order-management additions (payment + delivery scheduling).
if (!orderCols.includes('paymentStatus')) {
  db.exec(`ALTER TABLE orders ADD COLUMN paymentStatus TEXT DEFAULT 'paid'`);
}
if (!orderCols.includes('deliveryDay')) {
  db.exec(`ALTER TABLE orders ADD COLUMN deliveryDay TEXT`);
}
if (!orderCols.includes('deliveryDate')) {
  db.exec(`ALTER TABLE orders ADD COLUMN deliveryDate TEXT`);
}
// Refund management for cancelled orders (refund is processed manually
// outside the system, e.g. via the owner's PhonePe, and recorded here).
if (!orderCols.includes('refundStatus')) {
  db.exec(`ALTER TABLE orders ADD COLUMN refundStatus TEXT`);
}
if (!orderCols.includes('refundNote')) {
  db.exec(`ALTER TABLE orders ADD COLUMN refundNote TEXT`);
}
if (!orderCols.includes('refundUpdatedAt')) {
  db.exec(`ALTER TABLE orders ADD COLUMN refundUpdatedAt TEXT`);
}
if (!orderCols.includes('cancellationReason')) {
  db.exec(`ALTER TABLE orders ADD COLUMN cancellationReason TEXT`);
}
if (!orderCols.includes('cancelledAt')) {
  db.exec(`ALTER TABLE orders ADD COLUMN cancelledAt TEXT`);
  // Backfill already-cancelled orders with a best-effort timestamp so they
  // still show a cancellation date (refund time if set, else the order date).
  db.exec(`
    UPDATE orders
    SET cancelledAt = COALESCE(refundUpdatedAt, createdAt)
    WHERE status = 'cancelled' AND cancelledAt IS NULL
  `);
}
if (!orderCols.includes('cancelledBy')) {
  db.exec(`ALTER TABLE orders ADD COLUMN cancelledBy TEXT`);
  // Existing cancelled orders were all cancelled from the admin panel.
  db.exec(`UPDATE orders SET cancelledBy = 'admin' WHERE status = 'cancelled' AND cancelledBy IS NULL`);
}

export default db;
