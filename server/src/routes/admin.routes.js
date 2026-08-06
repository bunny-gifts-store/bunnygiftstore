import { Router } from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { getProductById, listProducts, asyncHandler, normalizeSizeOptions } from '../helpers.js';
import { isValidStatus, isValidPaymentStatus, isValidRefundStatus, normalizeStatus, isValidUtr, UTR_HELP } from '../orderStatus.js';
import { saveImage, deleteImage } from '../storage.js';
import { serializeOrder } from './orders.routes.js';
import { recordAdminAction } from '../activity.js';

const router = Router();
router.use(requireAuth('admin'));

const slugify = (s) =>
  String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ---- Image upload ----
// Keep the file in memory so storage.js can send it to durable storage
// (Cloudinary) when configured, or write it to the local uploads folder in dev.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

// POST /api/admin/upload  (multipart, field: "image") -> { path }
router.post('/upload', upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
  const path = await saveImage(req.file.buffer, req.file.originalname, req.file.mimetype);
  await recordAdminAction(req.auth, {
    action: 'image.upload',
    details: { path, originalName: req.file.originalname, bytes: req.file.size },
  });
  res.json({ path });
}));

// Postgres reports a unique-constraint breach with SQLSTATE 23505. Matching the
// code rather than the message text keeps this working regardless of locale or
// how the constraint happens to be named.
const isUniqueViolation = (e) => e?.code === '23505';

// ---- Categories ----
router.get('/categories', asyncHandler(async (_req, res) => {
  res.json(await db.prepare('SELECT * FROM categories ORDER BY "sortOrder" ASC, name ASC').all());
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  const sortOrder = Number(req.body.sortOrder) || 0;
  try {
    const info = await db.prepare('INSERT INTO categories (name, slug, "sortOrder") VALUES (?, ?, ?)')
      .run(name, slugify(name), sortOrder);
    const created = await db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    await recordAdminAction(req.auth, { action: 'category.create', entity: 'category', entityId: created.id, details: created });
    res.status(201).json(created);
  } catch (e) {
    if (isUniqueViolation(e)) return res.status(409).json({ error: 'Category already exists.' });
    throw e;
  }
}));

router.put('/categories/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Category not found.' });
  const name = req.body.name != null ? String(req.body.name).trim() : existing.name;
  const sortOrder = req.body.sortOrder != null ? Number(req.body.sortOrder) : existing.sortOrder;
  try {
    await db.prepare('UPDATE categories SET name = ?, slug = ?, "sortOrder" = ? WHERE id = ?')
      .run(name, slugify(name), sortOrder, id);
  } catch (e) {
    if (isUniqueViolation(e)) return res.status(409).json({ error: 'Another category already uses that name.' });
    throw e;
  }
  const updated = await db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  await recordAdminAction(req.auth, {
    action: 'category.update', entity: 'category', entityId: id,
    details: { before: existing, after: updated },
  });
  res.json(updated);
}));

router.delete('/categories/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const count = (await db.prepare('SELECT COUNT(*) AS c FROM products WHERE "categoryId" = ?').get(id)).c;
  if (count > 0) {
    return res.status(409).json({ error: `Cannot delete: ${count} product(s) use this category. Reassign them first.` });
  }
  // Capture the row before it goes: the audit trail is the only remaining
  // record of a deleted category.
  const existing = await db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Category not found.' });
  await db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  await recordAdminAction(req.auth, { action: 'category.delete', entity: 'category', entityId: id, details: existing });
  res.json({ ok: true });
}));

// ---- Products ----
router.get('/products', asyncHandler(async (_req, res) => {
  res.json(await listProducts({ includeHidden: true }));
}));

router.get('/products/:id', asyncHandler(async (req, res) => {
  const product = await getProductById(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
}));

function parseProductBody(body) {
  const priceRaw = body.price;
  const price = priceRaw === '' || priceRaw == null ? null : Number(priceRaw);
  return {
    code: String(body.code || '').trim(),
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim(),
    price: Number.isNaN(price) ? null : price,
    priceLabel: body.priceLabel ? String(body.priceLabel).trim() : null,
    categoryId: body.categoryId ? Number(body.categoryId) : null,
    image: body.image ? String(body.image).trim() : null,
    // Frame-style variable pricing: a cleaned JSON array (or null). Accepts an
    // array from the admin form or the parsed array carried on an existing row.
    sizeOptions: normalizeSizeOptions(body.sizeOptions),
    outOfStock: body.outOfStock ? 1 : 0,
    unavailable: body.unavailable ? 1 : 0,
    sortOrder: body.sortOrder != null ? Number(body.sortOrder) : 0,
  };
}

router.post('/products', asyncHandler(async (req, res) => {
  const p = parseProductBody(req.body);
  if (!p.code || !p.name) return res.status(400).json({ error: 'Product code and name are required.' });
  // A price isn't required when the product carries per-size pricing (frames).
  if (p.price == null && !p.priceLabel && !p.sizeOptions) return res.status(400).json({ error: 'Enter a price.' });
  try {
    const info = await db.prepare(`
      INSERT INTO products (code, name, description, price, "priceLabel", "categoryId", image, "sizeOptions", "outOfStock", unavailable, "sortOrder")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(p.code, p.name, p.description, p.price, p.priceLabel, p.categoryId, p.image, p.sizeOptions, p.outOfStock, p.unavailable, p.sortOrder);
    const created = await getProductById(info.lastInsertRowid);
    await recordAdminAction(req.auth, { action: 'product.create', entity: 'product', entityId: created.id, details: created });
    res.status(201).json(created);
  } catch (e) {
    if (isUniqueViolation(e)) return res.status(409).json({ error: 'A product with this code already exists.' });
    throw e;
  }
}));

router.put('/products/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await getProductById(id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const p = parseProductBody({ ...existing, ...req.body });
  if (!p.code || !p.name) return res.status(400).json({ error: 'Product code and name are required.' });
  try {
    await db.prepare(`
      UPDATE products
      SET code=?, name=?, description=?, price=?, "priceLabel"=?,
          "categoryId"=?, image=?, "sizeOptions"=?, "outOfStock"=?,
          unavailable=?, "sortOrder"=?, "updatedAt"=to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
      WHERE id=?
    `).run(p.code, p.name, p.description, p.price, p.priceLabel, p.categoryId, p.image, p.sizeOptions, p.outOfStock, p.unavailable, p.sortOrder, id);
    const updated = await getProductById(id);
    await recordAdminAction(req.auth, {
      action: 'product.update', entity: 'product', entityId: id,
      details: { before: existing, after: updated },
    });
    res.json(updated);
  } catch (e) {
    if (isUniqueViolation(e)) return res.status(409).json({ error: 'A product with this code already exists.' });
    throw e;
  }
}));

// PATCH /api/admin/products/:id/status  { outOfStock?, unavailable? } -- instant toggles
router.patch('/products/:id/status', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await getProductById(id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const outOfStock = req.body.outOfStock != null ? (req.body.outOfStock ? 1 : 0) : (existing.outOfStock ? 1 : 0);
  const unavailable = req.body.unavailable != null ? (req.body.unavailable ? 1 : 0) : (existing.unavailable ? 1 : 0);
  await db.prepare(`
    UPDATE products
    SET "outOfStock" = ?, unavailable = ?, "updatedAt" = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
    WHERE id = ?
  `).run(outOfStock, unavailable, id);
  await recordAdminAction(req.auth, {
    action: 'product.status_change', entity: 'product', entityId: id,
    details: {
      before: { outOfStock: !!existing.outOfStock, unavailable: !!existing.unavailable },
      after: { outOfStock: !!outOfStock, unavailable: !!unavailable },
    },
  });
  res.json(await getProductById(id));
}));

router.delete('/products/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  // Read the WHOLE row, not just the image: once deleted, the audit trail below
  // is the only place this product's details still exist in the database.
  const existing = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  await db.prepare('DELETE FROM products WHERE id = ?').run(id);
  await recordAdminAction(req.auth, { action: 'product.delete', entity: 'product', entityId: id, details: existing });
  // Best-effort cleanup of an admin-uploaded image (Cloudinary or local uploads).
  // Never touches the bundled images/ that ship with the app.
  if (existing.image && !existing.image.startsWith('images/')) {
    deleteImage(existing.image);
  }
  res.json({ ok: true });
}));

// ---- Orders (admin view) ----
router.get('/orders', asyncHandler(async (_req, res) => {
  const rows = await db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  res.json(rows.map(serializeOrder));
}));

// PATCH /api/admin/orders/:id  { status?, deliveryDay?, deliveryDate?, paymentStatus?, refundStatus?, refundNote? }
// Unified order update: any subset of fields may be sent. Only admins reach here
// (router.use(requireAuth('admin')) above), and every change is persisted so the
// customer's My Orders page reflects it on its next refresh.
router.patch('/orders/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });

  // Once cancelled, the order's status and cancellation reason are frozen (it
  // can't be un-cancelled and a customer's reason must not be overwritten), but
  // the admin may STILL record/update the refund status + UTR afterwards — this
  // matters for orders the customer self-cancelled with no refund set yet.
  const alreadyCancelled = normalizeStatus(existing.status) === 'cancelled';
  // Delivered is also terminal: once delivered, neither the status nor the
  // delivery schedule may change.
  const alreadyDelivered = normalizeStatus(existing.status) === 'delivered';

  const { status, deliveryDay, deliveryDate, paymentStatus, refundStatus, refundNote, cancellationReason } = req.body;
  const updates = {};

  if (status !== undefined) {
    if (!isValidStatus(status)) return res.status(400).json({ error: 'Invalid status.' });
    const nextStatus = String(status).toLowerCase();
    if (alreadyCancelled && nextStatus !== 'cancelled') {
      return res.status(409).json({ error: 'This order is cancelled; its status can no longer be changed.' });
    }
    if (alreadyDelivered && nextStatus !== 'delivered') {
      return res.status(409).json({ error: 'This order is delivered; its status can no longer be changed.' });
    }
    if (nextStatus === 'cancelled' && !alreadyCancelled) {
      // A cancellation reason is mandatory (may arrive in this same request).
      const reason = (cancellationReason !== undefined ? cancellationReason : existing.cancellationReason) || '';
      if (!String(reason).trim()) {
        return res.status(400).json({ error: 'A cancellation reason is required to cancel an order.' });
      }
      // Record when + who cancelled, using the server clock (no custom date).
      updates.cancelledAt = new Date().toISOString();
      updates.cancelledBy = 'admin';
    }
    updates.status = nextStatus;
  }
  if (paymentStatus !== undefined) {
    if (!isValidPaymentStatus(paymentStatus)) return res.status(400).json({ error: 'Invalid payment status.' });
    updates.paymentStatus = String(paymentStatus).toLowerCase();
  }
  // Delivery schedule is frozen once the order is delivered or cancelled.
  if (deliveryDay !== undefined && !alreadyDelivered && !alreadyCancelled) {
    updates.deliveryDay = String(deliveryDay || '').trim() || null;
  }
  if (deliveryDate !== undefined && !alreadyDelivered && !alreadyCancelled) {
    updates.deliveryDate = String(deliveryDate || '').trim() || null;
  }
  // The cancellation reason is only editable while cancelling; never overwrite
  // it (especially a customer's reason) once the order is already cancelled.
  if (cancellationReason !== undefined && !alreadyCancelled) {
    updates.cancellationReason = String(cancellationReason || '').trim() || null;
  }

  // Refund fields (used for cancelled orders; refund is done manually via PhonePe etc.).
  // Once a refund is completed (marked Successful), it is finalised and locked —
  // no further refund changes are accepted.
  const refundFinalised = String(existing.refundStatus || '').toLowerCase() === 'successful';
  if (refundStatus !== undefined || refundNote !== undefined) {
    if (refundFinalised) {
      return res.status(409).json({ error: 'The refund is already completed and can no longer be changed.' });
    }
  }
  if (refundStatus !== undefined) {
    if (!isValidRefundStatus(refundStatus)) return res.status(400).json({ error: 'Invalid refund status.' });
    updates.refundStatus = String(refundStatus || '').toLowerCase() || null;
  }
  if (refundNote !== undefined) {
    const note = String(refundNote || '').trim();
    // The refund note is a UTR: any value entered must be a valid 12-digit UTR.
    if (note && !isValidUtr(note)) {
      return res.status(400).json({ error: `Invalid refund UTR. ${UTR_HELP}` });
    }
    updates.refundNote = note || null;
  }
  // A completed (successful) refund must carry a valid UTR — use the incoming
  // note, or fall back to whatever is already stored.
  const effectiveRefundStatus =
    (refundStatus !== undefined ? String(refundStatus || '').toLowerCase() : String(existing.refundStatus || '').toLowerCase());
  if (effectiveRefundStatus === 'successful') {
    const effectiveNote = refundNote !== undefined ? String(refundNote || '').trim() : String(existing.refundNote || '').trim();
    if (!isValidUtr(effectiveNote)) {
      return res.status(400).json({ error: `A valid UTR is required for a successful refund. ${UTR_HELP}` });
    }
  }
  // Stamp the refund update time whenever any refund field changes.
  if (refundStatus !== undefined || refundNote !== undefined) {
    updates.refundUpdatedAt = new Date().toISOString();
  }

  // Checked BEFORE the updatedAt stamp is added below, so a request carrying no
  // real changes is still rejected rather than silently touching the row.
  const keys = Object.keys(updates);
  if (keys.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
  updates.updatedAt = new Date().toISOString();

  // Column names are quoted so Postgres keeps their camel case (an unquoted
  // refundStatus would be folded to refundstatus and not match the column).
  // The keys come only from the fixed set assigned above, never from the
  // request body, so nothing user-controlled reaches the SQL text.
  const fields = Object.keys(updates);
  const setClause = fields.map((k) => `"${k}" = ?`).join(', ');
  await db.prepare(`UPDATE orders SET ${setClause} WHERE id = ?`).run(...fields.map((k) => updates[k]), id);

  const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  await recordAdminAction(req.auth, {
    action: 'order.update', entity: 'order', entityId: id,
    // Only the fields that actually changed, plus their previous values — a
    // compact, readable history of how the order reached its current state.
    details: { changed: updates, before: Object.fromEntries(keys.map((k) => [k, existing[k]])) },
  });
  res.json(serializeOrder(updated));
}));

// Back-compat: dedicated status endpoint delegates to the same logic.
router.patch('/orders/:id/status', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || '').toLowerCase();
  if (!isValidStatus(status)) return res.status(400).json({ error: 'Invalid status.' });
  const existing = await db.prepare('SELECT status FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });
  const current = normalizeStatus(existing.status);
  if (current === 'cancelled' && status !== 'cancelled') {
    return res.status(409).json({ error: 'This order is cancelled; its status can no longer be changed.' });
  }
  if (current === 'delivered' && status !== 'delivered') {
    return res.status(409).json({ error: 'This order is delivered; its status can no longer be changed.' });
  }
  await db.prepare('UPDATE orders SET status = ?, "updatedAt" = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
  await recordAdminAction(req.auth, {
    action: 'order.status_change', entity: 'order', entityId: id,
    details: { before: current, after: status },
  });
  res.json(serializeOrder(await db.prepare('SELECT * FROM orders WHERE id = ?').get(id)));
}));

// ---- Customers ----
// GET /api/admin/users  -- every registered customer, newest first, with their
// order history summarised. Deliberately never selects passwordHash.
router.get('/users', asyncHandler(async (_req, res) => {
  const rows = await db.prepare(`
    SELECT u.id, u.mobile, u.username, u."createdAt",
           COUNT(o.id)                                       AS "orderCount",
           COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN 0
                             ELSE o."totalAmount" END), 0)   AS "totalSpent",
           MAX(o."createdAt")                                AS "lastOrderAt"
    FROM users u
    LEFT JOIN orders o ON o."userId" = u.id
    GROUP BY u.id
    ORDER BY u.id DESC
  `).all();
  res.json(rows);
}));

// ---- Admin activity log ----
// GET /api/admin/activity?limit=100  -- the audit trail, newest first.
// The same rows are readable straight from the `admin_activity` table; this just
// makes them reachable without opening the database file.
router.get('/activity', asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
  const rows = await db.prepare('SELECT * FROM admin_activity ORDER BY id DESC LIMIT ?').all(limit);
  res.json(rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null })));
}));

export default router;
