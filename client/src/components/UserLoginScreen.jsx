import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { loginUser, apiError } from '../api.js';

// Full-page gate: users must log in (returning) or register (new: mobile + name)
// before they can browse or order products.
export default function UserLoginScreen() {
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [username, setUsername] = useState('');
  const [needName, setNeedName] = useState(false); // first-time user must add a name
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const validMobile = /^\d{10}$/.test(mobile);

  const handleContinue = async (e) => {
    e.preventDefault();
    setError('');
    if (!validMobile) { setError('Enter a valid 10-digit mobile number.'); return; }

    if (needName && username.trim().length < 2) {
      setError('Please enter your name to register.');
      return;
    }

    setChecking(true);
    try {
      // Single request: /login logs in a returning user, or returns NEW_USER
      // (handled below) when the mobile is unknown and no name was given yet.
      // Skipping a separate "exists" pre-check halves the wait for the common
      // returning-user path — important on a cold-started API.
      const data = await loginUser({ mobile, username: username.trim() });
      login(data); // storefront unlocks
    } catch (err) {
      if (err?.response?.data?.error === 'NEW_USER') setNeedName(true);
      else setError(apiError(err, 'Could not log you in. Please try again.'));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="user-login-wrap">
      <div className="user-login-decor" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => <span key={i}></span>)}
      </div>
      <form className="user-login-card" onSubmit={handleContinue}>
        <div className="user-login-brand">🎁 Bunny Gift Store 🐰</div>
        <h1>{needName ? 'Create your account' : 'Login to continue'}</h1>
        <p className="subtitle">
          {needName
            ? 'Welcome! Just tell us your name to finish registering.'
            : 'Enter your mobile number to log in or register.'}
        </p>

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
          <div className="mb-3">
            <label className="form-label">Your Name</label>
            <input
              type="text"
              className="form-control form-control-lg"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-lg w-100" disabled={checking}>
          {checking ? 'Please wait…' : needName ? 'Create account & Continue' : 'Continue'}
        </button>

        {needName && (
          <button
            type="button"
            className="btn btn-link w-100 mt-2"
            onClick={() => { setNeedName(false); setUsername(''); setError(''); }}
          >
            ← Use a different number
          </button>
        )}
      </form>
    </div>
  );
}
