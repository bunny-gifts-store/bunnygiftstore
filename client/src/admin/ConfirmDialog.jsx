import { useEffect } from 'react';

// Themed, centered confirmation dialog (replaces window.confirm in the admin).
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  danger = false,
  icon = '⚠️',
  successMessage = '', // when set, the dialog shows a success state instead
  onConfirm,
  onCancel,
}) {
  const locked = busy || !!successMessage; // don't allow closing while working / showing success

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !locked) onCancel?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, locked, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target.classList.contains('confirm-overlay') && !locked) onCancel?.(); }}
    >
      <div className="confirm-card">
        {successMessage ? (
          <>
            <div className="confirm-icon is-success" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h5 className="confirm-title">{successMessage}</h5>
          </>
        ) : (
          <>
            <div className={`confirm-icon${danger ? ' is-danger' : ''}`} aria-hidden="true">{icon}</div>
            <h5 className="confirm-title">{title}</h5>
            {message && <p className="confirm-text">{message}</p>}
            <div className="confirm-actions">
              <button type="button" className="btn confirm-cancel" onClick={onCancel} disabled={busy}>
                {cancelLabel}
              </button>
              <button
                type="button"
                className={`btn ${danger ? 'confirm-delete' : 'confirm-ok'}`}
                onClick={onConfirm}
                disabled={busy}
              >
                {busy ? 'Please wait…' : confirmLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
