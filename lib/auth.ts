import { SignJWT, jwtVerify } from 'jose';
import { type NextRequest, NextResponse } from 'next/server';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 604800 seconds

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET not set');
  return new TextEncoder().encode(s);
}

export async function issueSession(): Promise<string> {
  return new SignJWT({ sub: 'alex' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifySession(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export function getCredential(): { id: string; publicKey: string; counter: number } | null {
  const raw = process.env.PASSKEY_CREDENTIAL;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function verifyApiKey(req: Request): boolean {
  const raw = req.headers.get('authorization') ?? '';
  const key = raw.startsWith('Bearer ') ? raw.slice(7) : '';
  const expected = process.env.OPENCLAW_API_KEY ?? '';
  if (!key || !expected) return false;
  return timingSafeEq(key, expected);
}

export function sessionCookie(token: string): string {
  const parts = [
    `session=${token}`,
    `Max-Age=${SESSION_MAX_AGE}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export const clearCookie = 'session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict';

/**
 * Gate for browser-facing API routes. Returns a 401 response if the
 * dashboard session cookie is absent or invalid; returns null if OK.
 */
export async function requireDashboardSession(req: NextRequest): Promise<NextResponse | null> {
  const token = req.cookies.get('session')?.value ?? '';
  if (await verifySession(token)) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
