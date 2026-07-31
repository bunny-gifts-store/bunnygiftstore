import app from './src/app.js';
import { config } from './src/config.js';
import { persist } from './src/db.js';
import { seedDatabase } from './src/seed.js';

const server = app.listen(config.port, () => {
  console.log(`Bunny Gift Store API running on http://localhost:${config.port}`);

  // Seed AFTER the port is open so the health check passes immediately. On the
  // very first boot against a fresh Turso database this writes ~100 rows to the
  // remote primary (one network round-trip each), which is too slow to block
  // startup. Seeding is idempotent and skips entirely once data exists, so
  // later boots do almost nothing here.
  try {
    seedDatabase();
  } catch (err) {
    console.error('[seed] Seeding failed (server is still running):', err);
  }
});

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
