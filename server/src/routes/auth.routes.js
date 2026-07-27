import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, syncReplica } from '../db.js';
import { signUserToken, signAdminToken, requireAuth } from '../auth.js';
import { asyncHandler } from '../helpers.js';

const router = Router();

const normalizeMobile = (m) => String(m || '').replace(/[^\d]/g, '');

// ---- Customer auth (no OTP): identify by mobile, username only for first-time ----
// POST /api/auth/login  { mobile, username? }
router.post('/login', asyncHandler((req, res) => {
  const mobile = normalizeMobile(req.body.mobile);
  const username = String(req.body.username || '').trim();

  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  }

  let user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);

  if (!user) {
    // First-time user: username is required.
    if (!username) {
      return res.status(409).json({ error: 'NEW_USER', message: 'Please enter your name to register.' });
    }
    if (username.length < 2) {
      return res.status(400).json({ error: 'Please enter a valid name.' });
    }
    const info = db.prepare('INSERT INTO users (mobile, username) VALUES (?, ?)').run(mobile, username);
    syncReplica();
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  const token = signUserToken(user);
  res.json({ token, user: { id: user.id, mobile: user.mobile, username: user.username } });
}));

// GET /api/auth/me
router.get('/me', requireAuth('user'), asyncHandler((req, res) => {
  const user = db.prepare('SELECT id, mobile, username FROM users WHERE id = ?').get(req.auth.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
}));

// GET /api/auth/exists?mobile=  -> tells the UI whether to ask for a username
router.get('/exists', asyncHandler((req, res) => {
  const mobile = normalizeMobile(req.query.mobile);
  if (!/^\d{10}$/.test(mobile)) return res.json({ exists: false });
  const user = db.prepare('SELECT id FROM users WHERE mobile = ?').get(mobile);
  res.json({ exists: !!user });
}));

// ---- Admin auth ----
// POST /api/admin/login  { username, password }
router.post('/admin/login', asyncHandler((req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const token = signAdminToken(admin);
  res.json({ token, admin: { id: admin.id, username: admin.username } });
}));

// POST /api/admin/change-password  { currentPassword, newPassword }  (admin only)
router.post('/admin/change-password', requireAuth('admin'), asyncHandler((req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.auth.sub);
  if (!admin || !bcrypt.compareSync(currentPassword, admin.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admins SET passwordHash = ? WHERE id = ?').run(hash, admin.id);
  syncReplica();
  res.json({ ok: true });
}));

export default router;
