// ---------------------------------------------------------------------------
// Database sync verifier —  `npm run db:check`
//
// Answers one question: does `server/bunnystore.db`, ON ITS OWN, contain
// everything the live application has written?
//
// It proves this the hard way rather than trusting a pragma: it copies the main
// database file (WITHOUT the -wal/-shm sidecars, exactly as a backup or an
// external SQLite tool would see it) and compares every table's contents
// against the live database. A mismatch means data is still sitting in the
// write-ahead log and the file alone is incomplete.
//
// Safe to run at any time, including while the server is running — it only
// reads.
// ---------------------------------------------------------------------------
import Database from 'libsql';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from './config.js';

const TABLES = ['users', 'admins', 'categories', 'products', 'orders', 'admin_activity'];

const usingTurso = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
if (usingTurso) {
  console.log('Persistence is Turso (remote primary) — there is no local file to verify.');
  console.log('Every read and write goes straight to the remote database.');
  process.exit(0);
}

const dbPath = config.dbPath;
if (!fs.existsSync(dbPath)) {
  console.error(`No database found at ${dbPath}. Run "npm run seed" first.`);
  process.exit(1);
}

// Row counts plus a hash of each table's full contents, so a MODIFIED row is
// caught too — not just a missing one.
function snapshot(file) {
  const db = new Database(file, { readonly: true });
  const out = {};
  for (const t of TABLES) {
    try {
      const rows = db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all();
      const json = JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
      out[t] = {
        rows: rows.length,
        fingerprint: crypto.createHash('sha1').update(json).digest('hex').slice(0, 12),
      };
    } catch (err) {
      out[t] = { rows: null, fingerprint: null, error: err.message };
    }
  }
  db.close();
  return out;
}

// Copy ONLY the main file — no -wal, no -shm — into a temp dir.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunny-dbcheck-'));
const isolated = path.join(tmpDir, 'main-file-only.db');
fs.copyFileSync(dbPath, isolated);

let live, fileOnly;
try {
  live = snapshot(dbPath);       // reads main file + WAL = the live truth
  fileOnly = snapshot(isolated); // what the .db file alone actually holds
} finally {
  // Windows can hold the file briefly after close(); a leftover temp copy is
  // harmless and must never fail the check.
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
}

const walPath = `${dbPath}-wal`;
const walBytes = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;

console.log(`\nDatabase : ${dbPath}`);
console.log(`WAL      : ${walBytes} bytes ${walBytes === 0 ? '(fully folded into the .db file)' : '(pending — not yet in the .db file)'}\n`);
console.log('  table              live      .db file alone   status');
console.log('  ' + '-'.repeat(58));

let drift = 0;
for (const t of TABLES) {
  const l = live[t];
  const f = fileOnly[t];
  // An unreadable table is a real failure — every table here is created at boot,
  // so an error means the query or the database is wrong. Never report success.
  if (l.error || f.error) {
    drift += 1;
    console.log(`  ${t.padEnd(18)} ${'—'.padStart(5)}     ${'—'.padStart(10)}       *** ERROR: ${l.error || f.error} ***`);
    continue;
  }
  const synced = l.rows === f.rows && l.fingerprint === f.fingerprint;
  if (!synced) drift += 1;
  console.log(
    `  ${t.padEnd(18)} ${String(l.rows).padStart(5)}     ${String(f.rows).padStart(10)}       ${synced ? 'in sync' : '*** OUT OF SYNC ***'}`
  );
}

// Structural check on the file itself.
const integrity = (() => {
  const db = new Database(dbPath, { readonly: true });
  const r = db.pragma('integrity_check');
  db.close();
  return r?.[0]?.integrity_check ?? JSON.stringify(r);
})();

console.log(`\n  integrity_check : ${integrity}`);

if (drift === 0 && integrity === 'ok') {
  console.log('\n✅ The database file is a complete, current snapshot of the live application.');
  console.log('   You can open, copy or edit it directly.\n');
  process.exit(0);
}

console.error(`\n❌ ${drift} table(s) differ between the live database and the .db file.`);
console.error('   Data is committed and safe, but the file alone is incomplete.');
console.error('   Restart the API (or hit any write endpoint) to trigger a checkpoint.\n');
process.exit(1);
