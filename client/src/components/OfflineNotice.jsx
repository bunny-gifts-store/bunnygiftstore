import { useEffect, useState } from 'react';

/**
 * Slim "You're offline" banner. Fixed-position and rendered only while the
 * connection is down, so it never affects the storefront layout.
 */
export default function OfflineNotice() {
  const [offline, setOffline] = useState(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="pwa-offline-bar" role="status" aria-live="polite">
      <span className="pwa-offline-dot" aria-hidden="true" />
      You&rsquo;re offline — showing saved pages. Some actions need a connection.
    </div>
  );
}
