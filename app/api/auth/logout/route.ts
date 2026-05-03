import { NextResponse } from 'next/server';
import { clearCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', clearCookie);
  return res;
}
