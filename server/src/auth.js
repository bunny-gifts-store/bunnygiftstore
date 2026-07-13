import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function signUserToken(user) {
  return jwt.sign(
    { sub: user.id, mobile: user.mobile, role: 'user' },
    config.jwtSecret,
    { expiresIn: config.userTokenTtl }
  );
}

export function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin.id, username: admin.username, role: 'admin' },
    config.jwtSecret,
    { expiresIn: config.adminTokenTtl }
  );
}

function getToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

export function requireAuth(role) {
  return (req, res, next) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      if (role && payload.role !== role) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.auth = payload;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
