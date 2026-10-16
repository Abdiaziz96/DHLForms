'use client';

import { Check, Copy, Database, Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Small office controls.
 *
 * The copy button is the most important thing in this file. A transport clerk
 * will not import a file — they will paste a row into the sheet they already have
 * open. That is the adoption path, so it gets a real tab-separated payload built
 * from the same column definition as the workbook, which means the paste always
 * lands in the right columns.
 */

export function CopyRowButton({ tsv, label = 'Copy row' }: { tsv: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      // Clipboard access can be refused (insecure context, or a permissions
      // policy). Fall back to a textarea the clerk can select by hand rather
      // than silently doing nothing.
      const ta = document.createElement('textarea');
      ta.value = tsv;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? 'Row copied' : label}
      className="inline-flex items-center gap-1.5 rounded-tile border-2 border-line-strong bg-card px-2.5 py-1.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-clear" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function SeedButton({ count = 14 }: { count?: number }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  const run = async () => {
    setState('loading');
    setError('');
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: count, perDay: 22 }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(detail?.error ?? 'Sample data was not added.');
        setState('error');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server. Check the connection and try again.');
      setState('error');
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={state === 'loading'}
        className="inline-flex items-center gap-2 rounded-tile border-2 border-ink bg-ink px-4 py-2.5 text-[14px] font-bold text-card transition-colors hover:bg-ink-soft disabled:opacity-40"
      >
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Database className="h-4 w-4" aria-hidden />}
        {state === 'loading' ? 'Generating' : 'Fill with sample data'}
      </button>
      {state === 'error' && (
        <p role="alert" className="mt-2 text-[12.5px] text-stop">
          {error}
        </p>
      )}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    await fetch('/api/admin/login', { method: 'DELETE' }).catch(() => undefined);
    router.replace('/');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-tile border-2 border-line-strong bg-card px-2.5 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      Sign out
    </button>
  );
}
