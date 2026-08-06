import { db } from './db.js';

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

// Built lazily, on first use — NOT at import time. The schema is created after
// the HTTP port opens (see server.js), so building this at import would tie the
// boot path to a table that does not exist yet.
let insert = null;
const statement = () => (insert ??= db.prepare(`
  INSERT INTO admin_activity ("adminId", username, action, entity, "entityId", details)
  VALUES (?, ?, ?, ?, ?, ?)
`));

/**
 * Record one admin operation.
 *
 * @param auth   the request's JWT payload (`req.auth`), or a literal
 *               `{ sub, username }` for the login route, where it isn't set yet.
 * @param entry  { action, entity?, entityId?, details? }
 */
export async function recordAdminAction(auth, { action, entity = null, entityId = null, details = null }) {
  try {
    await statement().run(
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
 * The insert is a network round trip to Postgres, so doing it inline adds its
 * full latency to the response. Nothing in the response depends on the audit
 * row, so for latency-sensitive routes (login) it is written just after the
 * reply has been sent. recordAdminAction swallows its own failures, so the
 * floating promise here can never surface as an unhandled rejection.
 */
export function recordAdminActionDeferred(auth, entry) {
  setImmediate(() => { recordAdminAction(auth, entry); });
}
