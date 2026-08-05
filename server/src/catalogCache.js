import fs from 'fs';
import path from 'path';
import { SERVER_ROOT } from './config.js';

// ---------------------------------------------------------------------------
// Last known-good catalogue.
//
// The store runs on free hosting where the database is a separate service that
// can become unreachable (see the Turso 502 outage documented in README-APP.md).
// Without this, such an outage takes the whole storefront down: no products, no
// categories, nothing to look at.
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

/** Categories from the snapshot, or null when there is nothing cached. */
export function cachedCategories() {
  return memory?.categories?.length ? memory.categories : null;
}

/**
 * Products from the snapshot, optionally filtered by category slug — applied
 * here so a filtered request degrades the same way an unfiltered one does.
 */
export function cachedProducts(categorySlug = null) {
  if (!memory?.products?.length) return null;
  if (!categorySlug) return memory.products;
  return memory.products.filter((p) => p.categorySlug === categorySlug);
}

/** When the snapshot was taken, for the stale-data header. */
export function cachedAt() {
  return memory?.savedAt ?? null;
}

// Note: on free hosting the snapshot lives on the same ephemeral disk as
// everything else, so it survives a process restart but not a redeploy that
// replaces the container. The first successful catalogue read refills it.
export const catalogCacheStatus = () => ({
  present: Boolean(memory?.products?.length),
  savedAt: memory?.savedAt ?? null,
  products: memory?.products?.length ?? 0,
  categories: memory?.categories?.length ?? 0,
});
