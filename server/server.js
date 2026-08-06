import app from './src/app.js';
import { config } from './src/config.js';
import { initSchema, dbStatus, scheduleRecovery, setDbReadyHook, closeDb } from './src/db.js';
import { seedDatabase } from './src/seed.js';
import { loadCatalogCache } from './src/catalogCache.js';

// Open the HTTP port FIRST, before any database work.
//
// Nothing in the boot path may block the port from opening. Every schema
// statement is a network round trip to Postgres, so doing that work during
// import (as this used to) meant a slow or unreachable database stopped
// app.listen() from ever running: the platform health check timed out, the API
// answered nothing at all, and the site sat on "Signing in…" forever with no
// error anywhere. Listening first turns that class of failure into a visible,
// diagnosable state on /api/health instead of a silent hang.
const server = app.listen(config.port, () => {
  console.log(`Bunny Gift Store API running on http://localhost:${config.port}`);
  bootstrap();
});

// Seeding runs on first boot AND after any recovery — a database that comes
// back empty (or is a freshly created replacement) needs its catalogue again.
// Idempotent, so it costs almost nothing when there is already data.
async function seedSafely() {
  try {
    await seedDatabase();
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

  await seedSafely();
}

// Close the connection pool on the way out.
//
// Committed data is already durable on the Postgres server, so nothing is at
// risk here — this just lets in-flight queries finish and returns the pooled
// connections instead of leaving the provider to time them out, which matters
// on free tiers where the connection allowance is small.
let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[shutdown] ${signal} received — closing database connections…`);
    server.close(async () => {
      await closeDb();
      console.log('[shutdown] Bye.');
      process.exit(0);
    });
    // Don't hang forever on a lingering keep-alive connection.
    setTimeout(async () => {
      await closeDb();
      process.exit(0);
    }, 5000).unref();
  });
}
