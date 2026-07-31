/* ============================================================
   Install-prompt store
   ------------------------------------------------------------
   `beforeinstallprompt` fires once, and often before React has
   mounted, so the event is captured here at module scope and kept
   in a tiny external store. Every install button in the app reads
   from this single source, which is what guarantees we never show
   two competing prompts.
   ============================================================ */

/** True when the app is already running as an installed app. */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches === true ||
    window.navigator.standalone === true // iOS Safari
  );
}

/**
 * iOS/iPadOS never fires `beforeinstallprompt` — installing there is a manual
 * "Share → Add to Home Screen". Detected so we can show instructions instead of
 * a dead button. iPadOS 13+ reports as a Mac, hence the touch-point check.
 */
export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

const state = {
  deferredPrompt: null, // the captured BeforeInstallPromptEvent, if any
  installed: isStandalone(),
};

const listeners = new Set();

function emit() {
  // Recreate the snapshot object so useSyncExternalStore sees a new reference.
  snapshot = { canPrompt: state.deferredPrompt !== null, installed: state.installed };
  listeners.forEach((fn) => fn());
}

let snapshot = { canPrompt: false, installed: state.installed };

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return snapshot;
}

/**
 * Trigger the browser's native install prompt.
 * @returns {Promise<'accepted'|'dismissed'|'unavailable'>}
 */
export async function promptInstall() {
  const evt = state.deferredPrompt;
  if (!evt) return 'unavailable';

  // A captured prompt can only be used once — drop it before awaiting so a
  // double click cannot fire it twice.
  state.deferredPrompt = null;
  emit();

  evt.prompt();
  const { outcome } = await evt.userChoice;
  if (outcome === 'accepted') {
    state.installed = true;
    emit();
  }
  return outcome;
}

/** Wire up the browser events. Safe to call more than once. */
let started = false;
export function initInstallPrompt() {
  if (started || typeof window === 'undefined') return;
  started = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // stop Chrome's mini-infobar; we show our own button
    state.deferredPrompt = e;
    state.installed = false;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    state.deferredPrompt = null;
    state.installed = true;
    emit();
  });

  // Launching the installed app from the home screen (or the browser switching
  // to standalone) should hide the button straight away.
  const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');
  standaloneQuery?.addEventListener?.('change', (e) => {
    if (e.matches) {
      state.deferredPrompt = null;
      state.installed = true;
      emit();
    }
  });
}

// Capture as early as possible — this module is imported from main.jsx.
initInstallPrompt();
