import { useState } from 'react';
import { adminChangePassword, apiError } from '../api.js';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Settings() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (newPassword.length < 6) { setMsg({ type: 'danger', text: 'New password must be at least 6 characters.' }); return; }
    if (newPassword !== confirm) { setMsg({ type: 'danger', text: 'New passwords do not match.' }); return; }
    setBusy(true);
    try {
      await adminChangePassword({ currentPassword, newPassword });
      setMsg({ type: 'success', text: 'Password updated successfully.' });
      setCurrent(''); setNew(''); setConfirm('');
    } catch (err) {
      setMsg({ type: 'danger', text: apiError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="mb-4">Settings</h2>
      <div className="admin-card" style={{ maxWidth: 480 }}>
        <h5 className="mb-3">Change Admin Password</h5>
        {msg && <div className={`alert alert-${msg.type} py-2`}>{msg.text}</div>}
        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label">Current Password</label>
            <PasswordInput value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="form-label">New Password</label>
            <PasswordInput value={newPassword} onChange={(e) => setNew(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="form-label">Confirm New Password</label>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Update Password'}</button>
        </form>
      </div>
    </>
  );
}
