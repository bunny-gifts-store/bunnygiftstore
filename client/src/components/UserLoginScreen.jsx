import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { loginUser, registerUser, apiError } from '../api.js';
import PasswordInput from './PasswordInput.jsx';

// Full-page gate: users must log in (returning) or create an account (first time:
// mobile + name + password) before they can browse or order.
export default function UserLoginScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  // Login fields
  const [identifier, setIdentifier] = useState(''); // mobile OR username
  const [loginPassword, setLoginPassword] = useState('');

  // Signup fields
  const [mobile, setMobile] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // A legacy account being given a password goes through the signup form but is
  // NOT a new customer — they should still be greeted with "Welcome Back".
  const [claimingLegacy, setClaimingLegacy] = useState(false);

  const switchMode = (next, msg = '') => {
    setMode(next);
    setError('');
    setNotice(msg);
    setClaimingLegacy(false); // callers that ARE claiming a legacy account re-set it after
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !loginPassword) {
      setError('Enter your mobile number / username and password.');
      return;
    }
    setBusy(true);
    try {
      const data = await loginUser({ identifier: identifier.trim(), password: loginPassword });
      login(data, { returning: true });
    } catch (err) {
      // Legacy account without a password yet — send them to create one.
      if (err?.response?.data?.error === 'NO_PASSWORD') {
        setMobile(/^\d{10}$/.test(identifier.trim()) ? identifier.trim() : '');
        switchMode('signup', 'Please create a password to finish setting up your account.');
        setClaimingLegacy(true);
      } else {
        setError(apiError(err, 'Could not log you in. Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{10}$/.test(mobile)) { setError('Enter a valid 10-digit mobile number.'); return; }
    if (username.trim().length < 2) { setError('Please enter your name.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const data = await registerUser({ mobile, username: username.trim(), password });
      login(data, { returning: claimingLegacy }); // account created — storefront unlocks
    } catch (err) {
      setError(apiError(err, 'Could not create your account. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="user-login-wrap">
      <div className="user-login-decor" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => <span key={i}></span>)}
      </div>

      {mode === 'login' ? (
        <form className="user-login-card" onSubmit={handleLogin}>
          <div className="user-login-brand">🎁 Bunny Gift Store 🐰</div>
          <h1>Login to continue</h1>
          <p className="subtitle">Enter your mobile number or username and password.</p>

          {notice && <div className="alert alert-info py-2">{notice}</div>}
          {error && <div className="alert alert-danger py-2">{error}</div>}

          <div className="mb-3">
            <label className="form-label">Mobile Number or Username</label>
            <input
              type="text"
              className="form-control form-control-lg"
              placeholder="Mobile number or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Password</label>
            <PasswordInput
              className="form-control-lg"
              placeholder="Enter your password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-100" disabled={busy}>
            {busy ? 'Please wait…' : 'Login'}
          </button>

          <button
            type="button"
            className="btn btn-link w-100 mt-2"
            onClick={() => switchMode('signup')}
          >
            New here? Create an account
          </button>
        </form>
      ) : (
        <form className="user-login-card" onSubmit={handleSignup}>
          <div className="user-login-brand">🎁 Bunny Gift Store 🐰</div>
          <h1>Create your account</h1>
          <p className="subtitle">Just a few details to get you started.</p>

          {notice && <div className="alert alert-info py-2">{notice}</div>}
          {error && <div className="alert alert-danger py-2">{error}</div>}

          <div className="mb-3">
            <label className="form-label">Mobile Number</label>
            <input
              type="tel"
              className="form-control form-control-lg"
              placeholder="10-digit mobile number"
              value={mobile}
              maxLength={10}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Your Name</label>
            <input
              type="text"
              className="form-control form-control-lg"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Create Password</label>
            <PasswordInput
              className="form-control-lg"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Confirm Password</label>
            <PasswordInput
              className="form-control-lg"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-100" disabled={busy}>
            {busy ? 'Creating account…' : 'Create Account & Continue'}
          </button>

          <button
            type="button"
            className="btn btn-link w-100 mt-2"
            onClick={() => switchMode('login')}
          >
            Already have an account? Log in
          </button>
        </form>
      )}
    </div>
  );
}
