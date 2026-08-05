/**
 * Restore a snapshot into a live database.
 *
 * Written for the 5 Aug 2026 Turso outage, where the `default` group became
 * unreachable and the fix was to rebuild the database in a fresh group. The
 * app's own seed restores the built-in catalogue and a default admin on first
 * boot, but it knows nothing about anything created SINCE: registered
 * customers, their orders, admin-added products and categories, or a changed
 * admin password. That is what this restores.
 *
 * Usage (from server/):
 *   npm run db:restore                      # live-snapshot.db  ->  Turso
 *   npm run db:restore -- --dry-run         # report only, change nothing
 *   npm run db:restore -- --source other.db
 *   npm run db:restore -- --target ./tmp.db # restore into a local file instead
 *
 * Turso credentials are read from server/.env.turso if present, otherwise from
 * the process environment (server/.env). The auth token is never printed.
 *
 * SAFE TO RE-RUN. Every insert is INSERT OR IGNORE keyed on the table's natural
 * unique column, so rows already present are left exactly as they are and
 * nothing is ever overwritten or deleted. The one deliberate exception is the
 * admin password hash — see restoreAdmins().
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'libsql';
import AsyncDatabase from 'libsql/promise';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- arguments -------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dryRun = argv.includes('--dry-run');
const sourcePath = path.resolve(SERVER_ROOT, flag('source', 'live-snapshot.db'));
const targetFile = flag('target');

// ---- credentials -----------------------------------------------------------
function loadTursoEnv() {
  const file = path.join(SERVER_ROOT, '.env.turso');
  if (fs.existsSync(file)) {
    const env = {};
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
    }
    if (env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN) return env;
  }
  return {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  };
}

// Restore order matters: a row is only inserted after whatever it references.
// products -> categories, orders -> users.
const TABLES = ['categories', 'products', 'users', 'orders', 'admins', 'admin_activity'];

async function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source snapshot not found: ${sourcePath}`);
    process.exit(1);
  }

  // Source is always a plain local SQLite file — open it read-only so a restore
  // can never modify the snapshot it is reading from.
  const source = new Database(sourcePath, { readonly: true });

  let target;
  let targetLabel;
  if (targetFile) {
    target = new AsyncDatabase(path.resolve(SERVER_ROOT, targetFile), {});
    targetLabel = targetFile;
  } else {
    const env = loadTursoEnv();
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      console.error('No target. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in server/.env.turso,');
      console.error('or pass --target <file> to restore into a local SQLite file.');
      process.exit(1);
    }
    target = new AsyncDatabase(env.TURSO_DATABASE_URL, { authToken: env.TURSO_AUTH_TOKEN });
    targetLabel = env.TURSO_DATABASE_URL;
  }

  console.log(`source : ${sourcePath}`);
  console.log(`target : ${targetLabel}`);
  console.log(`mode   : ${dryRun ? 'DRY RUN — nothing will be written' : 'restore'}\n`);

  const summary = [];

  for (const table of TABLES) {
    // Skip tables the snapshot doesn't have (older snapshots predate some).
    const exists = source
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(table);
    if (!exists) {
      summary.push({ table, status: 'absent from snapshot' });
      continue;
    }

    const rows = source.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) {
      summary.push({ table, snapshot: 0, inserted: 0, skipped: 0 });
      continue;
    }

    // Only restore columns the TARGET actually has. Guards against a snapshot
    // taken from a schema that has since gained or lost a column.
    const targetInfo = await target.prepare(`PRAGMA table_info(${table})`);
    const targetCols = (await targetInfo.all()).map((c) => c.name);
    if (targetCols.length === 0) {
      summary.push({ table, status: 'missing in target — boot the API first so it creates the schema' });
      continue;
    }
    const cols = Object.keys(rows[0]).filter((c) => targetCols.includes(c));

    const before = await countRows(target, table);

    if (!dryRun) {
      // Explicit ids are preserved so foreign keys (orders.userId,
      // products.categoryId) keep pointing at the right rows.
      // Positional params (?) — the Turso remote protocol does not bind named ones.
      const sql =
        `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) ` +
        `VALUES (${cols.map(() => '?').join(', ')})`;
      const stmt = await target.prepare(sql);
      for (const row of rows) {
        try {
          await stmt.run(cols.map((c) => row[c]));
        } catch (err) {
          console.error(`  ${table}: row id=${row.id} failed — ${err.message}`);
        }
      }
    }

    const after = dryRun ? before : await countRows(target, table);
    summary.push({
      table,
      snapshot: rows.length,
      inserted: after - before,
      skipped: dryRun ? '-' : rows.length - (after - before),
    });
  }

  if (!dryRun) await restoreAdmins(source, target);

  console.log('  table            snapshot   inserted   already present');
  console.log('  ' + '-'.repeat(58));
  for (const s of summary) {
    if (s.status) {
      console.log(`  ${s.table.padEnd(16)} ${s.status}`);
    } else {
      console.log(
        `  ${s.table.padEnd(16)} ${String(s.snapshot).padStart(8)} ` +
        `${String(s.inserted).padStart(10)} ${String(s.skipped).padStart(17)}`
      );
    }
  }

  console.log(
    dryRun
      ? '\nDry run complete — nothing was written. Re-run without --dry-run to apply.'
      : '\nRestore complete.'
  );

  try { await target.close(); } catch { /* best effort */ }
  source.close();
}

async function countRows(target, table) {
  try {
    const stmt = await target.prepare(`SELECT COUNT(*) AS c FROM ${table}`);
    return (await stmt.get()).c;
  } catch {
    return 0;
  }
}

/**
 * The admin row is the one thing INSERT OR IGNORE gets wrong.
 *
 * The API seeds a default admin on first boot, so a row with that username
 * already exists and the snapshot's version is ignored — leaving the owner
 * locked out with the default password instead of the one they actually set.
 * So the password hash is copied over explicitly. Only the hash moves; the
 * hash itself is never printed.
 */
async function restoreAdmins(source, target) {
  const admins = source.prepare('SELECT username, passwordHash FROM admins').all();
  for (const admin of admins) {
    if (!admin.passwordHash) continue;
    try {
      const stmt = await target.prepare('UPDATE admins SET passwordHash = ? WHERE username = ?');
      const info = await stmt.run([admin.passwordHash, admin.username]);
      if (info.changes > 0) {
        console.log(`  admin "${admin.username}": password restored from snapshot.`);
      }
    } catch (err) {
      console.error(`  admin "${admin.username}": could not restore password — ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error('Restore failed:', err.message);
  process.exit(1);
});
