import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value ?? '';
  if (await verifySession(token)) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!login|setup|api|_next/static|_next/image|favicon\\.ico).*)'],
};
