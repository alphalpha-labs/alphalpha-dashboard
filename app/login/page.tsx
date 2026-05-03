'use client';
import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePasskey() {
    setError('');
    setLoading(true);
    try {
      const optRes = await fetch('/api/auth/login-options');
      if (!optRes.ok) throw new Error('options failed');
      const options = await optRes.json();
      const credential = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      if (verifyRes.ok) {
        window.location.href = '/';
      } else {
        setError('Passkey failed — try your password');
      }
    } catch {
      setError('Passkey failed — try your password');
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        setError('Incorrect password');
      }
    } catch {
      setError('Incorrect password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <div>
          <h1 className="authTitle">Alphalpha</h1>
          <p className="authSubtitle">Chief of Staff</p>
        </div>
        <button
          className="authBtn authBtn--primary"
          onClick={handlePasskey}
          disabled={loading}
        >
          Sign in with Passkey
        </button>
        <div className="authDivider">or</div>
        <form
          onSubmit={handlePassword}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <input
            type="password"
            className="authInput"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
          <button
            type="submit"
            className="authBtn authBtn--secondary"
            disabled={loading || !password}
          >
            Sign in
          </button>
        </form>
        {error && <p className="authError">{error}</p>}
      </div>
    </div>
  );
}
