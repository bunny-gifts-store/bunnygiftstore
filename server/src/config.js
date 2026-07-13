import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/ root (one level up from src/)
export const SERVER_ROOT = path.resolve(__dirname, '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

export const config = {
  port: Number(process.env.PORT) || 5000,
  dbPath: process.env.DB_PATH || path.join(SERVER_ROOT, 'bunnystore.db'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(SERVER_ROOT, 'uploads'),

  // JWT secret. MUST be overridden via env in production.
  jwtSecret: process.env.JWT_SECRET || 'bunny-gift-store-dev-secret-change-me',
  userTokenTtl: process.env.USER_TOKEN_TTL || '30d',
  adminTokenTtl: process.env.ADMIN_TOKEN_TTL || '12h',

  // Default admin, seeded once if no admin exists. Change the password after first login.
  defaultAdmin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'bunny@admin123',
  },

  // Comma-separated allowed origins for CORS. Empty = allow all (dev).
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
