// ---------------------------------------------------------------------------
// One-time migration off the old database  —  `npm run migrate`
//
// Reads the previous SQLite/Turso database and loads it into the Postgres that
// DATABASE_URL points at, then verifies the result. This is the whole migration
// in one command:
//
//   # freshest data — straight from the live Turso database
//   npm install --no-save libsql
//   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… DATABASE_URL=postgresql://… npm run migrate
//
//   # or from a local snapshot file, if Turso is unreachable
//   DATABASE_URL=postgresql://… npm run migrate -- --file live-snapshot.db
//
//   # see exactly what would happen, change nothing
//   DATABASE_URL=postgresql://… npm run migrate -- --dry-run
//
// WHY THIS REFUSES TO RUN ON A NON-EMPTY DATABASE
//
// The API seeds the BUILT-IN catalogue on first boot, which re-creates every
// bundled product — including ones the admin had deleted. A restore only ADDS
// rows, so it cannot undo that: those products come back on the storefront and
// nothing later would flag it. Migrating into an empty database avoids the
// problem entirely (the seed then skips, because products already exist), so
// that is enforced here rather than left to whoever reads the README.
// ---------------------------------------------------------------------------
import { readLegacySource } from './db-import.js';
import { restoreSnapshot } from './db-restore.js';
import { db, initSchema, closeDb, hasDatabaseUrl } from './db.js';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
const file = flag('file', 'live-snapshot.db');
// Turso is the default source when its credentials are present, because it is
// the live database — a local file is always some hours or days behind it.
const useTurso = argv.includes('--turso')
  || (!argv.includes('--file') && Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN));

const COUNTED = ['categories', 'products', 'users', 'orders', 'admins', 'admin_activity'];

const fail = (msg) => { console.error(`\n${msg}\n`); process.exit(1); };

async function counts() {
  const out = {};
  for (const t of COUNTED) {
    try { out[t] = (await db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get()).c; }
    catch { out[t] = null; }
  }
  return out;
}

if (!hasDatabaseUrl) {
  fail(`DATABASE_URL is not set — there is nowhere to migrate TO.

  Create a free Postgres database first (Neon / Supabase / Render), then:
    DATABASE_URL=postgresql://user:pass@host/db npm run migrate`);
}

console.log('\n=== Migrating to PostgreSQL ===\n');

// ---- 1. read the old database ---------------------------------------------
console.log(`Reading the old database (${useTurso ? 'Turso, live' : file})…\n`);
console.log('  table                rows');
console.log('  ' + '-'.repeat(32));

let snapshot;
try {
  snapshot = await readLegacySource({
    useTurso,
    file,
    onTable: (t, n, err) =>
      console.log(err ? `  ${t.padEnd(20)} ${'—'.padStart(5)}  (skipped: ${err})` : `  ${t.padEnd(20)} ${String(n).padStart(5)}`),
  });
} catch (err) {
  fail(err.message);
}

const sourceCounts = Object.fromEntries(COUNTED.map((t) => [t, snapshot.tables[t]?.length ?? 0]));
if (sourceCounts.products === 0) {
  fail('The source database has no products — that is not a database worth migrating.\n  Check --file, or the Turso credentials.');
}

// A stale local file is the single most likely way to migrate less data than
// expected, so say how old it is rather than letting it pass silently.
if (!useTurso) {
  console.log(`\n  NOTE: this is a FILE snapshot, not the live database. Anything added`);
  console.log(`        since it was taken will not be migrated. For the freshest data,`);
  console.log(`        re-run with the Turso credentials set.`);
}

// ---- 2. prepare the target -------------------------------------------------
console.log('\nPreparing the target database…');
if (!(await initSchema())) {
  fail('Could not reach the target database. Check DATABASE_URL is correct and the host is reachable.');
}

const before = await counts();
if (before.products > 0 && !force) {
  fail(`The target database ALREADY has ${before.products} products.

  Migrating on top of a seeded database re-creates built-in products the admin
  had deleted, and a restore cannot remove them again.

  If this database was created by booting the API, the clean fix is to reset it:
      DROP SCHEMA public CASCADE; CREATE SCHEMA public;
  then re-run this command BEFORE letting the API boot against it.

  If you understand the consequence and want to merge anyway, pass --force.`);
}

// ---- 3. load ---------------------------------------------------------------
console.log(dryRun ? '\nDRY RUN — nothing will be written.\n' : '\nLoading data…\n');
const summary = await restoreSnapshot(snapshot, { dryRun });

console.log('  table            source   inserted   already present');
console.log('  ' + '-'.repeat(56));
for (const s of summary) {
  if (s.status) console.log(`  ${s.table.padEnd(16)} ${s.status}`);
  else console.log(`  ${s.table.padEnd(16)} ${String(s.snapshot).padStart(6)} ${String(s.inserted).padStart(10)} ${String(s.skipped).padStart(17)}`);
}

// ---- 4. verify -------------------------------------------------------------
if (dryRun) {
  console.log('\nDry run complete — nothing was written. Re-run without --dry-run to apply.\n');
  await closeDb();
  process.exit(0);
}

const after = await counts();
console.log('\n=== Verification ===\n');
console.log('  table            old DB   new DB   result');
console.log('  ' + '-'.repeat(50));

let mismatch = 0;
for (const t of COUNTED) {
  const ok = after[t] === sourceCounts[t];
  if (!ok) mismatch += 1;
  console.log(`  ${t.padEnd(16)} ${String(sourceCounts[t]).padStart(6)} ${String(after[t]).padStart(8)}   ${ok ? 'match' : '*** MISMATCH ***'}`);
}

// Referential integrity is what actually determines whether the store works:
// an order whose customer did not come across is a broken "My Orders" page.
const orphanOrders = (await db.prepare(
  `SELECT COUNT(*) AS c FROM orders o LEFT JOIN users u ON u.id = o."userId" WHERE o."userId" IS NOT NULL AND u.id IS NULL`
).get()).c;
const orphanProducts = (await db.prepare(
  `SELECT COUNT(*) AS c FROM products p LEFT JOIN categories c ON c.id = p."categoryId" WHERE p."categoryId" IS NOT NULL AND c.id IS NULL`
).get()).c;
console.log(`\n  orders with a missing customer   : ${orphanOrders}`);
console.log(`  products with a missing category : ${orphanProducts}`);
if (orphanOrders || orphanProducts) mismatch += 1;

const withPasswords = (await db.prepare(`SELECT COUNT(*) AS c FROM users WHERE "passwordHash" IS NOT NULL`).get()).c;
console.log(`  customers who can log in         : ${withPasswords} of ${after.users}`);

await closeDb();

if (mismatch) {
  console.error('\n✖ Migration finished with mismatches — do NOT decommission the old database yet.\n');
  process.exit(1);
}

console.log(`
✔ Migration verified. The new database matches the old one.

Next:
  1. Set DATABASE_URL on the Render service (Environment tab) to this same value.
  2. Deploy. The seed will SKIP, because the catalogue is already populated.
  3. Check https://<your-api>/api/health — "db.ready": true, "seed.skipped": true.
  4. Only after confirming the site looks right, decommission the old database.
`);
