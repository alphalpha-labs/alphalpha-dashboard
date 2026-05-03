'use client';
import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

export default function SetupClient() {
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleRegister() {
    setError('');
    setLoading(true);
    try {
      const optRes = await fetch('/api/auth/register-options');
      if (!optRes.ok) throw new Error('options failed');
      const options = await optRes.json();
      const attestation = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      });
      const data = await verifyRes.json();
      if (verifyRes.ok) {
        setCredential(data.credential);
      } else {
        setError(data.error ?? 'Registration failed');
      }
    } catch {
      setError('Registration failed — try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(credential);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <div>
          <h1 className="authTitle">Register Passkey</h1>
          <p className="authSubtitle">One-time setup for your authenticator.</p>
        </div>
        {!credential ? (
          <button
            className="authBtn authBtn--primary"
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? 'Registering…' : 'Register with Passkey'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="authInstructions">
              Copy this JSON and paste it into Vercel as{' '}
              <code>PASSKEY_CREDENTIAL</code>, then redeploy and navigate to /login.
            </p>
            <div className="authCredentialBox">{credential}</div>
            <button className="authBtn authBtn--secondary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
        )}
        {error && <p className="authError">{error}</p>}
      </div>
    </div>
  );
}
