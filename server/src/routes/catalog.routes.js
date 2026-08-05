import { Router } from 'express';
import { db, dbStatus, markDbUnavailable } from '../db.js';
import { listProducts, getProductById, asyncHandler } from '../helpers.js';
import {
  saveCatalogCache,
  cachedCategories,
  cachedProducts,
  cachedAt,
} from '../catalogCache.js';

const router = Router();

// These routes are NOT behind the requireDb gate in app.js. They handle an
// unavailable database themselves by falling back to the last known-good
// catalogue, so an outage leaves the storefront browsable instead of blank.
// Every other data route still fails fast — see catalogCache.js for why.

/** Mark a response as coming from the snapshot rather than the live database. */
function serveStale(res, payload) {
  res.set('X-Catalog-Stale', 'true');
  if (cachedAt()) res.set('X-Catalog-Cached-At', cachedAt());
  // Don't let a CDN or the service worker hold on to degraded data.
  res.set('Cache-Control', 'no-store');
  return res.json(payload);
}

/** Whether a live query should even be attempted. */
const dbUsable = () => dbStatus.ready;

// GET /api/categories  -> categories that have at least one visible product
router.get('/categories', asyncHandler((_req, res) => {
  if (dbUsable()) {
    try {
      const rows = db.prepare(`
        SELECT c.id, c.name, c.slug, c.sortOrder,
               COUNT(p.id) FILTER (WHERE p.unavailable = 0) AS productCount
        FROM categories c
        LEFT JOIN products p ON p.categoryId = c.id
        GROUP BY c.id
        ORDER BY c.sortOrder ASC, c.name ASC
      `).all();
      // Empty products deliberately: saveCatalogCache keeps whatever it already
      // holds and only replaces the category list. Passing cachedProducts()
      // here would be wrong — it falls back to the BUNDLED catalogue, which
      // would then be written into the snapshot as if it were live data.
      saveCatalogCache({ categories: rows, products: [] });
      return res.json(rows);
    } catch (err) {
      // The database was ready a moment ago but this query failed: treat it as
      // an outage rather than a 500. markDbUnavailable also (re)starts the
      // recovery loop, so a database that dies mid-life reconnects on its own
      // instead of leaving the API degraded until someone restarts it.
      console.error('[catalog] categories query failed, serving snapshot:', err.message);
      markDbUnavailable(err.message);
    }
  }

  const cached = cachedCategories();
  if (cached) return serveStale(res, cached);
  return res.status(503).json({ error: 'The store catalogue is temporarily unavailable. Please try again shortly.' });
}));

// GET /api/products?category=slug  -> visible products (unavailable excluded)
router.get('/products', asyncHandler((req, res) => {
  const categorySlug = req.query.category ? String(req.query.category) : null;

  if (dbUsable()) {
    try {
      const products = listProducts({ includeHidden: false, categorySlug });
      // Only an unfiltered read is a complete snapshot worth storing. Empty
      // categories for the same reason as above — the existing ones are kept.
      if (!categorySlug) saveCatalogCache({ categories: [], products });
      return res.json(products);
    } catch (err) {
      console.error('[catalog] products query failed, serving snapshot:', err.message);
      markDbUnavailable(err.message);
    }
  }

  const cached = cachedProducts(categorySlug);
  if (cached) return serveStale(res, cached);
  return res.status(503).json({ error: 'The store catalogue is temporarily unavailable. Please try again shortly.' });
}));

// GET /api/products/:id
router.get('/products/:id', asyncHandler((req, res) => {
  const id = Number(req.params.id);

  if (dbUsable()) {
    try {
      const product = getProductById(id);
      if (!product || product.unavailable) return res.status(404).json({ error: 'Product not found' });
      return res.json(product);
    } catch (err) {
      console.error('[catalog] product query failed, serving snapshot:', err.message);
      markDbUnavailable(err.message);
    }
  }

  const product = (cachedProducts() || []).find((p) => p.id === id);
  if (product) return serveStale(res, product);
  return res.status(503).json({ error: 'This product is temporarily unavailable. Please try again shortly.' });
}));

export default router;
