import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCredential } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (getCredential()) {
    return NextResponse.json({ error: 'Already registered' }, { status: 409 });
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
    verification = await verifyRegistrationResponse({
      response: await req.json(),
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return NextResponse.json({ error: 'Registration failed' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  const credentialJSON = JSON.stringify({
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
  });

  const res = NextResponse.json({ credential: credentialJSON });
  res.cookies.set('webauthn_challenge', '', { maxAge: 0, path: '/' });
  return res;
}
