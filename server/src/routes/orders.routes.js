import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../auth.js';
import { asyncHandler } from '../helpers.js';
import { normalizeStatus } from '../orderStatus.js';

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

  const userId = optionalUser(req);
  const info = db.prepare(`
    INSERT INTO orders
      (userId, name, email, phone, address, city, state, pincode, transactionId,
       totalAmount, totalItems, items, status, paymentStatus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'paid')
  `).run(
    userId, name, email, phone, address, city, state, pincode, transactionId,
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

export default router;
