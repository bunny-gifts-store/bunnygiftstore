/**
 * One-off Turso connectivity diagnostic.
 *
 * Reads credentials from server/.env.turso (gitignored, and NOT the file the
 * app loads, so running this cannot disturb local development). Reports what is
 * actually wrong with the remote database, and never prints the auth token.
 *
 * Run:  npm run turso:check      (from server/)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AsyncDatabase from 'libsql/promise';

// server/ root — one level up from src/, matching db-check.js and db-pull.js.
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(SERVER_ROOT, '.env.turso');

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  console.error('Create it with TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from the Render dashboard.');
  process.exit(1);
}

// Minimal parser — avoids pulling dotenv's global side effects into a throwaway
// script, and keeps the values in local variables only.
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
}

const url = env.TURSO_DATABASE_URL;
const token = env.TURSO_AUTH_TOKEN;

if (!url || !token) {
  console.error('Both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.turso');
  process.exit(1);
}

// Safe to show: the host identifies the database, the token never appears.
console.log(`database : ${url}`);
console.log(`token    : present (${token.length} chars, not shown)`);
console.log('');

// Classify the failure so the next action is unambiguous.
function diagnose(message) {
  const m = String(message).toLowerCase();
  if (m.includes('502') || m.includes('upstream forward failed')) {
    return [
      'DATABASE UNREACHABLE (502 upstream forward failed)',
      "Turso's edge accepted the request but could not reach your database.",
      'Usually: the database group is stopped/unhealthy, the database is archived',
      'and failed to wake, or there is a platform incident.',
      'Next: check https://app.turso.tech (is the DB listed? is its group healthy?)',
      '      and https://status.turso.tech',
    ];
  }
  if (m.includes('401') || m.includes('unauthorized') || m.includes('auth')) {
    return [
      'AUTH REJECTED',
      'The database is reachable but the token was refused — it was revoked,',
      'expired, or belongs to a different database.',
      'Next: turso db tokens create <db>, then update TURSO_AUTH_TOKEN in Render.',
    ];
  }
  if (m.includes('404') || m.includes('not found')) {
    return [
      'DATABASE NOT FOUND',
      'The URL resolves but no such database exists — it was deleted or renamed.',
      'Next: recreate it and restore from server/live-snapshot.db.',
    ];
  }
  if (m.includes('enotfound') || m.includes('dns')) {
    return [
      'HOST DOES NOT RESOLVE',
      'The hostname in TURSO_DATABASE_URL is wrong or the database is gone.',
    ];
  }
  return ['UNCLASSIFIED FAILURE', 'Raw error above; treat as a connectivity problem.'];
}

const started = Date.now();
try {
  const db = new AsyncDatabase(url, { authToken: token });

  // Cheapest possible round trip — proves the connection works at all.
  const ping = await db.prepare('SELECT 1 AS ok');
  await ping.get();
  console.log(`✅ CONNECTED in ${Date.now() - started}ms — the database is reachable.`);

  // If it's up, report what's actually in it, so a restore decision is informed.
  for (const table of ['users', 'admins', 'categories', 'products', 'orders', 'admin_activity']) {
    try {
      const stmt = await db.prepare(`SELECT COUNT(*) AS c FROM ${table}`);
      const row = await stmt.get();
      console.log(`   ${table.padEnd(15)} ${row.c}`);
    } catch (err) {
      console.log(`   ${table.padEnd(15)} — ${err.message}`);
    }
  }
  console.log('\nThe live API should recover on its own within a minute.');
  await db.close();
} catch (err) {
  console.error(`❌ FAILED after ${Date.now() - started}ms`);
  console.error(`   ${err.message}\n`);
  for (const line of diagnose(err.message)) console.error(`   ${line}`);
  process.exit(1);
}
