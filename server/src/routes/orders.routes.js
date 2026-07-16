import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../auth.js';
import { asyncHandler } from '../helpers.js';
import {
  normalizeStatus,
  USER_CANCELLABLE_STATUSES,
  CANCELLATION_WINDOW_MS,
  orderAgeMs,
  isValidUtr,
  UTR_HELP,
} from '../orderStatus.js';

const router = Router();

// Optionally attach the logged-in user (orders work for guests too).
function optionalUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      if (payload.role === 'user') return payload.sub;
    } catch { /* ignore */ }
  }
  return null;
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

// Shape an order row for the client (parse items, normalize status).
export function serializeOrder(o) {
  return {
    ...o,
    status: normalizeStatus(o.status),
    paymentStatus: o.paymentStatus || 'paid',
    items: o.items ? safeParse(o.items) : null,
  };
}

// POST /api/orders  -- checkout flow (stores item snapshot + userId when logged in)
router.post('/', asyncHandler((req, res) => {
  const { name, email, phone, address, city, state, pincode, transactionId, totalAmount, totalItems, items } = req.body;

  if (!name || !email || !phone || !address || !city || !state || !pincode || !transactionId) {
    return res.status(400).json({ error: 'Missing required order fields' });
  }
  // The transaction ID must be a valid UTR (12-digit UPI reference number).
  if (!isValidUtr(transactionId)) {
    return res.status(400).json({ error: `Invalid transaction ID. ${UTR_HELP}` });
  }

  // Prefer the logged-in user's id from the token. If that's unavailable
  // (missing/expired token), fall back to matching the order's phone against a
  // registered user's mobile — identity in this store IS the mobile number, so
  // this guarantees the order shows up in that customer's "My Orders".
  let userId = optionalUser(req);
  if (!userId) {
    const digits = String(phone || '').replace(/[^\d]/g, '').slice(-10);
    if (digits.length === 10) {
      const match = db.prepare('SELECT id FROM users WHERE mobile = ?').get(digits);
      if (match) userId = match.id;
    }
  }
  const info = db.prepare(`
    INSERT INTO orders
      (userId, name, email, phone, address, city, state, pincode, transactionId,
       totalAmount, totalItems, items, status, paymentStatus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'paid')
  `).run(
    userId, name, email, phone, address, city, state, pincode, String(transactionId).trim(),
    Number(totalAmount || 0), Number(totalItems || 0),
    items ? JSON.stringify(items) : null
  );

  res.json({ ok: true, id: info.lastInsertRowid });
}));

// GET /api/orders/mine  -- only the logged-in user's own orders (auth required).
router.get('/mine', requireAuth('user'), asyncHandler((req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE userId = ? ORDER BY id DESC').all(req.auth.sub);
  res.json(rows.map(serializeOrder));
}));

// POST /api/orders/:id/cancel  { reason }  -- customer self-cancellation.
// Server-side enforces every rule: ownership, early state, the 1-hour window,
// once-only, and a mandatory reason. Never trust the client's timer.
router.post('/:id/cancel', requireAuth('user'), asyncHandler((req, res) => {
  const id = Number(req.params.id);
  const reason = String(req.body.reason || '').trim();

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND userId = ?').get(id, req.auth.sub);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const status = normalizeStatus(order.status);
  if (status === 'cancelled') {
    return res.status(409).json({ error: 'This order has already been cancelled.' });
  }
  if (!USER_CANCELLABLE_STATUSES.includes(status)) {
    return res.status(409).json({ error: 'This order is already being processed and can no longer be cancelled.' });
  }
  if (orderAgeMs(order.createdAt) > CANCELLATION_WINDOW_MS) {
    return res.status(403).json({
      error: 'This order can no longer be cancelled because the 1-hour cancellation window has expired.',
    });
  }
  if (reason.length < 3) {
    return res.status(400).json({ error: 'Please provide a reason for cancelling the order.' });
  }

  db.prepare(`
    UPDATE orders
    SET status = 'cancelled', cancellationReason = ?, cancelledAt = ?, cancelledBy = 'user'
    WHERE id = ?
  `).run(reason, new Date().toISOString(), id);

  res.json(serializeOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(id)));
}));

export default router;
