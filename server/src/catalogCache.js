import fs from 'fs';
import path from 'path';
import { SERVER_ROOT } from './config.js';
import { CATEGORIES, PRODUCTS, FRAME_SIZE_OPTIONS, slugify } from './seed.js';

// ---------------------------------------------------------------------------
// Last known-good catalogue.
//
// The store runs on free hosting where the database is a separate service that
// can become unreachable — and has been. Without this, such an outage takes the
// whole storefront down: no products, no categories, nothing to look at.
//
// So every successful catalogue read is remembered — in memory, and on disk so
// it survives a process restart. When the database is unavailable, the
// catalogue is served from that copy and flagged as stale.
//
// WHAT THIS DELIBERATELY DOES NOT DO: it never caches anything a customer could
// act on incorrectly. Orders, logins and registrations still fail outright when
// the database is down, because accepting an order we cannot store — or
// authenticating against a stale copy of credentials — would be far worse than
// an honest error. This makes the store *browsable* during an outage, not
// operational.
// ---------------------------------------------------------------------------

const CACHE_DIR = process.env.CACHE_DIR || path.join(SERVER_ROOT, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'catalog.json');

// Shape: { categories: [...], products: [...], savedAt: ISO string }
let memory = null;

/** Load the cache from disk into memory. Called once at boot. */
export function loadCatalogCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (!parsed || !Array.isArray(parsed.products)) return null;
    memory = parsed;
    console.log(
      `[cache] Loaded catalogue snapshot from ${parsed.savedAt} ` +
      `(${parsed.products.length} products, ${parsed.categories?.length ?? 0} categories).`
    );
    return memory;
  } catch (err) {
    console.error('[cache] Could not load catalogue snapshot:', err.message);
    return null;
  }
}

/**
 * Remember a successful catalogue read.
 *
 * Categories and products arrive from separate endpoints, so each side updates
 * independently and an empty list never overwrites a populated one — otherwise
 * whichever endpoint happened to be called first would blank the other half of
 * the snapshot.
 */
export function saveCatalogCache({ categories, products }) {
  const nextProducts = Array.isArray(products) && products.length ? products : memory?.products ?? [];
  const nextCategories = Array.isArray(categories) && categories.length ? categories : memory?.categories ?? [];
  if (!nextProducts.length && !nextCategories.length) return;

  const next = {
    categories: nextCategories,
    products: nextProducts,
    savedAt: new Date().toISOString(),
  };
  memory = next;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    // Write-then-rename so a crash mid-write can't leave a truncated file that
    // would fail to parse on the next boot.
    const tmp = `${CACHE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next));
    fs.renameSync(tmp, CACHE_FILE);
  } catch (err) {
    // A cache that can't be persisted still works in memory for this process.
    console.error('[cache] Could not persist catalogue snapshot:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Last-resort fallback: the catalogue that ships with the code.
//
// The disk snapshot only exists once a catalogue read has succeeded, so it is
// empty on a container that has NEVER reached the database — exactly the case
// during the 5 Aug 2026 outage, where a redeploy landed while the database was
// down and the storefront was blank despite the caching above.
//
// The built-in catalogue in seed.js is the same data a fresh database is seeded
// with, so serving it means shoppers always see a store. It is only used when
// there is no snapshot at all; a real snapshot always wins because it includes
// anything the admin has added or edited since.
//
// Ids are synthesised in seed order, which is the order a fresh database
// assigns them — so they line up with a seeded database in the common case.
// Ordering is blocked during an outage regardless, so an id that doesn't match
// can't reach a real order.
// ---------------------------------------------------------------------------
let bundled = null;

function buildBundled() {
  if (bundled) return bundled;

  const categories = CATEGORIES.map((name, i) => ({
    id: i + 1,
    name,
    slug: slugify(name),
    sortOrder: i,
    productCount: 0,
  }));
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const idByName = new Map(categories.map((c) => [c.name, c.id]));

  const shape = (row, i, extra) => ({
    id: i + 1,
    code: row.code,
    name: row.name,
    description: row.description || '',
    price: row.price ?? null,
    priceLabel: null,
    categoryId: idByName.get(row.category) ?? null,
    category: row.category ?? null,
    categorySlug: row.category ? slugify(row.category) : null,
    image: `images/${row.code}.png`,
    sizeOptions: null,
    outOfStock: false,
    unavailable: false,
    sortOrder: i,
    ...extra,
  });

  const products = PRODUCTS.map((p, i) => shape(p, i));

  // Photo frames (F1..F27) carry per-size pricing rather than a flat price.
  const framesCategory = 'Photo Frames';
  for (let i = 0; i < 27; i++) {
    const code = `F${i + 1}`;
    products.push(shape(
      {
        code,
        name: `Photo Frame ${code}`,
        description: 'High-quality photo frame available in multiple sizes.',
        price: null,
        category: framesCategory,
      },
      PRODUCTS.length + i,
      {
        priceLabel: 'From ₹500',
        image: `images/frames/${i + 1}.png`,
        sizeOptions: FRAME_SIZE_OPTIONS,
        sortOrder: 100 + i,
      }
    ));
  }

  // The storefront hides categories with no products, so these must be real.
  for (const p of products) {
    const c = p.categorySlug ? bySlug.get(p.categorySlug) : null;
    if (c) c.productCount += 1;
  }

  bundled = { categories, products };
  return bundled;
}

/** Categories from the snapshot, falling back to the bundled catalogue. */
export function cachedCategories() {
  if (memory?.categories?.length) return memory.categories;
  return buildBundled().categories;
}

/**
 * Products from the snapshot, optionally filtered by category slug — applied
 * here so a filtered request degrades the same way an unfiltered one does.
 * Falls back to the bundled catalogue when no snapshot exists.
 */
export function cachedProducts(categorySlug = null) {
  const source = memory?.products?.length ? memory.products : buildBundled().products;
  if (!categorySlug) return source;
  return source.filter((p) => p.categorySlug === categorySlug);
}

/** Where a degraded response's data came from — for the health endpoint. */
export function catalogSource() {
  return memory?.products?.length ? 'snapshot' : 'bundled';
}

/** When the snapshot was taken, for the stale-data header. */
export function cachedAt() {
  return memory?.savedAt ?? null;
}

// Note: on free hosting the snapshot lives on the same ephemeral disk as
// everything else, so it survives a process restart but not a redeploy that
// replaces the container. The first successful catalogue read refills it.
export const catalogCacheStatus = () => ({
  // What a degraded catalogue response would be served from right now.
  source: catalogSource(),
  snapshot: {
    present: Boolean(memory?.products?.length),
    savedAt: memory?.savedAt ?? null,
    products: memory?.products?.length ?? 0,
    categories: memory?.categories?.length ?? 0,
  },
});
