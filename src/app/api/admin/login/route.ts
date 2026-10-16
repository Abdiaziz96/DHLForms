import { NextResponse } from 'next/server';

import { checkPassword, createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';

/** Sign the office in. One shared site password, rotated by changing the env var. */
export async function POST(request: Request) {
  let password = '';
  try {
    const body = (await request.json()) as { password?: string };
    password = String(body.password ?? '');
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a JSON body with a password field.' }, { status: 400 });
  }

  if (!checkPassword(password)) {
    // Deliberately vague about which part failed. A shared site password does not
    // need to help someone guess it.
    return NextResponse.json({ ok: false, error: 'That password was not recognised.' }, { status: 401 });
  }

  const token = await createSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

/** Sign out. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
