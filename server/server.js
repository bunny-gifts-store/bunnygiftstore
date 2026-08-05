import app from './src/app.js';
import { config } from './src/config.js';
import { persist, initSchema, dbStatus, scheduleRecovery, setDbReadyHook } from './src/db.js';
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

// Seeding runs on first boot AND after any recovery — a database that comes
// back empty (or is a freshly created replacement) needs its catalogue again.
// Idempotent, so it costs almost nothing when there is already data.
function seedSafely() {
  try {
    seedDatabase();
  } catch (err) {
    console.error('[seed] Seeding failed (server is still running):', err);
  }
}

// Everything that needs the database happens here, after the port is open.
async function bootstrap() {
  // Load the last known-good catalogue FIRST, so that if the database turns out
  // to be unreachable the storefront is already browsable rather than blank.
  loadCatalogCache();

  // Recovery lives in db.js so that any code discovering a broken connection
  // can re-arm it, not just this boot path. Tell it what to do once the
  // database is usable again.
  setDbReadyHook(seedSafely);

  // Schema + migrations. Resolves false (rather than throwing) if the database
  // is unreachable, so the API stays up and reports why.
  if (!(await initSchema())) {
    console.error('[boot] Database is not ready — API is serving, but data routes will return 503.');
    console.error('[boot] Cause:', dbStatus.error);
    scheduleRecovery();
    return;
  }

  seedSafely();
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
