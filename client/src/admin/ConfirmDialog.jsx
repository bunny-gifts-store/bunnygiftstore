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
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target.classList.contains('confirm-overlay') && !busy) onCancel?.(); }}
    >
      <div className="confirm-card">
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
      </div>
    </div>
  );
}
