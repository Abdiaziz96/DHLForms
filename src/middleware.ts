import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE, verifySession } from '@/lib/session';

/**
 * Gate the office areas.
 *
 * Only the admin surfaces are protected. Driver, warehouse and visitor routes are
 * deliberately open — a login screen is where half the take-up is lost, and the
 * operator identity is captured on the record itself instead.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Submitting a record is open to anyone with the link — that is the whole point.
  // Reading the record set back is not: it holds every driver's name and every
  // registration on site, so it needs the same gate as the office screens.
  if (pathname.startsWith('/api/records') && request.method === 'POST') {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(token)) return NextResponse.next();

  // An API caller must not be handed an HTML login page — a fetch following that
  // redirect gets a 200 and a page of markup instead of an error it can report.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Sign in to the office view first.' }, { status: 401 });
  }

  const login = new URL('/staff/admin/login', request.url);
  login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    '/staff/admin',
    '/staff/admin/((?!login).*)',
    // The sign-in endpoint itself must stay reachable, or nobody can ever sign in.
    '/api/admin/((?!login).*)',
    '/api/records',
    '/api/export',
  ],
};
