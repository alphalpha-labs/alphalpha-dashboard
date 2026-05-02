import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCredential } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];
  const storedCredential = getCredential();
  if (!storedCredential) {
    return NextResponse.json({ error: 'No passkey registered' }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: [{ id: storedCredential.id }],
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
