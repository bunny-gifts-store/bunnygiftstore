import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { signUserToken, signAdminToken, requireAuth } from '../auth.js';
import { asyncHandler } from '../helpers.js';
import { recordAdminAction, recordAdminActionDeferred } from '../activity.js';

const router = Router();

const normalizeMobile = (m) => String(m || '').replace(/[^\d]/g, '');
const MIN_PASSWORD = 6;

const publicUser = (u) => ({ id: u.id, mobile: u.mobile, username: u.username });

// ---- Customer auth (password based) ----
// First-time users REGISTER with mobile + name + password. Afterwards they LOG
// IN with (mobile OR username) + password. A password is always required.

// POST /api/auth/register  { mobile, username, password }
router.post('/register', asyncHandler(async (req, res) => {
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
  // LOWER(...) on both sides is the Postgres equivalent of SQLite's COLLATE
  // NOCASE — the comparison stays case-insensitive, so "Ravi" and "ravi" are
  // still the same taken name.
  const nameOwner = await db.prepare('SELECT id, mobile FROM users WHERE LOWER(username) = LOWER(?)').get(username);
  if (nameOwner && nameOwner.mobile !== mobile) {
    return res.status(409).json({ error: 'This name is already taken. Please choose another.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const existing = await db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
  let user;
  if (existing) {
    // A password already set means the account exists — send them to login.
    if (existing.passwordHash) {
      return res.status(409).json({ error: 'An account with this mobile number already exists. Please log in.' });
    }
    // Legacy passwordless account: claim it by setting the name + password.
    await db.prepare('UPDATE users SET username = ?, "passwordHash" = ? WHERE id = ?')
      .run(username, passwordHash, existing.id);
    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
  } else {
    const info = await db.prepare('INSERT INTO users (mobile, username, "passwordHash") VALUES (?, ?, ?)')
      .run(mobile, username, passwordHash);
    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  res.json({ token: signUserToken(user), user: publicUser(user) });
}));

// POST /api/auth/login  { identifier, password }  -- identifier = mobile OR username
router.post('/login', asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier ?? req.body.mobile ?? '').trim();
  const password = String(req.body.password || '');

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Enter your mobile number / username and password.' });
  }

  const asMobile = normalizeMobile(identifier);
  const user = await db.prepare(
    'SELECT * FROM users WHERE mobile = ? OR LOWER(username) = LOWER(?)'
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
router.get('/me', requireAuth('user'), asyncHandler(async (req, res) => {
  const user = await db.prepare('SELECT id, mobile, username FROM users WHERE id = ?').get(req.auth.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
}));

// ---- Password reset (customer) ----
//
// Two steps, both stateless: /reset/lookup confirms the account exists so the
// UI can show the new-password fields, and /reset performs the change. The
// second step re-resolves the identifier itself and never trusts the first, so
// calling it directly gains an attacker nothing that step one didn't already
// grant.
//
// SECURITY NOTE — this flow has NO out-of-band verification (no OTP, no email
// link), because the store has no SMS or email channel to deliver one through.
// Anyone who knows a registered mobile number or username can therefore set a
// new password for that account. That is what the feature was specified to do;
// if you later add an SMS/email provider, the correct hardening is to issue a
// short-lived one-time code in /reset/lookup and require it in /reset.
// Rate limiting below is a mitigation, not a substitute.

// Tighter than the shared auth limiter: reset is the most abusable endpoint
// here (it both discloses whether an account exists and changes a credential),
// and no legitimate user needs many attempts.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Please try again in a little while.' },
});

// Identical resolution to the login route: a customer may identify themselves
// by mobile number or by username, matched case-insensitively and trimmed.
// Parameters are always bound, never interpolated, so the input cannot alter
// the query.
async function findUserByIdentifier(rawIdentifier) {
  const identifier = String(rawIdentifier ?? '').trim();
  if (!identifier) return null;
  const asMobile = normalizeMobile(identifier);
  return db
    .prepare('SELECT * FROM users WHERE mobile = ? OR LOWER(username) = LOWER(?)')
    .get(asMobile, identifier);
}

const NO_ACCOUNT_ERROR = 'No account found with the entered Mobile Number or Username.';

// POST /api/auth/reset/lookup  { identifier }  -- does this account exist?
router.post('/reset/lookup', resetLimiter, asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  if (!identifier) {
    return res.status(400).json({ error: 'Enter your mobile number or username.' });
  }
  if (!(await findUserByIdentifier(identifier))) {
    return res.status(404).json({ error: NO_ACCOUNT_ERROR });
  }
  // Deliberately returns nothing about the account — not the name, not the
  // masked mobile, not the id. The client only needs to know it may proceed.
  res.json({ ok: true });
}));

// POST /api/auth/reset  { identifier, password, confirmPassword }
router.post('/reset', resetLimiter, asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');
  // Confirmation is validated in the browser too; re-checked here because
  // client-side validation is a convenience, never a control.
  const confirmPassword = String(req.body.confirmPassword ?? password);

  if (!identifier) {
    return res.status(400).json({ error: 'Enter your mobile number or username.' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password cannot be empty.' });
  }
  // Same rule the registration route enforces — one constant, one behaviour.
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters.` });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const user = await findUserByIdentifier(identifier);
  if (!user) {
    return res.status(404).json({ error: NO_ACCOUNT_ERROR });
  }

  // ONLY the password column is touched. The row's id is preserved, so orders
  // (which reference users.id) and every other detail stay attached to this
  // same account — a reset must never look like a new registration.
  const passwordHash = bcrypt.hashSync(password, 10);
  await db.prepare('UPDATE users SET "passwordHash" = ? WHERE id = ?').run(passwordHash, user.id);

  // Security-relevant event: recorded in the server log, without the password.
  console.log(`[auth] Password reset completed for user #${user.id}.`);

  res.json({
    ok: true,
    message: 'Password updated successfully. Please login with your new password.',
  });
}));

// GET /api/auth/exists?mobile=  -> whether a mobile is already registered (signup UX)
router.get('/exists', asyncHandler(async (req, res) => {
  const mobile = normalizeMobile(req.query.mobile);
  if (!/^\d{10}$/.test(mobile)) return res.json({ exists: false });
  const user = await db.prepare('SELECT "passwordHash" FROM users WHERE mobile = ?').get(mobile);
  res.json({ exists: !!(user && user.passwordHash) });
}));

// ---- Admin auth ----
// POST /api/admin/login  { username, password }
router.post('/admin/login', asyncHandler(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const admin = await db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const token = signAdminToken(admin);
  // Reply first, then audit. The audit row is a second database write — another
  // network round trip that nothing in the response needs, so it must not sit
  // between the admin and their dashboard.
  res.json({ token, admin: { id: admin.id, username: admin.username } });
  // req.auth isn't set on the login route itself — pass the admin explicitly.
  recordAdminActionDeferred(
    { sub: admin.id, username: admin.username },
    { action: 'admin.login', entity: 'admin', entityId: admin.id }
  );
}));

// POST /api/admin/change-password  { currentPassword, newPassword }  (admin only)
router.post('/admin/change-password', requireAuth('admin'), asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  const admin = await db.prepare('SELECT * FROM admins WHERE id = ?').get(req.auth.sub);
  if (!admin || !bcrypt.compareSync(currentPassword, admin.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.prepare('UPDATE admins SET "passwordHash" = ? WHERE id = ?').run(hash, admin.id);
  await recordAdminAction(req.auth, { action: 'admin.password_change', entity: 'admin', entityId: admin.id });
  res.json({ ok: true });
}));

export default router;
