// ---------------------------------------------------------------------------
// Pull the LIVE production database into a local file —  `npm run db:pull`
//
// Why this exists: `server/bunnystore.db` is the LOCAL DEVELOPMENT database. The
// deployed site does not use it. In production the API talks to a remote Turso
// database (see /api/health -> persistence.mode = "turso-remote"), so customers
// who register on bunnygiftsstore.com are written there and will NEVER appear in
// the local file, no matter how well it is checkpointed.
//
// This script copies the remote database into a single self-contained .db file
// you can open in DB Browser for SQLite, query, and keep as a dated backup.
//
// It is STRICTLY READ-ONLY against production: it only issues SELECTs on the
// remote, and every write goes to the local output file.
//
// Requires the same two values the Render service uses:
//   TURSO_DATABASE_URL=libsql://<your-db>-<org>.turso.io
//   TURSO_AUTH_TOKEN=<token>
// Put them in server/.env (gitignored) or set them in the shell for one run.
// ---------------------------------------------------------------------------
import Database from 'libsql';
import fs from 'fs';
import path from 'path';
import { SERVER_ROOT } from './config.js';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error(`
Cannot reach the live database: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are not set.

Find them in your Render dashboard:
  Render -> bunnygiftstore-api -> Environment -> TURSO_DATABASE_URL, TURSO_AUTH_TOKEN

…or re-issue a token with the Turso CLI:
  turso db show bunnygiftstore --url
  turso db tokens create bunnygiftstore

Then put both in server/.env (already gitignored):
  TURSO_DATABASE_URL=libsql://…turso.io
  TURSO_AUTH_TOKEN=…

and run "npm run db:pull" again.
`);
  process.exit(1);
}

// Default output: server/live-snapshot.db (*.db is gitignored — it holds real
// customer data and must never be committed).
const outPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(SERVER_ROOT, 'live-snapshot.db');

console.log(`\nSource : ${url}  (live production database, read-only)`);
console.log(`Output : ${outPath}\n`);

const remote = new Database(url, { authToken });

// Start from a clean output file so a re-run is a fresh snapshot, not a merge.
for (const suffix of ['', '-wal', '-shm']) {
  try { fs.rmSync(outPath + suffix, { force: true }); } catch { /* ignore */ }
}
const local = new Database(outPath);
// DELETE journalling keeps everything inside the single .db file, so the
// snapshot can be copied or emailed without a -wal sidecar tagging along.
local.pragma('journal_mode = DELETE');

// libSQL hands back BigInt for large integers; SQLite bindings want a Number.
const bind = (v) => (typeof v === 'bigint' ? Number(v) : v);

const objects = remote
  .prepare(`SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`)
  .all();

// Tables first, then the indexes/views/triggers that depend on them.
const tables = objects.filter((o) => o.type === 'table');
const rest = objects.filter((o) => o.type !== 'table');

let grandTotal = 0;
console.log('  table                rows');
console.log('  ' + '-'.repeat(32));

for (const t of tables) {
  local.exec(t.sql);

  const rows = remote.prepare(`SELECT * FROM "${t.name}"`).all();
  if (rows.length) {
    const cols = Object.keys(rows[0]).filter((c) => c !== '_metadata');
    const insert = local.prepare(
      `INSERT INTO "${t.name}" (${cols.map((c) => `"${c}"`).join(', ')})
       VALUES (${cols.map(() => '?').join(', ')})`
    );
    local.transaction(() => {
      for (const r of rows) insert.run(...cols.map((c) => bind(r[c])));
    })();
  }

  grandTotal += rows.length;
  console.log(`  ${t.name.padEnd(20)} ${String(rows.length).padStart(5)}`);
}

for (const o of rest) {
  try { local.exec(o.sql); } catch (err) {
    console.warn(`  (skipped ${o.type} ${o.name}: ${err.message})`);
  }
}

local.close();
remote.close();

const bytes = fs.statSync(outPath).size;
console.log(`  ${'-'.repeat(32)}`);
console.log(`  ${'TOTAL'.padEnd(20)} ${String(grandTotal).padStart(5)} rows, ${(bytes / 1024).toFixed(0)} KB\n`);
console.log('Done. Open this file in DB Browser for SQLite:');
console.log(`  ${outPath}\n`);
console.log('It is a point-in-time COPY — editing it does not change the live site.');
console.log('Re-run "npm run db:pull" for a fresh snapshot.\n');
