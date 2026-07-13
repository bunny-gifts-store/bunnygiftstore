import { Router } from 'express';
import { db } from '../db.js';
import { listProducts, getProductById, asyncHandler } from '../helpers.js';

const router = Router();

// GET /api/categories  -> categories that have at least one visible product
router.get('/categories', asyncHandler((_req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.slug, c.sortOrder,
           COUNT(p.id) FILTER (WHERE p.unavailable = 0) AS productCount
    FROM categories c
    LEFT JOIN products p ON p.categoryId = c.id
    GROUP BY c.id
    ORDER BY c.sortOrder ASC, c.name ASC
  `).all();
  res.json(rows);
}));

// GET /api/products?category=slug  -> visible products (unavailable excluded)
router.get('/products', asyncHandler((req, res) => {
  const categorySlug = req.query.category ? String(req.query.category) : null;
  res.json(listProducts({ includeHidden: false, categorySlug }));
}));

// GET /api/products/:id
router.get('/products/:id', asyncHandler((req, res) => {
  const product = getProductById(Number(req.params.id));
  if (!product || product.unavailable) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
}));

export default router;
