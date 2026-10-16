'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { dayOf, localNow, timeOf } from '@/lib/time';

/**
 * The safety acknowledgement.
 *
 * Local only, and deliberately so. Nothing here is sent anywhere: this is a
 * person saying they have read the notice, not a record of a vehicle movement,
 * and putting it in the workbook would fill the office export with noise.
 *
 * The date is captured with `localNow()` for the same reason every other
 * timestamp in this app is — the person reading it is standing on site, and a
 * UTC date can be a day out by the evening.
 *
 * The stored timestamp is the honest state of the device, so on a return visit
 * the control shows what was actually recorded rather than a fresh tick.
 */

const STORAGE_KEY = 'gatehouse.safety.ack';

type State =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'acknowledged'; acknowledgedAt: string }
  | { status: 'unsaved'; acknowledgedAt: string };

/** Tolerates anything in storage: a stale or hand-edited value is not a crash. */
function readState(): State {
  if (typeof window === 'undefined') return { status: 'none' };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: 'none' };
    const parsed: unknown = JSON.parse(raw);
    const at =
      parsed && typeof parsed === 'object' && 'acknowledgedAt' in parsed
        ? (parsed as { acknowledgedAt?: unknown }).acknowledgedAt
        : undefined;
    return typeof at === 'string' ? { status: 'acknowledged', acknowledgedAt: at } : { status: 'none' };
  } catch {
    // Corrupt or blocked storage reads as "not acknowledged". Showing an old
    // acknowledgement that may not exist is worse than asking again.
    return { status: 'none' };
  }
}

function writeState(acknowledgedAt: string): State {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ acknowledgedAt }));
    return { status: 'acknowledged', acknowledgedAt };
  } catch {
    // Private browsing, or a full quota. Acknowledge it for this visit and say
    // plainly that it will not be remembered, rather than failing silently.
    return { status: 'unsaved', acknowledgedAt };
  }
}

export function SafetyAcknowledge() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [ticked, setTicked] = useState(false);

  // Storage cannot be read during render without breaking hydration, so the
  // first paint is a real loading state rather than a guess.
  useEffect(() => {
    setState(readState());
  }, []);

  const acknowledge = () => {
    setTicked(false);
    setState(writeState(localNow()));
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Swap key={state.status}>
        {state.status === 'loading' && (
          <div role="status" aria-busy className="rounded-card border-2 border-line bg-card p-4">
            <span className="sr-only">Checking this device for an earlier acknowledgement</span>
            <div className="h-5 w-40 animate-pulse rounded bg-card-sunk" aria-hidden />
            <div className="mt-3 h-11 w-full animate-pulse rounded-tile bg-card-sunk" aria-hidden />
          </div>
        )}

        {state.status === 'none' && (
          <fieldset className="rounded-card border-2 border-ink bg-card p-4">
            <legend className="px-1 font-display text-[15px] font-bold tracking-tight text-ink">
              Acknowledge this notice
            </legend>
            <label className="flex cursor-pointer items-start gap-3 py-2">
              <input
                type="checkbox"
                checked={ticked}
                onChange={(e) => setTicked(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#0c1219]"
              />
              <span className="text-[13.5px] leading-snug text-ink">
                I have read the safety notice above and I will follow it while I am on site.
              </span>
            </label>

            <button
              type="button"
              onClick={acknowledge}
              disabled={!ticked}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-tile border-2 border-ink bg-ink px-5 py-3 text-[15px] font-bold text-card transition-colors hover:bg-ink-soft disabled:opacity-40"
            >
              Acknowledge
            </button>

            <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">
              Recorded on this phone and nowhere else. It is not sent to the office, and it does not replace signing in.
            </p>
          </fieldset>
        )}

        {state.status === 'acknowledged' && (
          <div className="rounded-card border-2 border-clear bg-clear-wash p-4">
            <p className="flex items-center gap-2 text-clear">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
              <span className="font-display text-[15px] font-bold tracking-tight">Acknowledged</span>
            </p>
            <p className="mt-2 text-[13.5px] leading-snug text-ink-soft">
              You acknowledged this notice on{' '}
              <span className="font-semibold text-ink">
                {dayOf(state.acknowledgedAt)} at {timeOf(state.acknowledgedAt)}
              </span>
              . It is saved on this phone, not sent to the office.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {/* The notice still sits above this control; this link is how a
                  person gets back to it without hunting up the page. */}
              <a
                href="#safety-notice"
                className="flex min-h-[44px] items-center rounded-tile border-2 border-line-strong bg-card px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink"
              >
                Read it again
              </a>
              <button
                type="button"
                onClick={acknowledge}
                className="flex items-center rounded-tile border-2 border-line-strong bg-card px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                Acknowledge again
              </button>
            </div>
          </div>
        )}

        {state.status === 'unsaved' && (
          <div className="rounded-card border-2 border-caution/40 bg-caution-wash p-4">
            <p className="flex items-center gap-2 text-caution">
              <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
              <span className="font-display text-[15px] font-bold tracking-tight">Not saved on this phone</span>
            </p>
            <p className="mt-2 text-[13.5px] leading-snug text-ink-soft">
              Your acknowledgement is recorded for this visit, but this browser is blocking local storage, so it will
              not be here next time. Use a normal browser window rather than a private one.
            </p>
            <button
              type="button"
              onClick={acknowledge}
              className="mt-3 flex items-center rounded-tile border-2 border-line-strong bg-card px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink"
            >
              Try again
            </button>
          </div>
        )}
      </Swap>
    </AnimatePresence>
  );
}

/** One short cross-fade per state change, and a plain swap under reduced motion. */
function Swap({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  if (reduced) return <div>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    >
      {children}
    </motion.div>
  );
}
