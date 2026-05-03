import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCredential } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (getCredential()) {
    return NextResponse.json({ error: 'Already registered' }, { status: 409 });
  }
  const host = req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];

  const options = await generateRegistrationOptions({
    rpName: 'Alphalpha',
    rpID,
    userName: 'alex',
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  const res = NextResponse.json(options);
  res.cookies.set('webauthn_challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 300,
    path: '/',
  });
  return res;
}
