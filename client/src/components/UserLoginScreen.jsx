import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  loginUser,
  registerUser,
  lookupResetAccount,
  resetPassword,
  apiError,
  warmUpApi,
} from '../api.js';
import PasswordInput from './PasswordInput.jsx';
import InstallAppButton from './InstallAppButton.jsx';
import useWakingNotice from '../hooks/useWakingNotice.js';

// Minimum password length. Mirrors MIN_PASSWORD in server/src/routes/auth.routes.js —
// the server enforces it either way; this is only so the user finds out before
// making a round trip.
const MIN_PASSWORD = 6;

// Small inline spinner for buttons that are mid-request.
const Spinner = () => (
  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
);

// Full-page gate: users must log in (returning), create an account (first time:
// mobile + name + password), or reset a forgotten password before they can
// browse or order.
export default function UserLoginScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'

  // Login fields
  const [identifier, setIdentifier] = useState(''); // mobile OR username
  const [loginPassword, setLoginPassword] = useState('');

  // Signup fields
  const [mobile, setMobile] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Reset fields. `resetStep` is 'identify' until the account has been found,
  // then 'password'.
  const [resetStep, setResetStep] = useState('identify');
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({});
  // Set when the lookup finds nothing, so the sign-up shortcut can be offered.
  const [accountMissing, setAccountMissing] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // True only after the server has actually rejected a sign-in attempt. The
  // reset offer is tied to this rather than to `error`, so it doesn't appear
  // for "fill in both fields", where nothing has been tried yet.
  const [loginFailed, setLoginFailed] = useState(false);
  // A legacy account being given a password goes through the signup form but is
  // NOT a new customer — they should still be greeted with "Welcome Back".
  const [claimingLegacy, setClaimingLegacy] = useState(false);
  const waking = useWakingNotice(busy);

  // Start booting the (idle-spun-down) API while the customer is still typing,
  // so the cold start overlaps with them entering their details rather than
  // following the button press. De-duplicates internally.
  useEffect(() => { warmUpApi(); }, []);

  // Leaving the reset flow must not strand half-entered credentials in state.
  const clearReset = () => {
    setResetStep('identify');
    setResetIdentifier('');
    setNewPassword('');
    setConfirmPassword('');
    setTouched({});
    setAccountMissing(false);
  };

  // Live validation for the reset fields. Derived rather than stored, so the
  // messages and the button's enabled state can never disagree.
  const newPasswordError = !newPassword
    ? 'Password cannot be empty.'
    : newPassword.length < MIN_PASSWORD
      ? `Password must be at least ${MIN_PASSWORD} characters.`
      : '';
  const confirmPasswordError = !confirmPassword
    ? 'Please re-enter your new password.'
    : confirmPassword !== newPassword
      ? 'Passwords do not match.'
      : '';
  const canUpdatePassword = !newPasswordError && !confirmPasswordError && !busy;

  const markTouched = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const switchMode = (next, msg = '') => {
    setMode(next);
    setError('');
    setNotice(msg);
    setLoginFailed(false);
    setClaimingLegacy(false); // callers that ARE claiming a legacy account re-set it after
    if (next !== 'reset') clearReset();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoginFailed(false);
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
        setLoginFailed(true);
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
    if (password.length < MIN_PASSWORD) { setError(`Password must be at least ${MIN_PASSWORD} characters.`); return; }
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

  // ---- Reset: step 1, find the account ----
  const handleResetLookup = async (e) => {
    e.preventDefault();
    setError('');
    setAccountMissing(false);
    const value = resetIdentifier.trim();
    if (!value) {
      setError('Enter your mobile number or username.');
      return;
    }
    setBusy(true);
    try {
      await lookupResetAccount(value);
      setResetStep('password');
      setNotice('Account found. Create your new password below.');
    } catch (err) {
      // 404 is the "no such account" case and gets the sign-up shortcut; any
      // other failure (network, server) is just an error.
      if (err?.response?.status === 404) setAccountMissing(true);
      setError(apiError(err, 'Could not verify that account. Please try again.'));
      setNotice('');
    } finally {
      setBusy(false);
    }
  };

  // ---- Reset: step 2, set the new password ----
  const handleResetUpdate = async (e) => {
    e.preventDefault();
    setTouched({ newPassword: true, confirmPassword: true });
    if (newPasswordError || confirmPasswordError) return;
    setError('');
    setBusy(true);
    try {
      const data = await resetPassword({
        identifier: resetIdentifier.trim(),
        password: newPassword,
        confirmPassword,
      });
      // Carry the identifier over so they only have to type the new password.
      const usedIdentifier = resetIdentifier.trim();
      switchMode('login', data?.message || 'Password updated successfully. Please login with your new password.');
      setIdentifier(usedIdentifier);
      setLoginPassword('');
    } catch (err) {
      if (err?.response?.status === 404) setAccountMissing(true);
      setError(apiError(err, 'Could not update your password. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="user-login-wrap">
      <div className="user-login-decor" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => <span key={i}></span>)}
      </div>

      {mode === 'login' && (
        <form className="user-login-card" onSubmit={handleLogin}>
          <div className="user-login-brand">🎁 Bunny Gift Store 🐰</div>
          <h1>Login to continue</h1>
          <p className="subtitle">Enter your mobile number or username and password.</p>

          {notice && <div className="alert alert-info py-2">{notice}</div>}
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {/* Offered the moment a login fails — a wrong password is exactly when
              someone needs this, and hunting for it in a menu is the last thing
              they want to do. */}
          {loginFailed && (
            <p className="forgot-password-prompt">
              Forgot your password?{' '}
              <button type="button" className="link-reset" onClick={() => switchMode('reset')}>
                Reset now
              </button>
            </p>
          )}
          {waking && <div className="alert alert-info py-2">{waking}</div>}

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
            {busy && <Spinner />}{busy ? 'Please wait…' : 'Login'}
          </button>

          <button
            type="button"
            className="btn btn-link w-100 mt-2"
            onClick={() => switchMode('signup')}
          >
            New here? Create an account
          </button>

          {/* The storefront is gated behind this screen, so offer the install
              here too. Renders nothing on browsers that can't install. */}
          <InstallAppButton variant="block" />
        </form>
      )}

      {mode === 'signup' && (
        <form className="user-login-card" onSubmit={handleSignup}>
          <div className="user-login-brand">🎁 Bunny Gift Store 🐰</div>
          <h1>Create your account</h1>
          <p className="subtitle">Just a few details to get you started.</p>

          {notice && <div className="alert alert-info py-2">{notice}</div>}
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {waking && <div className="alert alert-info py-2">{waking}</div>}

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
              placeholder={`At least ${MIN_PASSWORD} characters`}
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
            {busy && <Spinner />}{busy ? 'Creating account…' : 'Create Account & Continue'}
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

      {mode === 'reset' && (
        <form
          className="user-login-card"
          onSubmit={resetStep === 'identify' ? handleResetLookup : handleResetUpdate}
        >
          <div className="user-login-brand">🎁 Bunny Gift Store 🐰</div>
          <h1>Reset your password</h1>
          <p className="subtitle">
            {resetStep === 'identify'
              ? 'Enter your mobile number or username to find your account.'
              : 'Choose a new password for your account.'}
          </p>

          {notice && <div className="alert alert-info py-2">{notice}</div>}
          {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
          {/* Only shown when the lookup found nothing at all. */}
          {accountMissing && (
            <p className="forgot-password-prompt">
              Don&apos;t have an account?{' '}
              <button type="button" className="link-reset" onClick={() => switchMode('signup')}>
                Sign Up Here
              </button>
            </p>
          )}
          {waking && <div className="alert alert-info py-2">{waking}</div>}

          {resetStep === 'identify' ? (
            <>
              <div className="mb-3">
                <label className="form-label">Mobile Number or Username</label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  placeholder="Mobile number or username"
                  value={resetIdentifier}
                  onChange={(e) => { setResetIdentifier(e.target.value); setAccountMissing(false); }}
                  autoFocus
                />
                <p className="field-hint">Either one works — you only need to enter one.</p>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg w-100"
                disabled={busy || !resetIdentifier.trim()}
              >
                {busy && <Spinner />}{busy ? 'Verifying account…' : 'Verify Account'}
              </button>
            </>
          ) : (
            <>
              <div className="reset-account-chip">
                Resetting the password for <strong>{resetIdentifier.trim()}</strong>
              </div>

              <div className="mb-3">
                <label className="form-label">Create New Password</label>
                <PasswordInput
                  className={`form-control-lg${touched.newPassword && newPasswordError ? ' field-invalid' : ''}`}
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onBlur={() => markTouched('newPassword')}
                  aria-invalid={Boolean(touched.newPassword && newPasswordError)}
                  autoFocus
                />
                {touched.newPassword && newPasswordError && (
                  <p className="field-error">{newPasswordError}</p>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">Confirm New Password</label>
                <PasswordInput
                  className={`form-control-lg${touched.confirmPassword && confirmPasswordError ? ' field-invalid' : ''}`}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => markTouched('confirmPassword')}
                  aria-invalid={Boolean(touched.confirmPassword && confirmPasswordError)}
                />
                {touched.confirmPassword && confirmPasswordError && (
                  <p className="field-error">{confirmPasswordError}</p>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg w-100"
                disabled={!canUpdatePassword}
              >
                {busy && <Spinner />}{busy ? 'Updating password…' : 'Update Password'}
              </button>

              <button
                type="button"
                className="btn btn-link w-100 mt-2"
                onClick={() => { setResetStep('identify'); setError(''); setNotice(''); }}
                disabled={busy}
              >
                Use a different mobile number or username
              </button>
            </>
          )}

          <button
            type="button"
            className="btn btn-link w-100 mt-2"
            onClick={() => switchMode('login')}
            disabled={busy}
          >
            Back to login
          </button>
        </form>
      )}
    </div>
  );
}
