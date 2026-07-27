import { db } from './db.js';

// Convert a DB product row (with joined category fields) into an API object.
export function mapProduct(row) {
  if (!row) return null;
  let sizeOptions = null;
  if (row.sizeOptions) {
    try { sizeOptions = JSON.parse(row.sizeOptions); } catch { sizeOptions = null; }
  }
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || '',
    price: row.price,
    priceLabel: row.priceLabel || null,
    categoryId: row.categoryId,
    category: row.categoryName || null,
    categorySlug: row.categorySlug || null,
    image: row.image,
    sizeOptions,
    outOfStock: !!row.outOfStock,
    unavailable: !!row.unavailable,
    sortOrder: row.sortOrder,
  };
}

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS categoryName, c.slug AS categorySlug
  FROM products p
  LEFT JOIN categories c ON c.id = p.categoryId
`;

export function getProductById(id) {
  return mapProduct(db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id));
}

export function listProducts({ includeHidden = false, categorySlug = null } = {}) {
  const clauses = [];
  const params = [];
  if (!includeHidden) {
    clauses.push('p.unavailable = 0');
  }
  if (categorySlug) {
    clauses.push('c.slug = ?');
    params.push(categorySlug);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`${PRODUCT_SELECT} ${where} ORDER BY p.sortOrder ASC, p.id ASC`)
    .all(...params);
  return rows.map(mapProduct);
}

// Normalize a product's frame-size options into a clean JSON string for storage
// (or null when there are none). Accepts an array of option objects, a JSON
// string, or null/'' — so it works for both create (raw array from the admin UI)
// and update (where the existing product already carries a parsed array).
//
// Each option is shaped { width, height, label, price }:
//   - width/height/label are trimmed strings (label auto-derived from
//     width×height when omitted),
//   - price must be a finite number >= 0.
// Invalid rows are dropped; if nothing valid remains, the result is null.
export function normalizeSizeOptions(input) {
  if (input == null || input === '') return null;

  let arr = input;
  if (typeof input === 'string') {
    try { arr = JSON.parse(input); } catch { return null; }
  }
  if (!Array.isArray(arr)) return null;

  const cleaned = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const width = String(raw.width ?? '').trim();
    const height = String(raw.height ?? '').trim();
    let label = String(raw.label ?? '').trim();
    const price = Number(raw.price);

    // A price is mandatory (the size's cost); a size with no dimensions AND no
    // label carries no information, so it's dropped.
    if (!Number.isFinite(price) || price < 0) continue;
    if (!label) {
      label = width && height ? `${width}/${height} Inch` : width || height || '';
    }
    if (!label) continue;

    cleaned.push({ width, height, label, price });
  }

  return cleaned.length ? JSON.stringify(cleaned) : null;
}

// Small async wrapper so thrown errors reach the error middleware.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
