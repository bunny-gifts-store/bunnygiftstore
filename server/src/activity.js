import { db, persist } from './db.js';

// ---------------------------------------------------------------------------
// Admin audit trail.
//
// Every operation performed from the admin panel is recorded in the
// `admin_activity` table so the full history is inspectable directly in the
// database file — who did what, to which record, and when.
//
// This is also the ONLY place a deleted product/category survives: the row
// itself is gone from `products`, but its full contents are kept here in
// `details`, so a deletion can be reviewed (or the row reconstructed) later.
// ---------------------------------------------------------------------------

// Prepared lazily, on first use — NOT at import time. The schema is created
// after the HTTP port opens (see server.js), so preparing here at import would
// run against a table that does not exist yet, and against Turso it would add
// another blocking network round trip to the boot path.
let insert = null;
const statement = () => (insert ??= db.prepare(`
  INSERT INTO admin_activity (adminId, username, action, entity, entityId, details)
  VALUES (?, ?, ?, ?, ?, ?)
`));

/**
 * Record one admin operation.
 *
 * @param auth   the request's JWT payload (`req.auth`), or a literal
 *               `{ sub, username }` for the login route, where it isn't set yet.
 * @param entry  { action, entity?, entityId?, details? }
 */
export function recordAdminAction(auth, { action, entity = null, entityId = null, details = null }) {
  try {
    statement().run(
      auth?.sub ?? null,
      auth?.username ?? null,
      action,
      entity,
      entityId != null ? Number(entityId) : null,
      details != null ? JSON.stringify(details) : null
    );
  } catch (err) {
    // Auditing must never break the operation it is recording — a failed log
    // line is worth a warning, not a failed product save.
    console.error('[activity] could not record admin action:', err.message);
  }
}

/**
 * Record an admin operation WITHOUT making the caller wait for it.
 *
 * On Turso the insert is a network round trip, so doing it inline adds its full
 * latency to the response. Nothing in the response depends on the audit row, so
 * for latency-sensitive routes (login) it is written just after the reply has
 * been sent. It still lands in the same database, and persist() folds it into
 * the .db file afterwards — app.js's per-request flush has already run by then.
 */
export function recordAdminActionDeferred(auth, entry) {
  setImmediate(() => {
    recordAdminAction(auth, entry);
    persist();
  });
}
