import { useEffect, useState } from 'react';
import { adminLogin, apiError, warmUpApi } from '../api.js';
import { useAdminAuth } from './AdminApp.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import useWakingNotice from '../hooks/useWakingNotice.js';

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const waking = useWakingNotice(busy);

  // Start booting the (idle-spun-down) API while the owner is still typing, so
  // the cold start overlaps with them entering credentials instead of following
  // the click. Safe to call repeatedly — it de-duplicates internally.
  useEffect(() => { warmUpApi(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await adminLogin({ username, password });
      login(data);
    } catch (err) {
      setError(apiError(err, 'Login failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-shell">
      <div className="admin-login-wrap">
        <form className="admin-login-card" onSubmit={submit}>
          <h1>🐰 Admin Panel</h1>
          <p className="subtitle">Bunny Gift Store</p>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {waking && <div className="alert alert-info py-2">{waking}</div>}
          <div className="mb-3">
            <label className="form-label">Username</label>
            <input className="form-control form-control-lg" value={username}
                   onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="mb-4">
            <label className="form-label">Password</label>
            <PasswordInput className="form-control-lg" value={password}
                           onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-lg w-100" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
