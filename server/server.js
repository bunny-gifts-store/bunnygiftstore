import app from './src/app.js';
import { config } from './src/config.js';
import { seedDatabase } from './src/seed.js';

app.listen(config.port, () => {
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
