import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../helpers.js';

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

// POST /api/orders  -- unchanged checkout flow (now also stores item snapshot + userId)
router.post('/', asyncHandler((req, res) => {
  const { name, email, phone, address, city, state, pincode, transactionId, totalAmount, totalItems, items } = req.body;

  if (!name || !email || !phone || !address || !city || !state || !pincode || !transactionId) {
    return res.status(400).json({ error: 'Missing required order fields' });
  }

  const userId = optionalUser(req);
  const info = db.prepare(`
    INSERT INTO orders (userId, name, email, phone, address, city, state, pincode, transactionId, totalAmount, totalItems, items)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId, name, email, phone, address, city, state, pincode, transactionId,
    Number(totalAmount || 0), Number(totalItems || 0),
    items ? JSON.stringify(items) : null
  );

  res.json({ ok: true, id: info.lastInsertRowid });
}));

export default router;
