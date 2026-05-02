import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getCredential, issueSession, sessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Password fallback path — triggered when request body has a "password" key
  if ('password' in body) {
    const hash = process.env.PASSWORD_HASH;
    if (!hash) {
      return NextResponse.json({ error: 'No password configured' }, { status: 401 });
    }
    const valid = await bcrypt.compare(body.password as string, hash);
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }
    const token = await issueSession();
    const res = NextResponse.json({ ok: true });
    res.headers.set('Set-Cookie', sessionCookie(token));
    return res;
  }

  // Passkey path — request body is a WebAuthn AuthenticationResponseJSON
  const storedCredential = getCredential();
  if (!storedCredential) {
    return NextResponse.json({ error: 'No passkey registered' }, { status: 401 });
  }

  const challenge = req.cookies.get('webauthn_challenge')?.value;
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge missing or expired' }, { status: 400 });
  }

  const host = req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const origin = `${proto}://${host}`;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCredential.id,
        publicKey: Buffer.from(storedCredential.publicKey, 'base64url'),
        counter: storedCredential.counter,
      },
    });
  } catch (err) {
    console.error('[WebAuthn Login]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Passkey verification failed' }, { status: 401 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Passkey verification failed' }, { status: 401 });
  }

  const token = await issueSession();
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', sessionCookie(token));
  // Clear the challenge cookie
  res.headers.append('Set-Cookie', 'webauthn_challenge=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict');
  return res;
}
