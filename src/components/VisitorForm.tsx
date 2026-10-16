'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, CloudOff, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { SignaturePad } from '@/components/SignaturePad';
import { Stagger, StaggerItem } from '@/components/Stagger';
import { Tile } from '@/components/Tile';
import { enqueue } from '@/lib/client-storage';
import { SITE_NAME } from '@/lib/site';
import { localNow } from '@/lib/time';
import type { Signature, VisitorPurpose } from '@/lib/types';
import { clsx } from 'clsx';

/**
 * Visitor sign-in.
 *
 * One screen, six fields, no steps. This is the first form a visitor has ever
 * seen from this company, and it is filled in while standing at a barrier with a
 * vehicle behind them — a step flow would add taps without adding a decision.
 *
 * The purpose arrives in the query string from the *delivering* and *collecting*
 * screens and is pre-selected, but it stays changeable: people turn up at the
 * wrong entrance often enough that correcting a radio beats sending them back.
 *
 * Risk is not assessed here. A visitor is not driving a route, so the record goes
 * in with a zero height and a green band; the server recomputes it regardless.
 */

type Result =
  | { kind: 'done'; id: string; persisted: boolean }
  | { kind: 'queued' }
  | { kind: 'error'; message: string };

/** `a`, `a and b`, `a, b and c` — reads as a sentence, not a list of failures. */
function listSentence(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function VisitorForm() {
  const params = useSearchParams();

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [reg, setReg] = useState('');
  const [visiting, setVisiting] = useState('');
  const [paths, setPaths] = useState<string[]>([]);
  const [purpose, setPurpose] = useState<VisitorPurpose>(
    params.get('purpose') === 'collecting' ? 'collecting' : 'delivering',
  );

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const delivering = purpose === 'delivering';

  // Registration is normalised the way the workbook stores it, so the "four
  // characters" rule holds whether the space is typed or not.
  const regClean = reg.toUpperCase().replace(/\s+/g, '');

  const missing = useMemo(() => {
    const out: string[] = [];
    if (name.trim().length < 2) out.push('your name');
    if (company.trim().length < 2) out.push('your company');
    if (regClean.length < 4) out.push('your vehicle registration');
    if (visiting.trim().length < 2) out.push('who you are visiting');
    if (paths.length === 0) out.push('your signature');
    return out;
  }, [name, company, regClean, visiting, paths]);

  const status = missing.length === 0 ? 'Ready to sign in.' : `Still needed: ${listSentence(missing)}.`;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || missing.length > 0) return;

    setSubmitting(true);
    setResult(null);

    // One timestamp for the whole submission: the record and the signature it
    // carries must agree about when the person signed.
    const now = localNow();
    const signature: Signature = { paths, name: name.trim(), signedAt: now };

    const payload = {
      kind: 'visitor',
      visitorPurpose: purpose,
      direction: delivering ? 'in' : 'out',
      operatorName: name.trim(),
      operatorRef: '',
      operatorBasis: 'subcontractor',
      company: company.trim(),
      reg: regClean,
      contract: visiting.trim(),
      runningHeight: 0,
      routeRef: '',
      routeHasHeightRestriction: false,
      riskScore: 0,
      riskBand: 'green',
      defectFlagged: false,
      defectNote: '',
      heightAcknowledged: true,
      delayMinutes: 0,
      siteName: SITE_NAME,
      recordedAt: now,
      submittedAt: now,
      operatorSignature: signature,
      securityName: '',
      securitySignedAt: null,
      note: '',
    };

    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // The typed values stay on screen. Nothing is worse than an error that
        // clears the form and makes someone type their registration twice.
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        setResult({
          kind: 'error',
          message: detail?.error ?? 'The record was not accepted. Check the details and try again.',
        });
        return;
      }

      const data = (await res.json()) as { id?: string; persisted?: boolean };
      if (typeof data.id !== 'string') {
        setResult({
          kind: 'error',
          message: 'The record went through without a reference coming back. Try again, or sign the gatehouse sheet.',
        });
        return;
      }

      setResult({ kind: 'done', id: data.id, persisted: data.persisted !== false });
    } catch {
      // No signal at the barrier is the normal case, not the exception. Hold the
      // record on the device rather than losing it; the queue drains itself.
      enqueue({ ...payload });
      setResult({ kind: 'queued' });
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.kind === 'done') {
    return (
      <ResultPanel>
        <div className="rounded-card border-2 border-line-strong bg-card p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clear text-white" aria-hidden>
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-ink">You are signed in</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Record <span className="font-mono text-ink">{result.id}</span> is with the gatehouse.{' '}
            {delivering
              ? 'Goods-in will meet you at the delivery entrance.'
              : 'Despatch will meet you at the desk by the loading bays.'}
          </p>
          {!result.persisted && (
            <p className="mx-auto mt-3 max-w-sm rounded-tile border border-caution/40 bg-caution-wash px-3 py-2 text-[12.5px] text-caution">
              This server is running on a read-only disk, so the record is only held in memory. Use a writable data
              directory before relying on it.
            </p>
          )}
        </div>

        <Tile href="/" variant="primary" title="Done" description="Back to the start." />
      </ResultPanel>
    );
  }

  if (result?.kind === 'queued') {
    return (
      <ResultPanel>
        <div className="rounded-card border-2 border-caution/40 bg-caution-wash p-5">
          <CloudOff className="h-6 w-6 text-caution" aria-hidden />
          <h2 className="mt-2 font-display text-lg font-bold text-ink">Saved on your phone, not sent yet</h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">
            There is no signal here, so your sign-in is held on this device. It sends by itself as soon as the app is
            open with a connection. Tell the gatehouse you have signed in on your phone, and do not clear your browser
            data before it has gone.
          </p>
        </div>

        <Tile href="/" variant="primary" title="Done" description="Back to the start." />
      </ResultPanel>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Stagger className="grid gap-4">
        <StaggerItem>
          <fieldset className="rounded-card border-2 border-line-strong bg-card p-4">
            <legend className="px-1 text-[13px] font-semibold text-ink">What are you here to do?</legend>
            <div className="mt-1 grid gap-2.5 sm:grid-cols-2">
              {(
                [
                  { value: 'delivering', label: 'Delivering to site', hint: 'Goods-in will meet you' },
                  { value: 'collecting', label: 'Collecting from site', hint: 'Despatch will meet you' },
                ] as const
              ).map((o) => (
                <label
                  key={o.value}
                  className={clsx(
                    'flex cursor-pointer items-center gap-3 rounded-tile border-2 px-3.5 py-3 transition-colors',
                    purpose === o.value ? 'border-ink bg-card-sunk' : 'border-line-strong bg-card hover:border-ink',
                  )}
                >
                  <input
                    type="radio"
                    name="visitorPurpose"
                    value={o.value}
                    checked={purpose === o.value}
                    onChange={() => setPurpose(o.value)}
                    className="h-5 w-5 shrink-0 accent-[#0c1219]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-ink">{o.label}</span>
                    <span className="block text-[12px] text-ink-muted">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </StaggerItem>

        <StaggerItem>
          <div className="grid gap-4 rounded-card border-2 border-line-strong bg-card p-4">
            <div>
              <label htmlFor="visitor-name" className="mb-1.5 block text-[13px] font-semibold text-ink">
                Your full name
              </label>
              <input
                id="visitor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="field"
              />
            </div>

            <div>
              <label htmlFor="visitor-company" className="mb-1.5 block text-[13px] font-semibold text-ink">
                Your company
              </label>
              <input
                id="visitor-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="organization"
                className="field"
              />
            </div>

            <div>
              <label htmlFor="visitor-reg" className="mb-1.5 block text-[13px] font-semibold text-ink">
                Vehicle registration
              </label>
              <input
                id="visitor-reg"
                value={reg}
                onChange={(e) => setReg(e.target.value.toUpperCase())}
                placeholder="YX24 KDJ"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="field font-mono text-lg tracking-wide"
              />
              <p className="mt-1.5 text-[12.5px] text-ink-muted">
                The vehicle you brought in, not the trailer you are picking up.
              </p>
            </div>

            <div>
              <label htmlFor="visitor-visiting" className="mb-1.5 block text-[13px] font-semibold text-ink">
                Who are you visiting?
              </label>
              <input
                id="visitor-visiting"
                value={visiting}
                onChange={(e) => setVisiting(e.target.value)}
                placeholder={delivering ? 'Goods-in, or the name of the person' : 'Despatch, or the name of the person'}
                autoComplete="off"
                className="field"
              />
              <p className="mt-1.5 text-[12.5px] text-ink-muted">
                A department is enough. It is where the gatehouse sends anyone looking for you.
              </p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="rounded-card border-2 border-line-strong bg-card p-4">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">Your signature</span>
            <SignaturePad value={paths} onChange={setPaths} />
            <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">
              Signing confirms you have read the site safety notice and that you are responsible for your own load
              restraint while you are on site.
            </p>
          </div>
        </StaggerItem>
      </Stagger>

      {result?.kind === 'error' && (
        <p role="alert" className="rounded-card border-2 border-stop/40 bg-stop-wash px-4 py-3 text-[13px] text-stop">
          {result.message}
        </p>
      )}

      {/* The reason a submit is unavailable belongs next to the last field, not
          crammed into the action bar where it would wrap into four lines. */}
      <p id="visitor-signin-status" className="text-[12.5px] leading-snug text-ink-muted">
        {status}
      </p>

      {/* Bottom-anchored action: the same place on every form in this app, and
          the only part of the screen a thumb reaches without moving the hand. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur no-print">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <button
            type="submit"
            disabled={submitting || missing.length > 0}
            aria-describedby="visitor-signin-status"
            className="flex w-full items-center justify-center gap-2 rounded-tile border-2 border-ink bg-ink px-5 py-3 text-[15px] font-bold text-card transition-colors hover:bg-ink-soft disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {submitting ? 'Signing in' : 'Sign in'}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Result screens swap in over the form. The spring is short and moves on one
 * axis only, so the change reads as the form being put away rather than the
 * page being reloaded.
 */
function ResultPanel({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  if (reduced) return <div className="grid gap-4">{children}</div>;

  return (
    <motion.div
      className="grid gap-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    >
      {children}
    </motion.div>
  );
}
