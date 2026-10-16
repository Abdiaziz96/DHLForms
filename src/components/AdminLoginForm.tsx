'use client';

import { Loader2, LockKeyhole } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * Office sign-in.
 *
 * This exists because the first prototype gated the office screens with a passcode
 * compiled into the JavaScript bundle and a localStorage flag. Both are readable
 * and settable by anyone with the page open. The record set here holds every
 * driver's name and every registration on site, so the gate has to be a real one.
 *
 * Driver, warehouse and visitor routes stay open on purpose — a login is the
 * single biggest source of drop-off for someone standing in a yard.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/staff/admin';

  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async () => {
    setState('checking');
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(detail?.error ?? 'That password was not recognised.');
        setState('error');
        return;
      }
      // Refresh so the middleware sees the new cookie and the server components
      // re-render with data rather than the stale prefetch.
      router.replace(next);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check the connection and try again.');
      setState('error');
    }
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <label htmlFor="pw" className="mb-1.5 block text-[13px] font-semibold text-ink">Office password</label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (state === 'error') setState('idle');
          }}
          autoComplete="current-password"
          autoFocus
          aria-invalid={state === 'error'}
          className="field"
        />
      </div>

      {state === 'error' && (
        <p role="alert" className="rounded-card border-2 border-stop/40 bg-stop-wash px-4 py-3 text-[13px] text-stop">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={password.length === 0 || state === 'checking'}
        className="flex items-center justify-center gap-2 rounded-tile border-2 border-ink bg-ink px-5 py-3 text-[15px] font-bold text-card transition-colors hover:bg-ink-soft disabled:opacity-40"
      >
        {state === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LockKeyhole className="h-4 w-4" aria-hidden />}
        {state === 'checking' ? 'Checking' : 'Open the office view'}
      </button>
    </form>
  );
}
