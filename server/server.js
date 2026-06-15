import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

const db = new Database(path.join(__dirname, 'bunnystore.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    transactionId TEXT NOT NULL,
    totalAmount REAL NOT NULL,
    totalItems INTEGER NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Bunny Gift Store API is live' });
});

app.get('/api/orders', (_req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  res.json(rows);
});

app.post('/api/orders', (req, res) => {
  const { name, email, phone, address, city, state, pincode, transactionId, totalAmount, totalItems } = req.body;

  if (!name || !email || !phone || !address || !city || !state || !pincode || !transactionId) {
    return res.status(400).json({ error: 'Missing required order fields' });
  }

  const stmt = db.prepare(`
    INSERT INTO orders (name, email, phone, address, city, state, pincode, transactionId, totalAmount, totalItems)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(name, email, phone, address, city, state, pincode, transactionId, Number(totalAmount || 0), Number(totalItems || 0));

  res.json({ ok: true, id: info.lastInsertRowid });
});

app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
