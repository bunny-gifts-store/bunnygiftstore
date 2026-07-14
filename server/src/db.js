import Database from 'better-sqlite3';
import fs from 'fs';
import { config } from './config.js';

// Ensure uploads dir exists.
fs.mkdirSync(config.uploadsDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile    TEXT NOT NULL UNIQUE,
    username  TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    createdAt    TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL UNIQUE,
    slug      TEXT NOT NULL UNIQUE,
    sortOrder INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    price       REAL,
    priceLabel  TEXT,
    categoryId  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    image       TEXT,
    sizeOptions TEXT,               -- JSON array for frame-style variable pricing (nullable)
    outOfStock  INTEGER DEFAULT 0,  -- 0/1
    unavailable INTEGER DEFAULT 0,  -- 0/1 (hidden from storefront)
    sortOrder   INTEGER DEFAULT 0,
    createdAt   TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    userId        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL,
    phone         TEXT NOT NULL,
    address       TEXT NOT NULL,
    city          TEXT NOT NULL,
    state         TEXT NOT NULL,
    pincode       TEXT NOT NULL,
    transactionId TEXT NOT NULL,
    totalAmount   REAL NOT NULL,
    totalItems    INTEGER NOT NULL,
    items         TEXT,             -- JSON snapshot of cart items
    status        TEXT DEFAULT 'pending',  -- pending|confirmed|processing|packed|out_for_delivery|delivered|cancelled
    paymentStatus TEXT DEFAULT 'paid',     -- paid | pending | failed | refunded
    deliveryDay   TEXT,             -- owner's planned delivery day, e.g. "Monday" or "3-5 days"
    deliveryDate  TEXT,             -- owner's planned delivery date, e.g. "2026-07-20"
    createdAt     TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId);
`);

// The original orders table (from the previous version) may lack the newer
// columns. Add them defensively so existing databases keep working.
const orderCols = db.prepare(`PRAGMA table_info(orders)`).all().map((c) => c.name);
if (!orderCols.includes('userId')) {
  db.exec(`ALTER TABLE orders ADD COLUMN userId INTEGER`);
}
if (!orderCols.includes('items')) {
  db.exec(`ALTER TABLE orders ADD COLUMN items TEXT`);
}
if (!orderCols.includes('status')) {
  db.exec(`ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'`);
}
// Order-management additions (payment + delivery scheduling).
if (!orderCols.includes('paymentStatus')) {
  db.exec(`ALTER TABLE orders ADD COLUMN paymentStatus TEXT DEFAULT 'paid'`);
}
if (!orderCols.includes('deliveryDay')) {
  db.exec(`ALTER TABLE orders ADD COLUMN deliveryDay TEXT`);
}
if (!orderCols.includes('deliveryDate')) {
  db.exec(`ALTER TABLE orders ADD COLUMN deliveryDate TEXT`);
}

export default db;
