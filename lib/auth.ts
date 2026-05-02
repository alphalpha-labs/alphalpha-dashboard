import { SignJWT, jwtVerify } from 'jose';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 604800 seconds

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET not set');
  return new TextEncoder().encode(s);
}

export async function issueSession(): Promise<string> {
  return new SignJWT({ sub: 'alex' })
    .setProtectedHeader({ alg: 'HS256' })
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

export function verifyApiKey(req: Request): boolean {
  const key = req.headers.get('authorization')?.replace('Bearer ', '');
  return !!key && key === process.env.OPENCLAW_API_KEY;
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
