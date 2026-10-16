'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, ChevronRight, CloudOff, Loader2, Truck, UserRound } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Plate } from '@/components/Plate';
import { RiskNotice } from '@/components/RiskNotice';
import { SignaturePad } from '@/components/SignaturePad';
import { Tile } from '@/components/Tile';
import { enqueue, useRememberedDriver } from '@/lib/client-storage';
import { assessRisk } from '@/lib/risk';
import { routeByRef, ROUTES } from '@/lib/routes';
import { RUNSHEET, type RunCard } from '@/lib/runsheet';
import { CONTRACTS, DEFECT_LABELS, HEIGHT_OPTIONS, SITE_NAME } from '@/lib/site';
import { localNow, minutesLate } from '@/lib/time';
import type { DriverBasis, RiskAssessment } from '@/lib/types';
import { clsx } from 'clsx';

/**
 * The debrief.
 *
 * This is the screen the whole product exists for. Everything else is navigation.
 *
 * The design constraint it is built around: a driver who is clear to go should be
 * through this in four taps, and should never see anything they do not have to
 * read. A driver whose departure is flagged sees the whole screen turn red and
 * has to acknowledge before they can leave.
 *
 * Steps are a real sequence (run, vehicle, route, sign-off), which is the only
 * reason numbering appears anywhere in this product.
 *
 * Risk is computed twice on purpose — locally for the live preview, then again on
 * the server, which is the authoritative value that gets stored. A safety score
 * the submitting device could set would be worth nothing.
 */

type Step = 1 | 2 | 3 | 4;

interface Draft {
  runRef: string | null;
  manual: boolean;
  driverRef: string;
  driverName: string;
  basis: DriverBasis;
  familiar: boolean | null;
  reg: string;
  trailer: string;
  contract: string;
  runningHeight: number;
  routeRef: string;
  heightAcknowledged: boolean;
  defectId: string;
  defectNote: string;
  securityName: string;
  note: string;
  signaturePaths: string[];
}

const EMPTY: Draft = {
  runRef: null,
  manual: false,
  driverRef: '',
  driverName: '',
  basis: 'employed',
  familiar: null,
  reg: '',
  trailer: '',
  contract: CONTRACTS[0],
  runningHeight: 4.2,
  routeRef: ROUTES[0].ref,
  heightAcknowledged: false,
  defectId: 'none',
  defectNote: '',
  securityName: '',
  note: '',
  signaturePaths: [],
};

const STEP_TITLES = ['Your run', 'Vehicle', 'Route and height', 'Condition and sign-off'] as const;

export function DebriefForm() {
  const reduced = useReducedMotion();
  const { driver, remember } = useRememberedDriver();

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'done'; id: string; risk: RiskAssessment; bridgeWarning: string; persisted: boolean }
    | { kind: 'queued' }
    | { kind: 'error'; message: string }
    | null
  >(null);

  // Identity is remembered per device. Re-asking every shift is the kind of
  // friction that quietly kills take-up.
  const effectiveDraft = useMemo<Draft>(
    () =>
      driver && !draft.driverName
        ? { ...draft, driverName: driver.name, driverRef: driver.ref, basis: (driver.basis as DriverBasis) ?? 'employed' }
        : draft,
    [driver, draft],
  );

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const route = routeByRef(effectiveDraft.routeRef);

  const risk = useMemo(
    () =>
      assessRisk({
        basis: effectiveDraft.basis,
        // In production this is read from the driver's record. Here it is the
        // driver's own answer, which is the honest version: it is the only
        // familiarity signal available to a system with no history yet.
        routeTrips90d: effectiveDraft.familiar === true ? 10 : 0,
        runningHeight: effectiveDraft.runningHeight,
        routeHasHeightRestriction: route?.restrictionMetres != null,
        routeRestrictionMetres: route?.restrictionMetres ?? null,
        routeRestrictionName: route?.restrictionName ?? null,
        heightAcknowledged: effectiveDraft.heightAcknowledged,
        priorIncidents: 0,
        delayMinutes: 0,
      }),
    [effectiveDraft, route],
  );

  const bridgeWarning =
    risk.bridgeWarning && route?.restrictionName
      ? `${route.restrictionName} — signed ${route.restrictionMetres?.toFixed(1)}m, vehicle ${effectiveDraft.runningHeight.toFixed(2)}m`
      : '';

  const applyRun = (run: RunCard) => {
    setDraft((d) => ({
      ...d,
      runRef: run.ref,
      manual: false,
      reg: run.plannedReg,
      trailer: run.plannedTrailer,
      contract: run.contract,
      runningHeight: run.plannedHeight,
      routeRef: run.routeRef,
    }));
    setStep(2);
  };

  const canLeaveStep1 = effectiveDraft.runRef !== null || effectiveDraft.manual;
  const canLeaveStep2 = effectiveDraft.reg.trim().length >= 4 && effectiveDraft.driverName.trim().length >= 2;
  const canLeaveStep3 = effectiveDraft.familiar !== null;
  const canLeaveStep4 =
    effectiveDraft.signaturePaths.length > 0 &&
    (risk.band !== 'red' || effectiveDraft.heightAcknowledged);

  const submit = async () => {
    setSubmitting(true);
    setResult(null);

    const run = RUNSHEET.find((r) => r.ref === effectiveDraft.runRef);
    const now = localNow();

    const body = {
      kind: 'debrief' as const,
      operatorName: effectiveDraft.driverName.trim(),
      operatorRef: effectiveDraft.driverRef.trim(),
      operatorBasis: effectiveDraft.basis,
      company: effectiveDraft.contract,
      visitorPurpose: null,
      reg: effectiveDraft.reg.trim().toUpperCase(),
      trailer: effectiveDraft.trailer.trim(),
      contract: effectiveDraft.contract,
      runningHeight: effectiveDraft.runningHeight,
      direction: 'out' as const,
      recordedAt: now,
      delayMinutes: run ? minutesLate(run.plannedDeparture, now) : 0,
      runRef: effectiveDraft.runRef ?? '',
      routeRef: effectiveDraft.routeRef,
      routeHasHeightRestriction: route?.restrictionMetres != null,
      defectFlagged: effectiveDraft.defectId !== 'none' || effectiveDraft.defectNote.trim().length > 0,
      defectNote:
        effectiveDraft.defectId === 'none'
          ? effectiveDraft.defectNote.trim()
          : `${DEFECT_LABELS.find((d) => d.id === effectiveDraft.defectId)?.label ?? 'Defect'}${
              effectiveDraft.defectNote.trim() ? ` — ${effectiveDraft.defectNote.trim()}` : ''
            }`,
      heightAcknowledged: effectiveDraft.heightAcknowledged,
      operatorSignature: {
        paths: effectiveDraft.signaturePaths,
        name: effectiveDraft.driverName.trim(),
        signedAt: now,
      },
      securityName: effectiveDraft.securityName.trim(),
      securitySignedAt: effectiveDraft.securityName.trim() ? now : null,
      note: effectiveDraft.note.trim(),
      siteName: SITE_NAME,
      // Historical inputs the server would normally read from the driver record.
      routeTrips90d: effectiveDraft.familiar === true ? 10 : 0,
      priorIncidents: 0,
    };

    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        setResult({ kind: 'error', message: detail?.error ?? 'The record was not accepted. Check the details and try again.' });
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as {
        id: string;
        risk: RiskAssessment;
        bridgeWarning: string;
        persisted: boolean;
      };

      remember({ name: body.operatorName, ref: body.operatorRef, basis: body.operatorBasis });
      setResult({ kind: 'done', id: data.id, risk: data.risk, bridgeWarning: data.bridgeWarning, persisted: data.persisted });
    } catch {
      // No signal. Keep the record rather than losing it — this is the case the
      // whole offline path exists for.
      enqueue(body);
      setResult({ kind: 'queued' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Result screens ────────────────────────────────────────────────────────
  if (result?.kind === 'done') {
    return (
      <div className="grid gap-4">
        <div className="rounded-card border-2 border-line-strong bg-card p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clear text-white" aria-hidden>
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-ink">Debrief recorded</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Record <span className="font-mono text-ink">{result.id}</span> is in the workbook. The office can see it now
            — you do not need to take anything to the desk.
          </p>
          {!result.persisted && (
            <p className="mx-auto mt-3 max-w-sm rounded-tile border border-caution/40 bg-caution-wash px-3 py-2 text-[12.5px] text-caution">
              This server is running on a read-only disk, so the record is only held in memory. Use a writable data
              directory before relying on it.
            </p>
          )}
        </div>

        {result.risk.band !== 'green' && <RiskNotice assessment={result.risk} bridgeWarning={result.bridgeWarning} />}

        <Tile href="/" variant="primary" title="Done" description="Back to the start." />
      </div>
    );
  }

  if (result?.kind === 'queued') {
    return (
      <div className="grid gap-4">
        <div className="rounded-card border-2 border-caution/40 bg-caution-wash p-5">
          <CloudOff className="h-6 w-6 text-caution" aria-hidden />
          <h2 className="mt-2 font-display text-lg font-bold text-ink">Saved on your phone, not sent yet</h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">
            No signal, so the debrief is held on this device. It will send by itself as soon as the app is open with a
            connection. Do not clear your browser data before it has gone.
          </p>
        </div>
        <Tile href="/" variant="primary" title="Done" description="Back to the start." />
      </div>
    );
  }

  // ── The four steps ────────────────────────────────────────────────────────
  return (
    <div className="grid gap-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={reduced ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: -12 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        >
          {step === 1 && (
            <section aria-labelledby="step1">
              <h2 id="step1" className="font-display text-lg font-bold tracking-tight text-ink">
                Which run are you on?
              </h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                Planned last night, and it may have changed since. Pick yours, then correct anything that is wrong on
                the next screen.
              </p>

              <ul className="mt-4 grid gap-2.5">
                {RUNSHEET.map((run) => (
                  <li key={run.ref}>
                    <button
                      type="button"
                      onClick={() => applyRun(run)}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-card border-2 bg-card p-3.5 text-left transition-colors',
                        effectiveDraft.runRef === run.ref ? 'border-ink' : 'border-line-strong hover:border-ink',
                      )}
                    >
                      <span className="w-[52px] shrink-0 text-center">
                        <span className="block font-mono text-[15px] tabular font-semibold text-ink">
                          {run.plannedDeparture}
                        </span>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                          {run.routeRef}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-ink">{run.contract}</span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <Plate reg={run.plannedReg} size="sm" />
                          <span className="truncate font-mono text-[11px] text-ink-muted">
                            {run.plannedTrailer} · {run.stops} stops
                          </span>
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                    </button>
                  </li>
                ))}

                <li>
                  <Tile
                    variant="quiet"
                    title="I'm not on a run"
                    description="Yard move, shunting, or a run that is not listed."
                    icon={<Truck className="h-5 w-5 text-ink-soft" />}
                    onClick={() => {
                      setDraft((d) => ({ ...d, manual: true, runRef: null }));
                      setStep(2);
                    }}
                  />
                </li>
              </ul>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="step2">
              <h2 id="step2" className="font-display text-lg font-bold tracking-tight text-ink">What are you taking out?</h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                Keys come off the board, so the allocation on the run card is only a guess. Change anything that does
                not match what you actually have.
              </p>

              <div className="mt-4 grid gap-4">
                <div>
                  <label htmlFor="reg" className="mb-1.5 block text-[13px] font-semibold text-ink">
                    Vehicle registration
                  </label>
                  <input
                    id="reg"
                    value={effectiveDraft.reg}
                    onChange={(e) => set('reg', e.target.value.toUpperCase())}
                    placeholder="YX24 KDJ"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="field font-mono text-lg tracking-wide"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="trailer" className="mb-1.5 block text-[13px] font-semibold text-ink">Trailer number</label>
                    <input
                      id="trailer"
                      value={effectiveDraft.trailer}
                      onChange={(e) => set('trailer', e.target.value.toUpperCase())}
                      placeholder="TRL-0000"
                      autoComplete="off"
                      spellCheck={false}
                      className="field font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="contract" className="mb-1.5 block text-[13px] font-semibold text-ink">Contract</label>
                    <select id="contract" value={effectiveDraft.contract} onChange={(e) => set('contract', e.target.value)} className="field">
                      {CONTRACTS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-semibold text-ink">Running height</legend>
                  <div className="flex flex-wrap gap-2">
                    {HEIGHT_OPTIONS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => set('runningHeight', h)}
                        aria-pressed={effectiveDraft.runningHeight === h}
                        className={clsx(
                          'rounded-tile border-2 px-3.5 py-2 font-mono text-[15px] tabular transition-colors',
                          effectiveDraft.runningHeight === h
                            ? 'border-ink bg-ink text-card'
                            : 'border-line-strong bg-card text-ink hover:border-ink',
                        )}
                      >
                        {h.toFixed(2)}m
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="driverName" className="mb-1.5 block text-[13px] font-semibold text-ink">Your name</label>
                    <input id="driverName" value={effectiveDraft.driverName} onChange={(e) => set('driverName', e.target.value)} autoComplete="name" className="field" />
                  </div>
                  <div>
                    <label htmlFor="driverRef" className="mb-1.5 block text-[13px] font-semibold text-ink">Driver number</label>
                    <input id="driverRef" value={effectiveDraft.driverRef} onChange={(e) => set('driverRef', e.target.value)} placeholder="D-0000" autoComplete="off" spellCheck={false} className="field font-mono" />
                  </div>
                </div>

                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-semibold text-ink">How are you employed here?</legend>
                  <div className="flex flex-wrap gap-2">
                    {(['employed', 'agency', 'subcontractor'] as DriverBasis[]).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => set('basis', b)}
                        aria-pressed={effectiveDraft.basis === b}
                        className={clsx(
                          'rounded-tile border-2 px-3.5 py-2 text-[13px] font-semibold capitalize transition-colors',
                          effectiveDraft.basis === b ? 'border-ink bg-ink text-card' : 'border-line-strong bg-card text-ink hover:border-ink',
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="step3">
              <h2 id="step3" className="font-display text-lg font-bold tracking-tight text-ink">Where are you going?</h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                Height is the one thing that cannot be fixed once you are under a bridge. This is the check that stops
                that happening.
              </p>

              <div className="mt-4 grid gap-4">
                <div>
                  <label htmlFor="route" className="mb-1.5 block text-[13px] font-semibold text-ink">Planned route</label>
                  <select id="route" value={effectiveDraft.routeRef} onChange={(e) => { set('routeRef', e.target.value); set('heightAcknowledged', false); }} className="field">
                    {ROUTES.map((r) => (
                      <option key={r.ref} value={r.ref}>
                        {r.ref} — {r.name}
                      </option>
                    ))}
                  </select>
                  {route && <p className="mt-1.5 text-[12.5px] leading-snug text-ink-muted">{route.notes}</p>}
                </div>

                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-semibold text-ink">Have you run this route before?</legend>
                  <div className="flex gap-2">
                    {[
                      { v: true, label: 'Yes, I know it' },
                      { v: false, label: 'No, or not sure' },
                    ].map((o) => (
                      <button
                        key={String(o.v)}
                        type="button"
                        onClick={() => set('familiar', o.v)}
                        aria-pressed={effectiveDraft.familiar === o.v}
                        className={clsx(
                          'flex-1 rounded-tile border-2 px-3.5 py-2.5 text-[13px] font-semibold transition-colors',
                          effectiveDraft.familiar === o.v ? 'border-ink bg-ink text-card' : 'border-line-strong bg-card text-ink hover:border-ink',
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {(route?.restrictionMetres != null || risk.band !== 'green') && (
                  <>
                    <RiskNotice assessment={risk} bridgeWarning={bridgeWarning} />

                    {route?.restrictionMetres != null && (
                      <label className="flex cursor-pointer items-start gap-3 rounded-card border-2 border-line-strong bg-card p-4">
                        <input
                          type="checkbox"
                          checked={effectiveDraft.heightAcknowledged}
                          onChange={(e) => set('heightAcknowledged', e.target.checked)}
                          className="mt-0.5 h-5 w-5 shrink-0 accent-[#0c1219]"
                        />
                        <span className="text-[13.5px] leading-snug text-ink">
                          I have checked my running height of{' '}
                          <span className="font-mono font-semibold">{effectiveDraft.runningHeight.toFixed(2)}m</span>{' '}
                          against every restriction on <span className="font-semibold">{route.name}</span>, and I know
                          what my vehicle is actually carrying.
                        </span>
                      </label>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {step === 4 && (
            <section aria-labelledby="step4">
              <h2 id="step4" className="font-display text-lg font-bold tracking-tight text-ink">Condition and sign-off</h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                This is the part that replaces the sheet of paper. It takes about ten seconds.
              </p>

              <div className="mt-4 grid gap-5">
                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-semibold text-ink">Anything wrong with the vehicle or load?</legend>
                  <div className="flex flex-wrap gap-2">
                    {DEFECT_LABELS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => set('defectId', d.id)}
                        aria-pressed={effectiveDraft.defectId === d.id}
                        className={clsx(
                          'rounded-tile border-2 px-3 py-2 text-[13px] font-semibold transition-colors',
                          effectiveDraft.defectId === d.id
                            ? d.id === 'none'
                              ? 'border-ink bg-ink text-card'
                              : 'border-stop bg-stop text-white'
                            : 'border-line-strong bg-card text-ink hover:border-ink',
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {effectiveDraft.defectId !== 'none' && (
                    <input
                      value={effectiveDraft.defectNote}
                      onChange={(e) => set('defectNote', e.target.value)}
                      placeholder="Say what it is, in a few words"
                      className="field mt-2.5"
                    />
                  )}
                  {effectiveDraft.defectId !== 'none' && (
                    <p className="mt-1.5 text-[12.5px] text-stop">
                      A defect is recorded against the vehicle and the transport office is told. Do not drive on it if it
                      makes the vehicle unroadworthy.
                    </p>
                  )}
                </fieldset>

                <div>
                  <label htmlFor="security" className="mb-1.5 block text-[13px] font-semibold text-ink">Security sign-off</label>
                  <input
                    id="security"
                    value={effectiveDraft.securityName}
                    onChange={(e) => set('securityName', e.target.value)}
                    placeholder="Who checked your load off?"
                    className="field"
                  />
                </div>

                <div>
                  <label htmlFor="note" className="mb-1.5 block text-[13px] font-semibold text-ink">
                    Anything the office should know? <span className="font-normal text-ink-faint">Optional</span>
                  </label>
                  <textarea
                    id="note"
                    value={effectiveDraft.note}
                    onChange={(e) => set('note', e.target.value)}
                    rows={2}
                    placeholder="Road closures, access problems, running late"
                    className="field resize-y"
                  />
                </div>

                <div>
                  <span className="mb-1.5 block text-[13px] font-semibold text-ink">Your signature</span>
                  <SignaturePad value={effectiveDraft.signaturePaths} onChange={(paths) => set('signaturePaths', paths)} />
                </div>

                {risk.band !== 'green' && <RiskNotice assessment={risk} bridgeWarning={bridgeWarning} />}
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {result?.kind === 'error' && (
        <p role="alert" className="rounded-card border-2 border-stop/40 bg-stop-wash px-4 py-3 text-[13px] text-stop">
          {result.message}
        </p>
      )}

      {/* Bottom-anchored action: reachable with one thumb, always in the same place. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur no-print">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="rounded-tile border-2 border-line-strong bg-card px-4 py-3 text-[14px] font-semibold text-ink transition-colors hover:border-ink"
            >
              Back
            </button>
          )}
          <span className="hidden flex-1 text-[12.5px] text-ink-faint sm:block">
            Step {step} of 4 · {STEP_TITLES[step - 1]}
          </span>
          <button
            type="button"
            onClick={() => (step < 4 ? setStep((s) => (s + 1) as Step) : void submit())}
            disabled={
              submitting ||
              (step === 1 && !canLeaveStep1) ||
              (step === 2 && !canLeaveStep2) ||
              (step === 3 && !canLeaveStep3) ||
              (step === 4 && !canLeaveStep4)
            }
            className={clsx(
              'ml-auto flex items-center justify-center gap-2 rounded-tile border-2 px-5 py-3 text-[15px] font-bold transition-colors disabled:opacity-40',
              risk.band === 'red' && step === 4
                ? 'border-stop bg-stop text-white hover:bg-[#a82c26]'
                : 'border-ink bg-ink text-card hover:bg-ink-soft',
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {step < 4 ? 'Continue' : submitting ? 'Recording' : risk.band === 'red' ? 'Record and stop' : 'Record debrief'}
          </button>
        </div>
      </div>

      {step === 2 && effectiveDraft.driverName && (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-faint">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          Remembered on this phone as {effectiveDraft.driverName}. It will pre-fill next time.
        </p>
      )}
    </div>
  );
}
