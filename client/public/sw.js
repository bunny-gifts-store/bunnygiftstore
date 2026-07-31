/* ============================================================
   Bunny Gift Store — Service Worker
   ------------------------------------------------------------
   Hand-written (no Workbox) so the storefront picks up offline
   support and installability without adding build dependencies.

   Ground rule: this worker NEVER intercepts anything it does not
   explicitly know how to cache. API traffic, POSTs and anything
   unrecognised fall straight through to the network exactly as
   they did before the PWA existed.

   `__SW_BUILD__` is replaced with the build timestamp by the
   `stamp-service-worker` plugin in vite.config.js, so every
   deployment ships a byte-different worker and browsers reliably
   detect the update.
   ============================================================ */

const BUILD = '__SW_BUILD__';

// Shell is rebuilt on every deploy; the others are content-addressed or
// immutable, so they survive across versions and are pruned by size instead.
const SHELL_CACHE = `bgs-shell-${BUILD}`;
const ASSET_CACHE = 'bgs-assets-v1';
const IMAGE_CACHE = 'bgs-images-v1';
const CDN_CACHE = 'bgs-cdn-v1';

const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE, CDN_CACHE];

// Entry points + the offline fallback. Everything else is cached on first use.
const SHELL_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/css/style.css',
  '/images/favicon.png',
  '/images/pwa-icon-192.png',
  '/images/pwa-icon-512.png',
];

// Rough LRU caps so a long-lived install can't grow without bound.
const MAX_ASSET_ENTRIES = 80;
const MAX_IMAGE_ENTRIES = 150;

// Third-party origins the storefront loads its CSS/fonts from.
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i;
const FONT_EXT = /\.(woff2?|ttf|otf|eot)$/i;

/* ---------------- helpers ---------------- */

/**
 * Store a response, tolerating opaque/CDN responses and quota errors.
 * Deliberately not `async`: the body must be cloned synchronously, before the
 * caller hands the original response to the page and its body is consumed.
 */
function put(cacheName, request, response) {
  if (!response || (!response.ok && response.type !== 'opaque')) return Promise.resolve();
  let copy;
  try {
    copy = response.clone();
  } catch {
    return Promise.resolve(); // body already used — nothing we can do
  }
  return caches
    .open(cacheName)
    .then((cache) => cache.put(request, copy))
    .catch(() => {
      /* quota exceeded or an uncacheable response — not worth failing the fetch */
    });
}

/** Trim a cache back to `max` entries, oldest-inserted first. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

/** Cache-first: ideal for hashed/immutable assets and images. */
async function cacheFirst(request, cacheName, max) {
  const cached = await caches.match(request, { cacheName });
  if (cached) return cached;
  const response = await fetch(request);
  await put(cacheName, request, response);
  if (max) trim(cacheName, max);
  return response;
}

/** Stale-while-revalidate: instant paint, refreshed in the background. */
async function staleWhileRevalidate(request, cacheName, max) {
  const cached = await caches.match(request, { cacheName });
  const network = fetch(request)
    .then(async (response) => {
      await put(cacheName, request, response);
      if (max) trim(cacheName, max);
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

/**
 * Navigations: always try the network so a fresh deploy is picked up
 * immediately, and fall back to the cached shell (then the offline page)
 * when the device is offline.
 */
async function handleNavigation(event) {
  try {
    // Use the navigation preload response when the browser has already started
    // it, otherwise fetch normally.
    const response = (await event.preloadResponse) || (await fetch(event.request));
    // Keep the shell copy warm for the next offline visit — but only for SPA
    // routes. A direct hit on a real file (e.g. /legal/terms.html) returns that
    // file, which must not be stored under the /index.html key.
    const { pathname } = new URL(event.request.url);
    if (!/\.[a-z0-9]+$/i.test(pathname) || pathname === '/index.html') {
      put(SHELL_CACHE, '/index.html', response);
    }
    return response;
  } catch {
    return (
      (await caches.match('/index.html', { cacheName: SHELL_CACHE })) ||
      (await caches.match('/index.html')) ||
      (await caches.match('/offline.html')) ||
      Response.error()
    );
  }
}

/* ---------------- lifecycle ---------------- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one missing file can't abort the whole install.
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('bgs-') && !CURRENT_CACHES.includes(n))
          .map((n) => caches.delete(n))
      );
      // Serve navigation preloads where supported — removes the SW start-up
      // cost from the critical path on repeat visits.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => {});
      }
      await self.clients.claim();
    })()
  );
});

/* The page asks the waiting worker to take over when the user accepts an update. */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------------- fetch routing ---------------- */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever touch GETs over http(s). Never mutations, never chrome-extension://
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (!url.protocol.startsWith('http')) return;

  const sameOrigin = url.origin === self.location.origin;

  // API traffic must always be live — never intercepted, never cached.
  // (Matches both the dev proxy and the API's own origin in production.)
  if (url.pathname.startsWith('/api')) return;

  // The worker script itself is never served from cache.
  if (sameOrigin && url.pathname === '/sw.js') return;

  // Full page loads / reloads.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (sameOrigin) {
    // Vite emits content-hashed filenames under /assets — safe to cache forever.
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request, ASSET_CACHE, MAX_ASSET_ENTRIES));
      return;
    }
    // Product photos and uploads: cache-first, they rarely change in place.
    if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/uploads/') || IMAGE_EXT.test(url.pathname)) {
      event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
      return;
    }
    // Unhashed static files: the legacy theme CSS, fonts, the manifest, and the
    // policy fragments in /legal that Policy.jsx fetches at runtime.
    if (/\.(css|js|json|webmanifest|html)$/i.test(url.pathname) || FONT_EXT.test(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
      return;
    }
    return;
  }

  // Admin-uploaded product photos live on the API host (`${API_BASE}/uploads/…`),
  // so cache them too — otherwise the catalogue would be imageless offline.
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  // Bootstrap CSS + Google Fonts.
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, CDN_CACHE, MAX_ASSET_ENTRIES));
  }

  // Anything else (e.g. API JSON on its own origin) is left untouched.
});
