import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../auth.js';
import { getProductById, listProducts, asyncHandler } from '../helpers.js';
import { isValidStatus, isValidPaymentStatus, isValidRefundStatus, normalizeStatus } from '../orderStatus.js';
import { serializeOrder } from './orders.routes.js';

const router = Router();
router.use(requireAuth('admin'));

const slugify = (s) =>
  String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ---- Image upload ----
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const base = `item-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, base + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

// POST /api/admin/upload  (multipart, field: "image") -> { path }
router.post('/upload', upload.single('image'), asyncHandler((req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
  res.json({ path: `uploads/${req.file.filename}` });
}));

// ---- Categories ----
router.get('/categories', asyncHandler((_req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY sortOrder ASC, name ASC').all());
}));

router.post('/categories', asyncHandler((req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  const sortOrder = Number(req.body.sortOrder) || 0;
  try {
    const info = db.prepare('INSERT INTO categories (name, slug, sortOrder) VALUES (?, ?, ?)')
      .run(name, slugify(name), sortOrder);
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Category already exists.' });
    throw e;
  }
}));

router.put('/categories/:id', asyncHandler((req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Category not found.' });
  const name = req.body.name != null ? String(req.body.name).trim() : existing.name;
  const sortOrder = req.body.sortOrder != null ? Number(req.body.sortOrder) : existing.sortOrder;
  db.prepare('UPDATE categories SET name = ?, slug = ?, sortOrder = ? WHERE id = ?')
    .run(name, slugify(name), sortOrder, id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
}));

router.delete('/categories/:id', asyncHandler((req, res) => {
  const id = Number(req.params.id);
  const count = db.prepare('SELECT COUNT(*) AS c FROM products WHERE categoryId = ?').get(id).c;
  if (count > 0) {
    return res.status(409).json({ error: `Cannot delete: ${count} product(s) use this category. Reassign them first.` });
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ ok: true });
}));

// ---- Products ----
router.get('/products', asyncHandler((_req, res) => {
  res.json(listProducts({ includeHidden: true }));
}));

router.get('/products/:id', asyncHandler((req, res) => {
  const product = getProductById(Number(req.params.id));
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
    outOfStock: body.outOfStock ? 1 : 0,
    unavailable: body.unavailable ? 1 : 0,
    sortOrder: body.sortOrder != null ? Number(body.sortOrder) : 0,
  };
}

router.post('/products', asyncHandler((req, res) => {
  const p = parseProductBody(req.body);
  if (!p.code || !p.name) return res.status(400).json({ error: 'Product code and name are required.' });
  if (p.price == null && !p.priceLabel) return res.status(400).json({ error: 'Enter a price.' });
  try {
    const info = db.prepare(`
      INSERT INTO products (code, name, description, price, priceLabel, categoryId, image, outOfStock, unavailable, sortOrder)
      VALUES (@code, @name, @description, @price, @priceLabel, @categoryId, @image, @outOfStock, @unavailable, @sortOrder)
    `).run(p);
    res.status(201).json(getProductById(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'A product with this code already exists.' });
    throw e;
  }
}));

router.put('/products/:id', asyncHandler((req, res) => {
  const id = Number(req.params.id);
  const existing = getProductById(id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const p = parseProductBody({ ...existing, ...req.body });
  if (!p.code || !p.name) return res.status(400).json({ error: 'Product code and name are required.' });
  try {
    db.prepare(`
      UPDATE products
      SET code=@code, name=@name, description=@description, price=@price, priceLabel=@priceLabel,
          categoryId=@categoryId, image=@image, outOfStock=@outOfStock, unavailable=@unavailable,
          sortOrder=@sortOrder, updatedAt=CURRENT_TIMESTAMP
      WHERE id=@id
    `).run({ ...p, id });
    res.json(getProductById(id));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'A product with this code already exists.' });
    throw e;
  }
}));

// PATCH /api/admin/products/:id/status  { outOfStock?, unavailable? } -- instant toggles
router.patch('/products/:id/status', asyncHandler((req, res) => {
  const id = Number(req.params.id);
  const existing = getProductById(id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const outOfStock = req.body.outOfStock != null ? (req.body.outOfStock ? 1 : 0) : (existing.outOfStock ? 1 : 0);
  const unavailable = req.body.unavailable != null ? (req.body.unavailable ? 1 : 0) : (existing.unavailable ? 1 : 0);
  db.prepare('UPDATE products SET outOfStock = ?, unavailable = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')
    .run(outOfStock, unavailable, id);
  res.json(getProductById(id));
}));

router.delete('/products/:id', asyncHandler((req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT image FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  // Best-effort cleanup of an uploaded image (never touch bundled images/).
  if (existing.image && existing.image.startsWith('uploads/')) {
    const file = path.join(config.uploadsDir, path.basename(existing.image));
    fs.rm(file, () => {});
  }
  res.json({ ok: true });
}));

// ---- Orders (admin view) ----
router.get('/orders', asyncHandler((_req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  res.json(rows.map(serializeOrder));
}));

// PATCH /api/admin/orders/:id  { status?, deliveryDay?, deliveryDate?, paymentStatus?, refundStatus?, refundNote? }
// Unified order update: any subset of fields may be sent. Only admins reach here
// (router.use(requireAuth('admin')) above), and every change is persisted so the
// customer's My Orders page reflects it on its next refresh.
router.patch('/orders/:id', asyncHandler((req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });

  // Cancelled is terminal AND fully locked: once an order has been committed as
  // cancelled, nothing about it (status, reason, refund, UTR, delivery) may
  // change. The single PATCH that first cancels the order is still allowed
  // because at that point the stored status is not yet 'cancelled'.
  if (normalizeStatus(existing.status) === 'cancelled') {
    return res.status(409).json({ error: 'This order is cancelled and locked; it can no longer be modified.' });
  }

  const { status, deliveryDay, deliveryDate, paymentStatus, refundStatus, refundNote, cancellationReason } = req.body;
  const updates = {};

  if (status !== undefined) {
    if (!isValidStatus(status)) return res.status(400).json({ error: 'Invalid status.' });
    const nextStatus = String(status).toLowerCase();
    if (nextStatus === 'cancelled') {
      // A cancellation reason is mandatory (may arrive in this same request).
      const reason = (cancellationReason !== undefined ? cancellationReason : existing.cancellationReason) || '';
      if (!String(reason).trim()) {
        return res.status(400).json({ error: 'A cancellation reason is required to cancel an order.' });
      }
    }
    updates.status = nextStatus;
  }
  if (paymentStatus !== undefined) {
    if (!isValidPaymentStatus(paymentStatus)) return res.status(400).json({ error: 'Invalid payment status.' });
    updates.paymentStatus = String(paymentStatus).toLowerCase();
  }
  if (deliveryDay !== undefined) updates.deliveryDay = String(deliveryDay || '').trim() || null;
  if (deliveryDate !== undefined) updates.deliveryDate = String(deliveryDate || '').trim() || null;
  if (cancellationReason !== undefined) {
    updates.cancellationReason = String(cancellationReason || '').trim() || null;
  }

  // Refund fields (used for cancelled orders; refund is done manually via PhonePe etc.).
  if (refundStatus !== undefined) {
    if (!isValidRefundStatus(refundStatus)) return res.status(400).json({ error: 'Invalid refund status.' });
    updates.refundStatus = String(refundStatus || '').toLowerCase() || null;
  }
  if (refundNote !== undefined) updates.refundNote = String(refundNote || '').trim() || null;
  // Stamp the refund update time whenever any refund field changes.
  if (refundStatus !== undefined || refundNote !== undefined) {
    updates.refundUpdatedAt = new Date().toISOString();
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE orders SET ${setClause} WHERE id = @id`).run({ ...updates, id });

  res.json(serializeOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(id)));
}));

// Back-compat: dedicated status endpoint delegates to the same logic.
router.patch('/orders/:id/status', asyncHandler((req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || '').toLowerCase();
  if (!isValidStatus(status)) return res.status(400).json({ error: 'Invalid status.' });
  const existing = db.prepare('SELECT status FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });
  if (normalizeStatus(existing.status) === 'cancelled' && status !== 'cancelled') {
    return res.status(409).json({ error: 'This order is cancelled; its status can no longer be changed.' });
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  res.json(serializeOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(id)));
}));

export default router;
