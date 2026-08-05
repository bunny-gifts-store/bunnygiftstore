import app from './src/app.js';
import { config } from './src/config.js';
import { persist, initSchema, dbStatus } from './src/db.js';
import { seedDatabase } from './src/seed.js';
import { loadCatalogCache } from './src/catalogCache.js';

// Open the HTTP port FIRST, before any database work.
//
// Nothing in the boot path may block the port from opening. Against Turso every
// schema statement is a network round trip on a synchronous driver, so doing
// that work during import (as this used to) meant a slow or unreachable primary
// stopped app.listen() from ever running: the platform health check timed out,
// the API answered nothing at all, and the site sat on "Signing in…" forever
// with no error anywhere. Listening first turns that class of failure into a
// visible, diagnosable state on /api/health instead of a silent hang.
const server = app.listen(config.port, () => {
  console.log(`Bunny Gift Store API running on http://localhost:${config.port}`);
  bootstrap();
});

// Everything that needs the database happens here, after the port is open.
async function bootstrap() {
  // Load the last known-good catalogue FIRST, so that if the database turns out
  // to be unreachable the storefront is already browsable rather than blank.
  loadCatalogCache();

  // Schema + migrations. Resolves false (rather than throwing) if the database
  // is unreachable, so the API stays up and reports why.
  const ready = await initSchema();
  if (!ready) {
    console.error('[boot] Database is not ready — API is serving, but data routes will return 503.');
    console.error('[boot] Cause:', dbStatus.error);
    scheduleRetry();
    return;
  }

  // Seed only once the schema exists. On the very first boot against a fresh
  // Turso database this writes ~100 rows to the remote primary (one network
  // round-trip each). Seeding is idempotent and skips entirely once data
  // exists, so later boots do almost nothing here.
  try {
    seedDatabase();
  } catch (err) {
    console.error('[seed] Seeding failed (server is still running):', err);
  }
}

// A database that is unreachable at boot is usually a transient outage (or a
// primary that is itself waking up). Keep retrying with a backoff instead of
// requiring a manual redeploy to recover.
let retryDelay = 5000;
function scheduleRetry() {
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, 60000);
  console.log(`[boot] Retrying database init in ${Math.round(delay / 1000)}s…`);
  setTimeout(async () => {
    if (await initSchema()) {
      console.log('[boot] Database recovered.');
      try {
        seedDatabase();
      } catch (err) {
        console.error('[seed] Seeding failed (server is still running):', err);
      }
    } else {
      scheduleRetry();
    }
  }, delay).unref();
}

// Leave the database file complete and self-contained on shutdown.
//
// Requests already flush as they finish, so this is a backstop for anything
// written outside a request — and it makes Ctrl+C / a container stop leave
// bunnystore.db in a state that can be copied or opened straight away, with no
// leftover -wal sidecar to carry along.
let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[shutdown] ${signal} received — flushing database to disk…`);
    server.close(() => {
      persist();
      console.log('[shutdown] Database is fully written to disk. Bye.');
      process.exit(0);
    });
    // Don't hang forever on a lingering keep-alive connection.
    setTimeout(() => {
      persist();
      process.exit(0);
    }, 5000).unref();
  });
}
