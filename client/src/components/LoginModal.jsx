import { useEffect, useState } from 'react';
import { useUI } from '../context/UIContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { checkMobileExists, loginUser, apiError } from '../api.js';

export default function LoginModal() {
  const { loginOpen, closeLogin } = useUI();
  const { login } = useAuth();

  const [mobile, setMobile] = useState('');
  const [username, setUsername] = useState('');
  const [needName, setNeedName] = useState(false); // true when a first-time user must add a name
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loginOpen) {
      setMobile(''); setUsername(''); setNeedName(false); setError(''); setChecking(false);
    }
  }, [loginOpen]);

  if (!loginOpen) return null;

  const validMobile = /^\d{10}$/.test(mobile);

  const handleContinue = async (e) => {
    e.preventDefault();
    setError('');
    if (!validMobile) { setError('Enter a valid 10-digit mobile number.'); return; }

    setChecking(true);
    try {
      // Step 1: if we don't yet know whether the name is needed, look it up.
      if (!needName) {
        const exists = await checkMobileExists(mobile);
        if (!exists) {
          setNeedName(true);
          setChecking(false);
          return; // ask for the name before creating the account
        }
      }
      // Step 2: log in (returning user) or register (new user + name).
      if (needName && username.trim().length < 2) {
        setError('Please enter your name to register.');
        setChecking(false);
        return;
      }
      const data = await loginUser({ mobile, username: username.trim() });
      login(data);
      closeLogin();
    } catch (err) {
      // Server asks for a name for a brand-new user.
      if (err?.response?.data?.error === 'NEW_USER') {
        setNeedName(true);
      } else {
        setError(apiError(err, 'Could not log you in. Please try again.'));
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog"
           onClick={(e) => { if (e.target.classList.contains('modal')) closeLogin(); }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{needName ? 'Welcome! Create your account' : 'Login'}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={closeLogin}></button>
            </div>
            <form onSubmit={handleContinue}>
              <div className="modal-body">
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <div className="mb-3">
                  <label className="form-label">Mobile Number</label>
                  <input
                    type="tel"
                    className="form-control form-control-lg"
                    placeholder="10-digit mobile number"
                    value={mobile}
                    maxLength={10}
                    disabled={needName}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                </div>
                {needName && (
                  <div className="mb-2">
                    <label className="form-label">Your Name</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Enter your name"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoFocus
                    />
                    <small className="text-muted">First time here — we just need your name once.</small>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                {needName && (
                  <button type="button" className="btn btn-secondary"
                          onClick={() => { setNeedName(false); setUsername(''); setError(''); }}>
                    Back
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={checking}>
                  {checking ? 'Please wait…' : needName ? 'Create account & Login' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={closeLogin}></div>
    </>
  );
}
