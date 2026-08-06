// ---------------------------------------------------------------------------
// One-time migration source: legacy SQLite / Turso database -> snapshot object.
//
// This is the bridge off the old database. It reads the previous SQLite-family
// database (a local .db file, or the remote Turso primary) and produces the same
// snapshot shape `npm run db:pull` writes, which `db-restore.js` loads into
// Postgres. `npm run migrate` drives both ends; this file is also usable alone:
//
//   npm run db:import -- --file live-snapshot.db     # from a local .db file
//   npm run db:import -- --turso                     # from the remote Turso DB
//
// Reading a local .db file needs NO dependencies — Node's built-in node:sqlite
// handles it. Reading Turso needs the old driver for one run only:
//   npm install --no-save libsql
// It is deliberately not a dependency of this project any more; --no-save keeps
// it out of package.json and the deployed image.
//
// STRICTLY READ-ONLY against the source. Delete this file once the migration is
// done and verified — it exists to be used once.
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import { SERVER_ROOT } from './config.js';

// Restore order: a row is only written after whatever it references.
// products -> categories, orders -> users.
export const LEGACY_TABLES = ['categories', 'products', 'users', 'orders', 'admins', 'admin_activity'];

/** Open the legacy source and return a uniform { all(sql), close(), label }. */
async function openSource({ useTurso, file }) {
  if (useTurso) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error(
        'Reading from Turso needs TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.\n' +
        '  Find them in Render -> bunnygiftstore-api -> Environment.\n' +
        '  Set them for this one run; they are not stored anywhere.'
      );
    }
    let Database;
    try {
      ({ default: Database } = await import('libsql'));
    } catch {
      throw new Error(
        'The old Turso driver is no longer a dependency. Install it for this one\n' +
        '  run:  npm install --no-save libsql'
      );
    }
    const db = new Database(url, { authToken });
    return { all: (sql) => db.prepare(sql).all(), close: () => db.close(), label: 'Turso (remote primary)' };
  }

  const resolved = path.resolve(SERVER_ROOT, file);
  if (!fs.existsSync(resolved)) throw new Error(`Source database not found: ${resolved}`);
  // Built into Node 22 — no dependency needed to read a plain SQLite file.
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(resolved, { readOnly: true });
  return { all: (sql) => db.prepare(sql).all(), close: () => db.close(), label: resolved };
}

/**
 * Read the whole legacy database into a snapshot object.
 * Returns { takenAt, importedFrom, tables: { <table>: [rows] } }.
 */
export async function readLegacySource({ useTurso = false, file = 'live-snapshot.db', onTable } = {}) {
  const source = await openSource({ useTurso, file });
  const snapshot = { takenAt: new Date().toISOString(), importedFrom: source.label, tables: {} };
  try {
    for (const table of LEGACY_TABLES) {
      try {
        const rows = source.all(`SELECT * FROM ${table} ORDER BY id`);
        // libSQL returns BigInt for integer columns; JSON.stringify throws on
        // those, and Postgres wants plain numbers anyway.
        const clean = rows.map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))
        );
        snapshot.tables[table] = clean;
        onTable?.(table, clean.length, null);
      } catch (err) {
        // A table missing from an older source is worth reporting, not aborting over.
        snapshot.tables[table] = [];
        onTable?.(table, null, err.message);
      }
    }
  } finally {
    source.close();
  }
  return snapshot;
}

// ---- CLI -------------------------------------------------------------------
if (process.argv[1]?.endsWith('db-import.js')) {
  const argv = process.argv.slice(2);
  const flag = (name, fallback = null) => {
    const i = argv.indexOf(`--${name}`);
    return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
  };
  const useTurso = argv.includes('--turso');
  const file = flag('file', 'live-snapshot.db');
  const outPath = path.resolve(SERVER_ROOT, flag('out', 'live-snapshot.json'));

  try {
    console.log('  table                rows');
    console.log('  ' + '-'.repeat(32));
    let total = 0;
    const snapshot = await readLegacySource({
      useTurso,
      file,
      onTable: (t, n, err) => {
        if (err) console.warn(`  ${t.padEnd(20)} ${'—'.padStart(5)}  (skipped: ${err})`);
        else { total += n; console.log(`  ${t.padEnd(20)} ${String(n).padStart(5)}`); }
      },
    });
    fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
    console.log('  ' + '-'.repeat(32));
    console.log(`  ${'TOTAL'.padEnd(20)} ${String(total).padStart(5)} rows`);
    console.log(`\nsource : ${snapshot.importedFrom}`);
    console.log(`output : ${outPath}\n`);
    console.log('Next:  DATABASE_URL=… npm run db:restore\n');
  } catch (err) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }
}
