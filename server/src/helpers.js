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

// Small async wrapper so thrown errors reach the error middleware.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
