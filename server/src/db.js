import pg from 'pg';
import fs from 'fs';
import { config } from './config.js';

// Ensure uploads dir exists.
fs.mkdirSync(config.uploadsDir, { recursive: true });

// ---------------------------------------------------------------------------
// Persistence via PostgreSQL.
//
// The API runs on hosting with an EPHEMERAL filesystem, so the database has to
// live outside the container or every restart wipes users, orders and any
// product the admin added. A managed Postgres (Neon, Supabase, Render Postgres,
// …) is that external home: one connection string, and the data outlives the
// service.
//
// Everything below goes through a single pool, and every read and write hits
// the same database — so it is strongly consistent (read-your-writes) with
// nothing to fall out of sync.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Driver selection.
//
// Normally this is plain `pg` over TCP (port 5432) — what the deployed API uses.
//
// PG_HTTP=1 switches to Neon's HTTPS driver instead. That exists for ONE reason:
// many corporate networks block outbound 5432, which makes the local database
// tooling (migrate / db:pull / db:restore) unable to reach a hosted database at
// all, while port 443 is open. It is a workaround for running those scripts from
// a restricted network — the server itself has no need for it, and Render does
// not block 5432.
//
// The import is dynamic and only happens when the flag is set, so
// @neondatabase/serverless never has to be installed for normal operation.
// ---------------------------------------------------------------------------
const useHttpDriver = process.env.PG_HTTP === '1';

let Pool = pg.Pool;
const { types } = pg;

if (useHttpDriver) {
  try {
    const neon = await import('@neondatabase/serverless');
    // Route pool.query() through HTTPS fetch rather than a WebSocket, so no
    // extra ws dependency is needed.
    neon.neonConfig.poolQueryViaFetch = true;
    // That driver is a fork of pg with its OWN type registry, so pg's parsers
    // below do not apply to it — register them here too, or COUNT(*) comes back
    // as the string "0", which is truthy and would skip the seed.
    neon.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
    neon.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
    Pool = neon.Pool;
    console.log('[db] Using the HTTPS driver (PG_HTTP=1) — for restricted networks only.');
  } catch {
    console.error('[db] PG_HTTP=1 needs the HTTPS driver:  npm install --no-save @neondatabase/serverless');
    process.exit(1);
  }
}

// node-postgres hands back int8 (BIGINT) and numeric as STRINGS, because they
// can exceed what a JS number holds exactly. Every such value here is a row
// count, an id or a rupee amount — all far inside the safe range — and the rest
// of the app does arithmetic and `!!` checks on them. Parsing them to numbers
// here keeps row shapes identical to what the code already expects; without it
// `COUNT(*)` comes back as "0", which is truthy, and the seed would never run.
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));    // int8
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));  // numeric

const connectionString = process.env.DATABASE_URL || '';
export const hasDatabaseUrl = Boolean(connectionString);

// TLS.
//
// node-postgres parses the connection string LAST and its result overrides
// options passed alongside it, so a URL ending in `?sslmode=require` silently
// wins over an `ssl` option set here. Rather than set one and have the other
// take effect, defer to the URL whenever it says anything about SSL — the
// effective setting is then the one written in DATABASE_URL, which is the one
// someone reading the config would expect.
//
// With no sslmode in the URL we pick a sensible default: encrypted for remote
// hosts (without demanding a chain Node may not have), and off for a local
// database, which needs no TLS at all.
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
const sslDisabled = process.env.PGSSLMODE === 'disable';
const urlSpecifiesSsl = /[?&]sslmode=/i.test(connectionString);

// undefined = "say nothing", leaving the URL's own sslmode in charge.
const sslOption = sslDisabled ? false
  : urlSpecifiesSsl ? undefined
  : isLocal ? false
  : { rejectUnauthorized: false };

export const pool = hasDatabaseUrl
  ? new Pool({
      connectionString,
      ssl: sslOption,
      // Free tiers cap connections hard, and this API is low traffic — a small
      // pool avoids exhausting the allowance while still serving concurrently.
      max: Number(process.env.PGPOOL_MAX) || 5,
      idleTimeoutMillis: 30_000,
      // Fail a stalled connect attempt rather than hanging a request forever.
      connectionTimeoutMillis: 10_000,
    })
  : null;

// A pooled connection can die between queries (provider restart, idle timeout,
// network blip). Without this handler node-postgres emits an unhandled 'error'
// event and takes the whole process down — turning a recoverable database blip
// into an outage of the entire site.
pool?.on('error', (err) => {
  markDbUnavailable(`Connection pool error: ${err.message}`);
});

// Pin the connection to UTF-8. The catalogue contains characters outside
// Latin-1 — the rupee sign in every photo frame's "From ₹500" label, for one —
// and on a connection negotiated to a legacy encoding those INSERTs fail with
// "no equivalent in encoding WIN1252". The seed survives that (it logs and
// continues) but silently drops the affected products, so the storefront comes
// up missing a chunk of its catalogue. Being explicit costs nothing.
//
// NOTE: this fixes the CONNECTION, not the database. The database itself must
// also be created with UTF8 encoding — every managed provider does so by
// default, but a hand-rolled `createdb` on a non-UTF8 machine may not.
pool?.on('connect', (client) => {
  client.query("SET client_encoding TO 'UTF8'").catch(() => { /* server default stands */ });
});

// ---------------------------------------------------------------------------
// A minimal statement API over the pool.
//
// The routes were written against a synchronous, better-sqlite3-style driver:
// `db.prepare(sql).get(...) / .all(...) / .run(...)`. Postgres is async-only, so
// those calls are now awaited — but the SHAPE is kept deliberately, because it
// keeps every call site readable and the diff reviewable. What changed is one
// `await` per query, not the way the data layer is used.
//
// Two translations happen here so the SQL in the routes stays plain:
//   - `?` placeholders become $1, $2, … (string literals are skipped, so a `?`
//     inside quotes is left alone).
//   - INSERT statements get `RETURNING id`, which is how Postgres reports the
//     generated key — exposed as `lastInsertRowid` to match the old call sites.
// ---------------------------------------------------------------------------

/** Rewrite `?` placeholders to Postgres `$n`, ignoring any inside string literals. */
function toPositional(sql) {
  let out = '';
  let n = 0;
  let inString = false;      // '…'  a literal value
  let inIdentifier = false;  // "…"  a quoted column/table name

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (inString) {
      out += ch;
      if (ch !== "'") continue;
      // '' inside a string is an escaped quote, not the end of it.
      if (sql[i + 1] === "'") { out += sql[++i]; continue; }
      inString = false;
      continue;
    }

    if (inIdentifier) {
      out += ch;
      if (ch === '"') inIdentifier = false;
      continue;
    }

    if (ch === "'") { inString = true; out += ch; continue; }
    if (ch === '"') { inIdentifier = true; out += ch; continue; }
    if (ch === '?') { out += `$${++n}`; continue; }
    out += ch;
  }
  return out;
}

const isInsert = (sql) => /^\s*insert\b/i.test(sql);
const hasReturning = (sql) => /\breturning\b/i.test(sql);

/**
 * Run one statement. Any failure is reported to the recovery loop before it is
 * rethrown, so a database that dies mid-life reconnects on its own rather than
 * leaving the API degraded until someone restarts it by hand.
 */
async function execute(sql, params) {
  if (!pool) throw new Error('DATABASE_URL is not set — no database is configured.');
  try {
    return await pool.query(sql, params);
  } catch (err) {
    if (isConnectionError(err)) markDbUnavailable(err.message);
    throw err;
  }
}

// Connection-level failures mean "the database is gone" and should arm recovery.
// A constraint violation or a SQL typo means "this query was wrong" and must
// NOT — flagging those as an outage would 503 the whole store over one bad
// request.
function isConnectionError(err) {
  if (!err) return false;
  if (err.code && /^(08|57P0|53)/.test(err.code)) return true; // connection / shutdown / resource
  return ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE'].includes(err.code)
    || /timeout|terminat|connection/i.test(err.message || '');
}

export const db = {
  prepare(sql) {
    const text = toPositional(sql);
    const insertText = isInsert(text) && !hasReturning(text) ? `${text} RETURNING id` : text;
    return {
      /** First matching row, or undefined. */
      async get(...params) {
        const res = await execute(text, params);
        return res.rows[0];
      },
      /** All matching rows. */
      async all(...params) {
        const res = await execute(text, params);
        return res.rows;
      },
      /** Execute a write. Mirrors the old driver's `{ changes, lastInsertRowid }`. */
      async run(...params) {
        const res = await execute(insertText, params);
        return {
          changes: res.rowCount,
          lastInsertRowid: res.rows?.[0]?.id,
        };
      },
    };
  },

  /** Run raw SQL with no parameters (schema statements, migrations). */
  async exec(sql) {
    await execute(sql, []);
  },
};

// ---------------------------------------------------------------------------
// Schema.
//
// Identifiers are QUOTED wherever they are camelCase. Postgres folds unquoted
// identifiers to lower case, so an unquoted `passwordHash` column would be
// created as `passwordhash` and every row would come back with a key the rest of
// the app doesn't read. Quoting keeps the row shapes — and therefore the API
// responses the client already consumes — byte-for-byte what they were.
//
// Timestamps stay TEXT in the same 'YYYY-MM-DD HH:MM:SS' UTC form the app has
// always stored, so orderAgeMs() and the client's date parsing are unchanged.
// ---------------------------------------------------------------------------
const NOW_TEXT = `to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    mobile         TEXT NOT NULL UNIQUE,
    username       TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt"    TEXT DEFAULT ${NOW_TEXT}
  );

  CREATE TABLE IF NOT EXISTS admins (
    id             SERIAL PRIMARY KEY,
    username       TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "createdAt"    TEXT DEFAULT ${NOW_TEXT}
  );

  CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TEXT DEFAULT ${NOW_TEXT}
  );

  CREATE TABLE IF NOT EXISTS products (
    id            SERIAL PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    description   TEXT DEFAULT '',
    price         DOUBLE PRECISION,
    "priceLabel"  TEXT,
    "categoryId"  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    image         TEXT,
    "sizeOptions" TEXT,               -- JSON array for frame-style variable pricing (nullable)
    "outOfStock"  INTEGER DEFAULT 0,  -- 0/1
    unavailable   INTEGER DEFAULT 0,  -- 0/1 (hidden from storefront)
    "sortOrder"   INTEGER DEFAULT 0,
    "createdAt"   TEXT DEFAULT ${NOW_TEXT},
    "updatedAt"   TEXT DEFAULT ${NOW_TEXT}
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                   SERIAL PRIMARY KEY,
    "userId"             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name                 TEXT NOT NULL,
    email                TEXT NOT NULL,
    phone                TEXT NOT NULL,
    address              TEXT NOT NULL,
    city                 TEXT NOT NULL,
    state                TEXT NOT NULL,
    pincode              TEXT NOT NULL,
    "transactionId"      TEXT NOT NULL,
    "totalAmount"        DOUBLE PRECISION NOT NULL,
    "totalItems"         INTEGER NOT NULL,
    items                TEXT,             -- JSON snapshot of cart items
    status               TEXT DEFAULT 'pending',  -- pending|confirmed|processing|packed|out_for_delivery|delivered|cancelled
    "paymentStatus"      TEXT DEFAULT 'paid',     -- paid | pending | failed | refunded
    "deliveryDay"        TEXT,             -- owner's planned delivery day, e.g. "Monday" or "3-5 days"
    "deliveryDate"       TEXT,             -- owner's planned delivery date, e.g. "2026-07-20"
    "refundStatus"       TEXT,             -- for cancelled orders: pending|successful|failed (manual refund)
    "refundNote"         TEXT,             -- optional refund transaction details / note
    "refundUpdatedAt"    TEXT,             -- when the refund status was last set by the admin
    "cancellationReason" TEXT,             -- required when an order is cancelled
    "cancelledAt"        TEXT,             -- system timestamp when the order was cancelled
    "cancelledBy"        TEXT,             -- who cancelled: 'user' | 'admin'
    "createdAt"          TEXT DEFAULT ${NOW_TEXT},
    "updatedAt"          TEXT DEFAULT ${NOW_TEXT}
  );

  -- Audit trail of every admin operation (logins, catalogue CRUD, order
  -- changes). Two jobs: it makes admin activity reviewable long after the fact,
  -- and its JSON "details" keeps a record of DELETED rows, which would otherwise
  -- leave no trace in the database at all.
  CREATE TABLE IF NOT EXISTS admin_activity (
    id          SERIAL PRIMARY KEY,
    "adminId"   INTEGER,
    username    TEXT,
    action      TEXT NOT NULL,   -- e.g. product.create, order.update, admin.login
    entity      TEXT,            -- product | category | order | admin
    "entityId"  INTEGER,
    details     TEXT,            -- JSON: what changed (and full row on delete)
    "createdAt" TEXT DEFAULT ${NOW_TEXT}
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products("categoryId");
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders("userId");
  CREATE INDEX IF NOT EXISTS idx_activity_created ON admin_activity("createdAt");
`;

// Columns added after the original schema shipped. The CREATE TABLE above only
// runs for a brand-new table, so each is applied defensively to databases that
// already exist.
//
// `backfill` runs once, immediately after its column is added — the column check
// is what keeps it from re-running on every boot.
const MIGRATIONS = [
  {
    // Last-modified stamp, maintained on every order update so the admin's
    // changes (status, delivery schedule, refund) are traceable in the database.
    table: 'orders', column: 'updatedAt',
    ddl: `ALTER TABLE orders ADD COLUMN "updatedAt" TEXT`,
    backfill: `UPDATE orders SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL`,
  },
  {
    table: 'orders', column: 'cancelledAt',
    ddl: `ALTER TABLE orders ADD COLUMN "cancelledAt" TEXT`,
    // Backfill already-cancelled orders with a best-effort timestamp so they
    // still show a cancellation date (refund time if set, else the order date).
    backfill: `UPDATE orders SET "cancelledAt" = COALESCE("refundUpdatedAt", "createdAt")
               WHERE status = 'cancelled' AND "cancelledAt" IS NULL`,
  },
  {
    table: 'orders', column: 'cancelledBy',
    ddl: `ALTER TABLE orders ADD COLUMN "cancelledBy" TEXT`,
    // Existing cancelled orders were all cancelled from the admin panel.
    backfill: `UPDATE orders SET "cancelledBy" = 'admin' WHERE status = 'cancelled' AND "cancelledBy" IS NULL`,
  },
];

// ---------------------------------------------------------------------------
// Readiness.
//
// Schema creation + migrations are NOT run at import time. Every one of those
// statements is a network round trip, and doing that work during module import —
// i.e. before server.js reaches app.listen() — means a slow or unreachable
// database delays (or, if it never answers, permanently prevents) the HTTP port
// opening: the platform's health check gets no response, the deployed API
// answers nothing at all, and the site hangs on "Signing in…" with no error to
// diagnose. That is exactly the failure this split exists to prevent.
//
// server.js opens the port first and calls initSchema() afterwards, so the API
// is always reachable and its true state is visible on /api/health.
// ---------------------------------------------------------------------------
export const dbStatus = {
  ready: false,
  error: null,
  attempts: 0,
  ms: null,
};

/**
 * Split a SQL script into individual statements.
 *
 * The statements are run one at a time rather than as a single multi-statement
 * query, for two reasons: a failure then names the statement that actually
 * broke instead of the whole script, and the HTTPS driver above rejects
 * multi-statement queries outright ("cannot insert multiple commands into a
 * prepared statement").
 *
 * Quotes and `--` comments are tracked so a semicolon inside either is not
 * mistaken for a statement boundary.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let inIdentifier = false;
  let inComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (inComment) {
      if (ch === '\n') inComment = false;
      current += ch;
      continue;
    }
    if (inString) {
      current += ch;
      if (ch !== "'") continue;
      if (sql[i + 1] === "'") { current += sql[++i]; continue; }
      inString = false;
      continue;
    }
    if (inIdentifier) {
      current += ch;
      if (ch === '"') inIdentifier = false;
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') { inComment = true; current += ch; continue; }
    if (ch === "'") { inString = true; current += ch; continue; }
    if (ch === '"') { inIdentifier = true; current += ch; continue; }
    if (ch === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

/** Columns a table currently has, via the catalog (Postgres's PRAGMA equivalent). */
async function columnsOf(table) {
  const res = await execute(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = $1`,
    [table]
  );
  return res.rows.map((r) => r.column_name);
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

  if (!pool) {
    dbStatus.ready = false;
    dbStatus.error = 'DATABASE_URL is not set.';
    dbStatus.ms = 0;
    console.error('[db] DATABASE_URL is not set — no database configured. See README-APP.md.');
    return false;
  }

  try {
    for (const statement of splitStatements(SCHEMA)) {
      await execute(statement, []);
    }

    // One catalog lookup per table, reused across all of that table's migrations.
    const columnCache = new Map();
    for (const m of MIGRATIONS) {
      if (!columnCache.has(m.table)) columnCache.set(m.table, await columnsOf(m.table));
      const columns = columnCache.get(m.table);
      if (columns.includes(m.column)) continue;
      await execute(m.ddl, []);
      if (m.backfill) await execute(m.backfill, []);
      columns.push(m.column);
    }

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
  }
}

// ---------------------------------------------------------------------------
// Recovery.
//
// A hosted database can fail at any time, not just at boot — which is exactly
// what a flapping provider looks like. Recovery therefore lives here rather
// than in the boot path, so ANY code that discovers a broken connection can
// re-arm it by calling markDbUnavailable(). If only a failed *initial*
// connection scheduled retries, a database that died after a successful boot
// would leave the API degraded until someone restarted it by hand.
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
        await onReady?.();
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

/** Close the pool on shutdown so in-flight queries finish cleanly. */
export async function closeDb() {
  try { await pool?.end(); } catch { /* best effort */ }
}

// ---------------------------------------------------------------------------
// Persistence self-check.
//
// Data loss ("products/users disappear after some time") happens when the API
// runs on an EPHEMERAL filesystem with no external database: every restart or
// sleep wipes the container, so admin-added products, registered users and their
// orders all vanish.
//
// DATABASE_URL is what makes the data durable. When it is NOT configured on a
// production-like host we make the problem impossible to miss: a loud boot-time
// warning, and (unless explicitly opted out) a hard refusal, so a misconfigured
// deploy can't quietly take real orders into a database that isn't there.
// ---------------------------------------------------------------------------
export const persistence = {
  mode: hasDatabaseUrl ? 'postgres' : 'not-configured',
  durable: hasDatabaseUrl,
};

const isProdLike = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
if (!hasDatabaseUrl && isProdLike) {
  const banner = '='.repeat(74);
  const message = [
    '',
    banner,
    '[persistence] ⚠  DATABASE_URL IS NOT SET — THE STORE HAS NO DATABASE.',
    '',
    '  This host looks like production but no Postgres connection string is',
    '  configured, so nothing can be stored: no registrations, no orders, and',
    '  no admin changes to the catalogue.',
    '',
    '  Fix (free): create a Postgres database and set its connection string —',
    '    DATABASE_URL=postgresql://<user>:<password>@<host>/<database>',
    '  Free options:  Neon (neon.tech), Supabase (supabase.com),',
    '                 or Render Postgres (render.com).',
    '',
    '  To intentionally start without a database (e.g. serving the bundled',
    '  catalogue for a demo) set ALLOW_NO_DATABASE=1 to skip this refusal.',
    banner,
    '',
  ].join('\n');

  if (process.env.ALLOW_NO_DATABASE === '1') {
    console.warn(message);
  } else {
    console.error(message);
    console.error('[persistence] Refusing to start without a database. Set ALLOW_NO_DATABASE=1 to override.');
    // Exit so the misconfiguration is caught during deploy rather than after
    // customers have tried to place orders that were never stored.
    process.exit(1);
  }
}

export default db;
