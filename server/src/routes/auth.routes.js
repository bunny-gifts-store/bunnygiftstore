import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, syncReplica } from '../db.js';
import { signUserToken, signAdminToken, requireAuth } from '../auth.js';
import { asyncHandler } from '../helpers.js';

const router = Router();

const normalizeMobile = (m) => String(m || '').replace(/[^\d]/g, '');
const MIN_PASSWORD = 6;

const publicUser = (u) => ({ id: u.id, mobile: u.mobile, username: u.username });

// ---- Customer auth (password based) ----
// First-time users REGISTER with mobile + name + password. Afterwards they LOG
// IN with (mobile OR username) + password. A password is always required.

// POST /api/auth/register  { mobile, username, password }
router.post('/register', asyncHandler((req, res) => {
  const mobile = normalizeMobile(req.body.mobile);
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  }
  if (username.length < 2) {
    return res.status(400).json({ error: 'Please enter your name (at least 2 characters).' });
  }
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters.` });
  }

  // Usernames must be unique so they can be used to log in. Allow the same name
  // only if it already belongs to this same mobile (a legacy account being set up).
  const nameOwner = db.prepare('SELECT id, mobile FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (nameOwner && nameOwner.mobile !== mobile) {
    return res.status(409).json({ error: 'This name is already taken. Please choose another.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const existing = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
  let user;
  if (existing) {
    // A password already set means the account exists — send them to login.
    if (existing.passwordHash) {
      return res.status(409).json({ error: 'An account with this mobile number already exists. Please log in.' });
    }
    // Legacy passwordless account: claim it by setting the name + password.
    db.prepare('UPDATE users SET username = ?, passwordHash = ? WHERE id = ?')
      .run(username, passwordHash, existing.id);
    syncReplica();
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
  } else {
    const info = db.prepare('INSERT INTO users (mobile, username, passwordHash) VALUES (?, ?, ?)')
      .run(mobile, username, passwordHash);
    syncReplica();
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  res.json({ token: signUserToken(user), user: publicUser(user) });
}));

// POST /api/auth/login  { identifier, password }  -- identifier = mobile OR username
router.post('/login', asyncHandler((req, res) => {
  const identifier = String(req.body.identifier ?? req.body.mobile ?? '').trim();
  const password = String(req.body.password || '');

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Enter your mobile number / username and password.' });
  }

  const asMobile = normalizeMobile(identifier);
  const user = db.prepare(
    'SELECT * FROM users WHERE mobile = ? OR username = ? COLLATE NOCASE'
  ).get(asMobile, identifier);

  if (!user) {
    return res.status(401).json({ error: 'No account found. Please check your details or create an account.' });
  }
  if (!user.passwordHash) {
    // Legacy account with no password yet — guide them to set one via register.
    return res.status(409).json({ error: 'NO_PASSWORD', message: 'This account has no password yet. Please use “Create account” to set one.' });
  }
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  res.json({ token: signUserToken(user), user: publicUser(user) });
}));

// GET /api/auth/me
router.get('/me', requireAuth('user'), asyncHandler((req, res) => {
  const user = db.prepare('SELECT id, mobile, username FROM users WHERE id = ?').get(req.auth.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
}));

// GET /api/auth/exists?mobile=  -> whether a mobile is already registered (signup UX)
router.get('/exists', asyncHandler((req, res) => {
  const mobile = normalizeMobile(req.query.mobile);
  if (!/^\d{10}$/.test(mobile)) return res.json({ exists: false });
  const user = db.prepare('SELECT passwordHash FROM users WHERE mobile = ?').get(mobile);
  res.json({ exists: !!(user && user.passwordHash) });
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
