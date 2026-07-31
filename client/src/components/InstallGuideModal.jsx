import { useEffect } from 'react';

// Step-by-step fallback for browsers that can install the app but never fire
// `beforeinstallprompt` — iOS/iPadOS Safari above all.
const IOS_STEPS = [
  'Tap the Share button in the browser toolbar.',
  'Scroll down and choose “Add to Home Screen”.',
  'Tap “Add” — Bunny Gift Store lands on your home screen.',
];

export default function InstallGuideModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="pwa-guide-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-guide-title"
      onClick={(e) => { if (e.target.classList.contains('pwa-guide-overlay')) onClose?.(); }}
    >
      <div className="pwa-guide-card">
        <img className="pwa-guide-logo" src="/images/pwa-icon-192.png" alt="" aria-hidden="true" />
        <h5 className="pwa-guide-title" id="pwa-guide-title">Install Bunny Gift Store</h5>
        <p className="pwa-guide-text">
          Add the store to your home screen for a full-screen, app-like experience.
        </p>

        <ol className="pwa-guide-steps">
          {IOS_STEPS.map((step, i) => (
            <li key={i}>
              <span className="pwa-guide-step-num" aria-hidden="true">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <button type="button" className="btn pwa-guide-close" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
