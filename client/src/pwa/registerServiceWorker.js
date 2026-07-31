/* ============================================================
   Service worker registration
   ------------------------------------------------------------
   Registered in production builds only — in `vite dev` a caching
   worker would fight HMR. Use `npm run build && npm run preview`
   to exercise the PWA locally.
   ============================================================ */

// Re-check for a new deployment on this cadence while a tab stays open.
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

let waitingWorker = null;

/**
 * Register /sw.js.
 * @param {{ onUpdateReady?: () => void }} handlers
 *        `onUpdateReady` fires when a newer worker has installed and is waiting.
 */
export function registerServiceWorker({ onUpdateReady } = {}) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none', // always revalidate sw.js itself
      });

      // A worker already waiting when the page loads (update installed on a
      // previous visit that was never reloaded).
      if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorker = registration.waiting;
        onUpdateReady?.();
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // `controller` is null on the very first install — that's a fresh
          // cache fill, not an update, so don't nag the user about it.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorker = installing;
            onUpdateReady?.();
          }
        });
      });

      // Look for a new deployment periodically and whenever the tab is refocused.
      const checkForUpdate = () => registration.update().catch(() => {});
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    } catch {
      // Registration failures (unsupported browser, http://, blocked scope) must
      // never break the storefront — it simply runs without offline support.
    }
  });
}

/** Activate the waiting worker and reload once it has taken control. */
export function applyUpdate() {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }
  // Guard against the reload loop that fires if `controllerchange` is emitted
  // more than once.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  waitingWorker = null;
}
