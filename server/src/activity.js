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

const insert = db.prepare(`
  INSERT INTO admin_activity (adminId, username, action, entity, entityId, details)
  VALUES (?, ?, ?, ?, ?, ?)
`);

/**
 * Record one admin operation.
 *
 * @param auth   the request's JWT payload (`req.auth`), or a literal
 *               `{ sub, username }` for the login route, where it isn't set yet.
 * @param entry  { action, entity?, entityId?, details? }
 */
export function recordAdminAction(auth, { action, entity = null, entityId = null, details = null }) {
  try {
    insert.run(
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
