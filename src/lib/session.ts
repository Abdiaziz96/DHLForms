/**
 * Admin session.
 *
 * Replaces the client-side passcode the prototype shipped with. That version kept
 * the passcode in the JavaScript bundle and gated the UI on a localStorage flag,
 * which meant anyone could read the password out of devtools or set the flag by
 * hand. Since this data is driver names, registrations and visitor details, the
 * gate has to be real.
 *
 * Design: a signed, expiring cookie. No session store, no database — the HMAC is
 * the whole mechanism. Uses Web Crypto so the same code runs in middleware (edge)
 * and in route handlers (node).
 */

export const SESSION_COOKIE = 'gh_admin';
const TTL_SECONDS = 60 * 60 * 12; // one shift

const encoder = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s === 'change-me-too') {
    // Refusing to sign with a known default is the correct failure mode: a
    // predictable session key is worse than no session at all.
    throw new Error('SESSION_SECRET is not set. Copy .env.example to .env.local and set a real value.');
  }
  return s;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacHex(payload: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

/** Constant-time-ish comparison. Length is fixed, so early exit leaks nothing useful. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `admin.${expires}`;
  const sig = await hmacHex(payload, secret());
  return `${payload}.${sig}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [scope, expiresRaw, sig] = parts;
  if (scope !== 'admin') return false;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;

  try {
    const expected = await hmacHex(`${scope}.${expiresRaw}`, secret());
    return safeEqual(expected, sig);
  } catch {
    return false;
  }
}

/** Password check. Deliberately not constant time — this is a shared site password, not a per-user credential. */
export function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected === 'change-me') return false;
  return candidate === expected;
}

export const SESSION_MAX_AGE = TTL_SECONDS;
