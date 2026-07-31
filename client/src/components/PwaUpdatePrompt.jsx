import { useEffect, useState } from 'react';
import { registerServiceWorker, applyUpdate } from '../pwa/registerServiceWorker.js';

/**
 * Registers the service worker and, when a newer deployment has been
 * downloaded in the background, offers a one-tap refresh. Renders nothing
 * until then, so it never touches the existing layout.
 */
export default function PwaUpdatePrompt() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    registerServiceWorker({ onUpdateReady: () => setUpdateReady(true) });
  }, []);

  if (!updateReady) return null;

  return (
    <div className="pwa-toast" role="status" aria-live="polite">
      <span className="pwa-toast-text">A new version of the store is available.</span>
      <button type="button" className="pwa-toast-action" onClick={applyUpdate}>Refresh</button>
      <button
        type="button"
        className="pwa-toast-dismiss"
        onClick={() => setUpdateReady(false)}
        aria-label="Dismiss update notice"
      >
        ×
      </button>
    </div>
  );
}
