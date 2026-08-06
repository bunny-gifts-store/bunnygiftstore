/**
 * Restore a snapshot into a live database.
 *
 * The app's own seed restores the built-in catalogue and a default admin on
 * first boot, but it knows nothing about anything created SINCE: registered
 * customers, their orders, admin-added products and categories, or a changed
 * admin password. That is what this restores — after a database has had to be
 * rebuilt, or when cloning production into a scratch database.
 *
 * Usage (from server/):
 *   npm run db:restore                        # live-snapshot.json -> DATABASE_URL
 *   npm run db:restore -- --dry-run           # report only, change nothing
 *   npm run db:restore -- --source other.json
 *
 * The snapshot is the JSON file produced by `npm run db:pull`. The target is
 * whatever DATABASE_URL points at, so restoring into a scratch database is a
 * matter of pointing DATABASE_URL somewhere else for the run. The connection
 * string is never printed.
 *
 * SAFE TO RE-RUN. Every insert is ON CONFLICT DO NOTHING, so rows already
 * present are left exactly as they are and nothing is overwritten or deleted.
 * The one deliberate exception is the admin password hash — see restoreAdmins().
 */
import fs from 'fs';
import path from 'path';
import { SERVER_ROOT } from './config.js';
import { db, pool, closeDb, hasDatabaseUrl, initSchema } from './db.js';

// ---- arguments -------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dryRun = argv.includes('--dry-run');
const sourcePath = path.resolve(SERVER_ROOT, flag('source', 'live-snapshot.json'));

// Restore order matters: a row is only inserted after whatever it references.
// products -> categories, orders -> users.
const TABLES = ['categories', 'products', 'users', 'orders', 'admins', 'admin_activity'];

/**
 * Load a snapshot into the database DATABASE_URL points at.
 * Returns a per-table summary. Assumes the schema already exists.
 */
export async function restoreSnapshot(snapshot, { dryRun = false } = {}) {
  const summary = [];

  for (const table of TABLES) {
    const rows = snapshot.tables?.[table];
    if (!Array.isArray(rows)) { summary.push({ table, status: 'absent from snapshot' }); continue; }
    if (rows.length === 0) { summary.push({ table, snapshot: 0, inserted: 0, skipped: 0 }); continue; }

    // Only restore columns the TARGET actually has. Guards against a snapshot
    // taken from a schema that has since gained or lost a column.
    const targetCols = await columnsOf(table);
    if (targetCols.length === 0) { summary.push({ table, status: 'missing in target' }); continue; }
    const cols = Object.keys(rows[0]).filter((c) => targetCols.includes(c));

    const before = await countRows(table);

    if (!dryRun) {
      // Explicit ids are preserved so foreign keys (orders.userId,
      // products.categoryId) keep pointing at the right rows.
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const sql =
        `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')}) ` +
        `VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
      for (const row of rows) {
        try {
          await pool.query(sql, cols.map((c) => row[c]));
        } catch (err) {
          console.error(`  ${table}: row id=${row.id} failed — ${err.message}`);
        }
      }
      // Rows carry their original ids, which does NOT advance the SERIAL
      // sequence — so without this the next INSERT would reuse id 1 and fail on
      // the primary key. Fast-forward the sequence past everything restored.
      await resetSequence(table);
    }

    const after = dryRun ? before : await countRows(table);
    summary.push({
      table,
      snapshot: rows.length,
      inserted: after - before,
      skipped: dryRun ? '-' : rows.length - (after - before),
    });
  }

  if (!dryRun) await restoreAdmins(snapshot);
  await warnAboutResurrectedProducts(snapshot);
  return summary;
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source snapshot not found: ${sourcePath}`);
    console.error('Create one with "npm run db:pull".');
    process.exit(1);
  }
  if (!hasDatabaseUrl) {
    console.error('No target: DATABASE_URL is not set. Put it in server/.env or set it for this run.');
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  if (!snapshot?.tables) {
    console.error(`${sourcePath} is not a snapshot produced by "npm run db:pull".`);
    process.exit(1);
  }

  // Make sure the target actually has the schema — restoring into an empty
  // database should not require booting the API first.
  if (!(await initSchema())) {
    console.error('Could not prepare the target schema. Is DATABASE_URL correct and reachable?');
    process.exit(1);
  }

  console.log(`source : ${sourcePath}  (taken ${snapshot.takenAt ?? 'unknown'})`);
  console.log(`target : the database DATABASE_URL points at`);
  console.log(`mode   : ${dryRun ? 'DRY RUN — nothing will be written' : 'restore'}\n`);

  const summary = await restoreSnapshot(snapshot, { dryRun });

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

  await closeDb();
}

/**
 * Warn about products the target has that the snapshot does NOT.
 *
 * A restore can add rows; it cannot remove them. So if the API booted first, the
 * seed recreated the full built-in catalogue — including any product the admin
 * had DELETED before the snapshot was taken. Those come back from the dead and
 * reappear on the storefront, and nothing else in this script would notice.
 *
 * The fix is to restore BEFORE the first boot (the seed then skips, because
 * products already exist). If it is already too late, this names the exact rows
 * to delete rather than leaving them to be spotted by a customer.
 */
async function warnAboutResurrectedProducts(snapshot) {
  const snapshotCodes = new Set((snapshot.tables.products ?? []).map((p) => p.code));
  if (snapshotCodes.size === 0) return;
  let live;
  try {
    live = await db.prepare('SELECT id, code, name FROM products').all();
  } catch {
    return;
  }
  const extra = live.filter((p) => !snapshotCodes.has(p.code));
  if (extra.length === 0) return;

  console.warn(`
  ⚠  ${extra.length} product(s) exist here but are NOT in the snapshot:
${extra.map((p) => `       ${p.code} — ${p.name}`).join('\n')}

     These are almost certainly built-in products the seed recreated, which had
     been deleted from the source database. A restore only ADDS rows, so they
     are still live on the storefront. Remove them from the admin panel, or:

       DELETE FROM products WHERE code IN (${extra.map((p) => `'${p.code}'`).join(', ')});

     To avoid this next time, run the restore BEFORE the API's first boot — the
     seed then skips, because the catalogue is already populated.`);
}

async function columnsOf(table) {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = $1`,
    [table]
  );
  return res.rows.map((r) => r.column_name);
}

async function countRows(table) {
  try {
    return (await db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get()).c;
  } catch {
    return 0;
  }
}

/** Move the table's id sequence past the highest restored id. */
async function resetSequence(table) {
  try {
    await pool.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'),
                     GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1))`,
      [table]
    );
  } catch (err) {
    console.error(`  ${table}: could not reset id sequence — ${err.message}`);
  }
}

/**
 * The admin row is the one thing ON CONFLICT DO NOTHING gets wrong.
 *
 * The API seeds a default admin on first boot, so a row with that username
 * already exists and the snapshot's version is ignored — leaving the owner
 * locked out with the default password instead of the one they actually set.
 * So the password hash is copied over explicitly. Only the hash moves; the
 * hash itself is never printed.
 */
async function restoreAdmins(snapshot) {
  for (const admin of snapshot.tables.admins ?? []) {
    if (!admin.passwordHash) continue;
    try {
      const info = await db
        .prepare('UPDATE admins SET "passwordHash" = ? WHERE username = ?')
        .run(admin.passwordHash, admin.username);
      if (info.changes > 0) {
        console.log(`  admin "${admin.username}": password restored from snapshot.`);
      }
    } catch (err) {
      console.error(`  admin "${admin.username}": could not restore password — ${err.message}`);
    }
  }
}

// Only run the CLI when invoked directly. `migrate.js` imports restoreSnapshot()
// from this module, and without this guard that import would also fire the
// whole command-line restore as a side effect.
if (process.argv[1]?.endsWith('db-restore.js')) {
  main().catch(async (err) => {
    console.error('Restore failed:', err.message);
    await closeDb();
    process.exit(1);
  });
}
