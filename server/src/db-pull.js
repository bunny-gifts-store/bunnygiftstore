// ---------------------------------------------------------------------------
// Pull the live database into a local snapshot file —  `npm run db:pull`
//
// Why this exists: the deployed API's data lives in a hosted Postgres database,
// so customers who register on bunnygiftsstore.com are written there and are not
// visible anywhere on your machine. This copies that database into a single
// self-contained JSON file you can read, diff, and keep as a dated backup —
// and that `npm run db:restore` can load back into a database later.
//
// It is STRICTLY READ-ONLY against production: it only issues SELECTs, and the
// single thing it writes is the local output file.
//
// Requires the same connection string the deployed service uses:
//   DATABASE_URL=postgresql://<user>:<password>@<host>/<database>
// Put it in server/.env (gitignored) or set it in the shell for one run.
//
// JSON rather than a database file on purpose: it stays readable without any
// tooling, and it does not tie the backup format to whichever database the app
// happens to use.
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import { SERVER_ROOT } from './config.js';
import { db, closeDb, hasDatabaseUrl } from './db.js';

if (!hasDatabaseUrl) {
  console.error(`
Cannot reach the live database: DATABASE_URL is not set.

Find it in your hosting dashboard (Render -> bunnygiftstore-api -> Environment),
or in your database provider's console (Neon / Supabase -> Connection string).

Then put it in server/.env (already gitignored):
  DATABASE_URL=postgresql://user:password@host/database

and run "npm run db:pull" again.
`);
  process.exit(1);
}

// Dump order matters for the restore side: a row is only written after whatever
// it references. products -> categories, orders -> users.
const TABLES = ['categories', 'products', 'users', 'orders', 'admins', 'admin_activity'];

// Default output: server/live-snapshot.json (gitignored — it holds real customer
// data, including password hashes, and must never be committed).
const outPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(SERVER_ROOT, 'live-snapshot.json');

console.log(`\nSource : live production database (read-only)`);
console.log(`Output : ${outPath}\n`);
console.log('  table                rows');
console.log('  ' + '-'.repeat(32));

const snapshot = { takenAt: new Date().toISOString(), tables: {} };
let grandTotal = 0;

for (const table of TABLES) {
  try {
    // Ordered by id so a re-pull produces a stable, diffable file.
    const rows = await db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
    snapshot.tables[table] = rows;
    grandTotal += rows.length;
    console.log(`  ${table.padEnd(20)} ${String(rows.length).padStart(5)}`);
  } catch (err) {
    // A table missing from the source is worth reporting, not worth aborting
    // over — the rest of the snapshot is still useful.
    snapshot.tables[table] = [];
    console.warn(`  ${table.padEnd(20)} ${'—'.padStart(5)}  (skipped: ${err.message})`);
  }
}

fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
await closeDb();

const bytes = fs.statSync(outPath).size;
console.log(`  ${'-'.repeat(32)}`);
console.log(`  ${'TOTAL'.padEnd(20)} ${String(grandTotal).padStart(5)} rows, ${(bytes / 1024).toFixed(0)} KB\n`);
console.log(`Done: ${outPath}`);
console.log('It is a point-in-time COPY — editing it does not change the live site.');
console.log('Re-run "npm run db:pull" for a fresh snapshot.\n');
