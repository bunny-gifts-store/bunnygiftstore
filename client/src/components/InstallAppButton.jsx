import { useState } from 'react';
import usePwaInstall from '../pwa/usePwaInstall.js';
import InstallGuideModal from './InstallGuideModal.jsx';

// Download-into-tray glyph, drawn in the same stroke style as the other
// inline icons in the navbar.
function InstallIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/**
 * "Install App" button. Renders nothing unless the current browser can actually
 * install the app and it isn't installed already, so unsupported browsers see
 * no dead control.
 *
 * @param {'nav'|'block'} variant  `nav` = navbar pill, `block` = full-width button.
 * @param {() => void} onDone      called after a successful install (e.g. to close a menu).
 */
export default function InstallAppButton({ variant = 'nav', onDone }) {
  const { canInstall, needsManualSteps, install } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!canInstall) return null;

  const handleClick = async (e) => {
    e.preventDefault();
    if (busy) return;

    // iOS: no native prompt exists — show the Add to Home Screen steps.
    if (needsManualSteps) {
      setGuideOpen(true);
      return;
    }

    setBusy(true);
    try {
      const outcome = await install();
      if (outcome === 'unavailable') setGuideOpen(true);
      else if (outcome === 'accepted') onDone?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`pwa-install-btn pwa-install-btn--${variant}`}
        onClick={handleClick}
        disabled={busy}
        title="Install Bunny Gift Store on this device"
      >
        <InstallIcon />
        <span>{busy ? 'Installing…' : 'Install App'}</span>
      </button>

      <InstallGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
