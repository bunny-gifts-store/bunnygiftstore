import Database from 'libsql';
import AsyncDatabase from 'libsql/promise';
import fs from 'fs';
import { config } from './config.js';

// Ensure uploads dir exists.
fs.mkdirSync(config.uploadsDir, { recursive: true });

// ---------------------------------------------------------------------------
// Persistence via Turso (libSQL).
//
// `libsql` is a drop-in, better-sqlite3-compatible synchronous driver, so every
// existing `db.prepare(...).get()/.all()/.run()` call keeps working unchanged.
//
//   - Production (Turso env vars set): every read and write goes to the same
//     remote primary, so it is strongly consistent (read-your-writes) and
//     survives the host's ephemeral filesystem.
//   - Local dev (no Turso env vars): a plain local SQLite file, behaving exactly
//     like the previous better-sqlite3 setup.
// ---------------------------------------------------------------------------
const syncUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
export const usingTurso = Boolean(syncUrl && authToken);

// Connect DIRECTLY to the Turso primary (remote-only) when configured — every
// read and write goes to the same remote database, so it is strongly consistent
// (read-your-writes) with nothing to fall out of sync.
//
// We deliberately do NOT use an embedded replica here. In replica mode reads
// come from a local copy that only converges with the primary on db.sync(), so
// freshly written rows (seeded products, new users, placed orders) were invisible
// to the next read — that's why the catalog showed 0 products while categories
// (written earlier) had already synced in. Remote-only trades a little read
// latency (a network hop per query) for correctness, which is the right call for
// a low-traffic store where data integrity is what matters.
export const db = usingTurso
  ? new Database(syncUrl, { authToken })
  : new Database(config.dbPath);

if (!usingTurso) {
  // WAL keeps committed transactions in a side file (bunnystore.db-wal) and only
  // folds them into bunnystore.db at a CHECKPOINT — by default once the log grows
  // past ~1000 pages, or on a clean close. No data is ever lost (SQLite replays
  // the WAL on the next open), but the .db file ON ITS OWN lags behind the live
  // app, so opening/copying just that file shows stale, incomplete data.
  // persist() below closes that gap after every write.
  //
  // These are local-file pragmas: instant, no network. The Turso equivalent runs
  // inside initSchema() instead, because against a remote primary even a PRAGMA
  // is a network round trip and MUST NOT happen at import time — see below.
  db.pragma('journal_mode = WAL');
  // fsync every commit: an acknowledged order can't be lost to a crash/power cut.
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');
}

// Fold the write-ahead log into the main .db file so the file on disk is a
// complete, self-contained snapshot of the live application state.
//
// This is what makes `server/bunnystore.db` directly inspectable (and editable)
// at any moment with any SQLite tool — including ones that ignore the -wal
// sidecar, and including a plain file copy. app.js calls it after every request
// that changes data, so no write path can forget it.
//
// TRUNCATE (rather than PASSIVE) also resets the -wal file to zero bytes, so a
// non-empty sidecar is a reliable signal that something still needs flushing.
export function persist() {
  // Turso: writes go straight to the remote primary, which is already durable —
  // there is no local log to check point.
  if (usingTurso) return;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    // A checkpoint can be skipped if another connection holds a read lock; the
    // data stays safely committed in the WAL and the next call folds it in.
    console.error('[persist] WAL checkpoint failed:', err.message);
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile       TEXT NOT NULL UNIQUE,
    username     TEXT NOT NULL,
    passwordHash TEXT,
    createdAt    TEXT DEFAULT CURRENT_TIMESTAMP
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
    createdAt     TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt     TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Audit trail of every admin operation (logins, catalogue CRUD, order
  -- changes). Two jobs: it makes admin activity reviewable long after the fact,
  -- and its JSON "details" keeps a record of DELETED rows, which would otherwise
  -- leave no trace in the database at all.
  CREATE TABLE IF NOT EXISTS admin_activity (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    adminId   INTEGER,
    username  TEXT,
    action    TEXT NOT NULL,   -- e.g. product.create, order.update, admin.login
    entity    TEXT,            -- product | category | order | admin
    entityId  INTEGER,
    details   TEXT,            -- JSON: what changed (and full row on delete)
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(userId);
  CREATE INDEX IF NOT EXISTS idx_activity_created ON admin_activity(createdAt);
`;

// Columns added after the original schema shipped. The CREATE TABLE above only
// runs for a brand-new table, so each is applied defensively to databases that
// already exist (including an already-provisioned Turso primary).
//
// `backfill` runs once, immediately after its column is added.
const MIGRATIONS = [
  { table: 'users', column: 'passwordHash', ddl: `ALTER TABLE users ADD COLUMN passwordHash TEXT` },

  { table: 'orders', column: 'userId', ddl: `ALTER TABLE orders ADD COLUMN userId INTEGER` },
  { table: 'orders', column: 'items', ddl: `ALTER TABLE orders ADD COLUMN items TEXT` },
  { table: 'orders', column: 'status', ddl: `ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'` },
  // Order-management additions (payment + delivery scheduling).
  { table: 'orders', column: 'paymentStatus', ddl: `ALTER TABLE orders ADD COLUMN paymentStatus TEXT DEFAULT 'paid'` },
  { table: 'orders', column: 'deliveryDay', ddl: `ALTER TABLE orders ADD COLUMN deliveryDay TEXT` },
  { table: 'orders', column: 'deliveryDate', ddl: `ALTER TABLE orders ADD COLUMN deliveryDate TEXT` },
  // Refund management for cancelled orders (refund is processed manually
  // outside the system, e.g. via the owner's PhonePe, and recorded here).
  { table: 'orders', column: 'refundStatus', ddl: `ALTER TABLE orders ADD COLUMN refundStatus TEXT` },
  { table: 'orders', column: 'refundNote', ddl: `ALTER TABLE orders ADD COLUMN refundNote TEXT` },
  { table: 'orders', column: 'refundUpdatedAt', ddl: `ALTER TABLE orders ADD COLUMN refundUpdatedAt TEXT` },
  { table: 'orders', column: 'cancellationReason', ddl: `ALTER TABLE orders ADD COLUMN cancellationReason TEXT` },
  {
    table: 'orders', column: 'cancelledAt',
    ddl: `ALTER TABLE orders ADD COLUMN cancelledAt TEXT`,
    // Backfill already-cancelled orders with a best-effort timestamp so they
    // still show a cancellation date (refund time if set, else the order date).
    backfill: `UPDATE orders SET cancelledAt = COALESCE(refundUpdatedAt, createdAt)
               WHERE status = 'cancelled' AND cancelledAt IS NULL`,
  },
  {
    table: 'orders', column: 'cancelledBy',
    ddl: `ALTER TABLE orders ADD COLUMN cancelledBy TEXT`,
    // Existing cancelled orders were all cancelled from the admin panel.
    backfill: `UPDATE orders SET cancelledBy = 'admin' WHERE status = 'cancelled' AND cancelledBy IS NULL`,
  },
  {
    // Last-modified stamp, maintained on every order update so the admin's
    // changes (status, delivery schedule, refund) are traceable in the database.
    table: 'orders', column: 'updatedAt',
    // No DEFAULT here: SQLite rejects a non-constant default in ALTER TABLE ADD
    // COLUMN, so backfill existing rows from createdAt instead.
    ddl: `ALTER TABLE orders ADD COLUMN updatedAt TEXT`,
    backfill: `UPDATE orders SET updatedAt = createdAt WHERE updatedAt IS NULL`,
  },
];

// ---------------------------------------------------------------------------
// Readiness.
//
// Schema creation + migrations are NOT run at import time. Against Turso every
// one of those statements is a network round trip, and the synchronous driver
// blocks the Node event loop while it waits. Doing that during module import —
// i.e. before server.js reaches app.listen() — means a slow or unreachable
// database prevents the HTTP port from EVER opening: the platform's health
// check gets no response, the deployed API answers nothing at all, and the site
// hangs on "Signing in…" with no error to diagnose. That is exactly the failure
// this split exists to prevent.
//
// server.js now opens the port first and calls initSchema() afterwards, so the
// API is always reachable and its true state is visible on /api/health.
// ---------------------------------------------------------------------------
export const dbStatus = {
  ready: false,
  error: null,
  attempts: 0,
  ms: null,
};

// Uniform read/exec helpers over either driver: the sync one for a local file
// (instant, no network) and the promise one for Turso (so a slow primary can
// never block the event loop and stall health checks).
function makeRunner() {
  if (!usingTurso) {
    return {
      exec: async (sql) => db.exec(sql),
      columns: async (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name),
      close: async () => {},
    };
  }
  const adb = new AsyncDatabase(syncUrl, { authToken });
  return {
    exec: async (sql) => adb.exec(sql),
    columns: async (table) => {
      const stmt = await adb.prepare(`PRAGMA table_info(${table})`);
      const rows = await stmt.all();
      return rows.map((c) => c.name);
    },
    close: async () => { try { await adb.close(); } catch { /* best effort */ } },
  };
}

/**
 * Create the schema and apply pending column migrations.
 *
 * Safe to call repeatedly (everything is IF NOT EXISTS / column-guarded), and
 * safe to fail: it records the problem on `dbStatus` and resolves false rather
 * than throwing, so a database outage degrades the API instead of killing it.
 */
export async function initSchema() {
  const startedAt = Date.now();
  dbStatus.attempts += 1;
  const runner = makeRunner();
  try {
    if (usingTurso) {
      // Remote equivalent of the local pragmas above. Not supported on every
      // remote, so never fatal.
      try { await runner.exec('PRAGMA foreign_keys = ON'); } catch { /* ignore */ }
    }

    await runner.exec(SCHEMA);

    // PRAGMA table_info is one round trip per table — read each table's columns
    // once and reuse the list for all of its migrations.
    const columnCache = new Map();
    for (const m of MIGRATIONS) {
      if (!columnCache.has(m.table)) columnCache.set(m.table, await runner.columns(m.table));
      const columns = columnCache.get(m.table);
      if (columns.includes(m.column)) continue;
      await runner.exec(m.ddl);
      if (m.backfill) await runner.exec(m.backfill);
      columns.push(m.column);
    }

    // Fold the schema creation/migration into the .db file straight away, so a
    // freshly provisioned database is complete on disk before serving traffic.
    persist();

    dbStatus.ready = true;
    dbStatus.error = null;
    dbStatus.ms = Date.now() - startedAt;
    console.log(`[db] Schema ready in ${dbStatus.ms}ms (${persistence.mode}).`);
    return true;
  } catch (err) {
    dbStatus.ready = false;
    dbStatus.error = err.message;
    dbStatus.ms = Date.now() - startedAt;
    console.error(`[db] Schema init FAILED after ${dbStatus.ms}ms:`, err.message);
    return false;
  } finally {
    await runner.close();
  }
}

// ---------------------------------------------------------------------------
// Recovery.
//
// A remote database can fail at any time, not just at boot — which is exactly
// what a flapping provider looks like. Recovery therefore lives here rather
// than in the boot path, so ANY code that discovers a broken connection can
// re-arm it by calling markDbUnavailable(). Previously only a failed *initial*
// connection scheduled retries: a database that died after a successful boot
// left the API degraded until someone restarted it by hand.
// ---------------------------------------------------------------------------
const RECOVERY_MIN_MS = 5_000;
const RECOVERY_MAX_MS = 60_000;

let recoveryTimer = null;
let recoveryDelay = RECOVERY_MIN_MS;
let onReady = null;

/** Register work to run whenever the database becomes usable (e.g. seeding). */
export function setDbReadyHook(fn) {
  onReady = fn;
}

/**
 * Report that the connection is broken and make sure recovery is running.
 * Safe to call repeatedly and from anywhere — it de-duplicates.
 */
export function markDbUnavailable(message) {
  if (dbStatus.ready) console.error('[db] Connection lost:', message);
  dbStatus.ready = false;
  dbStatus.error = message;
  scheduleRecovery();
}

/** Keep retrying initSchema() with a backoff until the database answers. */
export function scheduleRecovery() {
  if (recoveryTimer || dbStatus.ready) return;

  const delay = recoveryDelay;
  recoveryDelay = Math.min(recoveryDelay * 2, RECOVERY_MAX_MS);
  console.log(`[db] Retrying database connection in ${Math.round(delay / 1000)}s…`);

  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null;
    if (await initSchema()) {
      recoveryDelay = RECOVERY_MIN_MS; // reset, so a later failure retries fast again
      console.log('[db] Database recovered.');
      try {
        onReady?.();
      } catch (err) {
        console.error('[db] Post-recovery hook failed:', err.message);
      }
    } else {
      scheduleRecovery();
    }
  }, delay);
  // Don't hold the process open for a retry; the HTTP server keeps it alive.
  recoveryTimer.unref?.();
}

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
  mode: usingTurso ? 'turso-remote' : 'local-sqlite-file',
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

export default db;
