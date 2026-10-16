'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, CloudOff, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Plate } from '@/components/Plate';
import { SignaturePad } from '@/components/SignaturePad';
import { Tile } from '@/components/Tile';
import { enqueue, useRememberedDriver } from '@/lib/client-storage';
import { CONTRACTS, DEFECT_LABELS, HEIGHT_OPTIONS, SITE_NAME } from '@/lib/site';
import { localNow } from '@/lib/time';
import type { DriverBasis } from '@/lib/types';
import { clsx } from 'clsx';

/**
 * The brief-in.
 *
 * Deliberately shorter than the debrief. Coming back is the low-attention moment
 * of the shift — the driver wants to hand the keys over and go home, and any form
 * that is long at that point gets skipped. Two steps, no route, no height check,
 * no risk score.
 *
 * The height is still captured, because a running height recorded on the way in
 * is what makes the next departure's check pre-fillable.
 */

export function BriefForm() {
  const reduced = useReducedMotion();
  const { driver, remember } = useRememberedDriver();

  const [step, setStep] = useState<1 | 2>(1);
  const [driverName, setDriverName] = useState('');
  const [driverRef, setDriverRef] = useState('');
  const [basis, setBasis] = useState<DriverBasis>('employed');
  const [reg, setReg] = useState('');
  const [trailer, setTrailer] = useState('');
  const [contract, setContract] = useState(CONTRACTS[0]);
  const [runningHeight, setRunningHeight] = useState(4.2);
  const [defectId, setDefectId] = useState('none');
  const [defectNote, setDefectNote] = useState('');
  const [keysReturned, setKeysReturned] = useState(false);
  const [note, setNote] = useState('');
  const [signaturePaths, setSignaturePaths] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'queued' | 'error'>('idle');
  const [recordId, setRecordId] = useState('');
  const [error, setError] = useState('');

  const name = driverName || driver?.name || '';
  const ref = driverRef || driver?.ref || '';

  const canLeave1 = reg.trim().length >= 4 && name.trim().length >= 2;
  const canSubmit = signaturePaths.length > 0 && keysReturned;

  const defectText = useMemo(
    () =>
      defectId === 'none'
        ? defectNote.trim()
        : `${DEFECT_LABELS.find((d) => d.id === defectId)?.label ?? 'Defect'}${
            defectNote.trim() ? ` — ${defectNote.trim()}` : ''
          }`,
    [defectId, defectNote],
  );

  const submit = async () => {
    setState('sending');
    setError('');

    const now = localNow();
    const body = {
      kind: 'brief' as const,
      operatorName: name.trim(),
      operatorRef: ref.trim(),
      operatorBasis: basis,
      company: contract,
      visitorPurpose: null,
      reg: reg.trim().toUpperCase(),
      trailer: trailer.trim().toUpperCase(),
      contract,
      runningHeight,
      direction: 'in' as const,
      recordedAt: now,
      delayMinutes: 0,
      runRef: '',
      routeRef: '',
      routeHasHeightRestriction: false,
      defectFlagged: defectId !== 'none' || defectNote.trim().length > 0,
      defectNote: defectText,
      heightAcknowledged: true,
      operatorSignature: { paths: signaturePaths, name: name.trim(), signedAt: now },
      securityName: '',
      securitySignedAt: null,
      riskScore: 0,
      riskBand: 'green' as const,
      bridgeWarning: '',
      siteName: SITE_NAME,
      note: keysReturned ? `Keys returned. ${note.trim()}`.trim() : note.trim(),
      routeTrips90d: 0,
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
        setError(detail?.error ?? 'The handover was not accepted. Check the details and try again.');
        setState('error');
        return;
      }

      const data = (await res.json()) as { id: string };
      remember({ name: body.operatorName, ref: body.operatorRef, basis: body.operatorBasis });
      setRecordId(data.id);
      setState('done');
    } catch {
      enqueue(body);
      setState('queued');
    }
  };

  if (state === 'done') {
    return (
      <div className="grid gap-4">
        <div className="rounded-card border-2 border-line-strong bg-card p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clear text-white" aria-hidden>
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-ink">Handover recorded</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Record <span className="font-mono text-ink">{recordId}</span>. The desk can see the keys are back.
          </p>
          {defectId !== 'none' && (
            <p className="mx-auto mt-3 max-w-sm rounded-tile border border-stop/35 bg-stop-wash px-3 py-2 text-[12.5px] text-stop">
              The defect is on the record. Take the vehicle out of service unless the office tells you otherwise.
            </p>
          )}
        </div>
        <Tile href="/" variant="primary" title="Done" description="Back to the start." />
      </div>
    );
  }

  if (state === 'queued') {
    return (
      <div className="grid gap-4">
        <div className="rounded-card border-2 border-caution/40 bg-caution-wash p-5">
          <CloudOff className="h-6 w-6 text-caution" aria-hidden />
          <h2 className="mt-2 font-display text-lg font-bold text-ink">Saved on your phone, not sent yet</h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">
            No signal. This handover is held on this device and will send itself when the app is next open with a
            connection.
          </p>
        </div>
        <Tile href="/" variant="primary" title="Done" description="Back to the start." />
      </div>
    );
  }

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
            <section aria-labelledby="b1" className="grid gap-4">
              <h2 id="b1" className="font-display text-lg font-bold tracking-tight text-ink">What are you bringing back?</h2>

              <div>
                <label htmlFor="b-reg" className="mb-1.5 block text-[13px] font-semibold text-ink">Vehicle registration</label>
                <input
                  id="b-reg"
                  value={reg}
                  onChange={(e) => setReg(e.target.value.toUpperCase())}
                  placeholder="YX24 KDJ"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="field font-mono text-lg tracking-wide"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="b-trailer" className="mb-1.5 block text-[13px] font-semibold text-ink">Trailer number</label>
                  <input id="b-trailer" value={trailer} onChange={(e) => setTrailer(e.target.value.toUpperCase())} placeholder="TRL-0000" autoComplete="off" spellCheck={false} className="field font-mono" />
                </div>
                <div>
                  <label htmlFor="b-contract" className="mb-1.5 block text-[13px] font-semibold text-ink">Contract</label>
                  <select id="b-contract" value={contract} onChange={(e) => setContract(e.target.value)} className="field">
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
                      onClick={() => setRunningHeight(h)}
                      aria-pressed={runningHeight === h}
                      className={clsx(
                        'rounded-tile border-2 px-3.5 py-2 font-mono text-[15px] tabular transition-colors',
                        runningHeight === h ? 'border-ink bg-ink text-card' : 'border-line-strong bg-card text-ink hover:border-ink',
                      )}
                    >
                      {h.toFixed(2)}m
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="b-name" className="mb-1.5 block text-[13px] font-semibold text-ink">Your name</label>
                  <input id="b-name" value={name} onChange={(e) => setDriverName(e.target.value)} autoComplete="name" className="field" />
                </div>
                <div>
                  <label htmlFor="b-ref" className="mb-1.5 block text-[13px] font-semibold text-ink">Driver number</label>
                  <input id="b-ref" value={ref} onChange={(e) => setDriverRef(e.target.value)} placeholder="D-0000" autoComplete="off" spellCheck={false} className="field font-mono" />
                </div>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold text-ink">How are you employed here?</legend>
                <div className="flex flex-wrap gap-2">
                  {(['employed', 'agency', 'subcontractor'] as DriverBasis[]).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBasis(b)}
                      aria-pressed={basis === b}
                      className={clsx(
                        'rounded-tile border-2 px-3.5 py-2 text-[13px] font-semibold capitalize transition-colors',
                        basis === b ? 'border-ink bg-ink text-card' : 'border-line-strong bg-card text-ink hover:border-ink',
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </fieldset>

              {reg.length >= 4 && (
                <div className="flex items-center gap-2.5 rounded-card border border-line bg-card p-3">
                  <Plate reg={reg} size="md" />
                  <span className="text-[12.5px] text-ink-muted">Check this matches the vehicle you are handing back.</span>
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="b2" className="grid gap-5">
              <h2 id="b2" className="font-display text-lg font-bold tracking-tight text-ink">Handover</h2>

              <label className="flex cursor-pointer items-start gap-3 rounded-card border-2 border-line-strong bg-card p-4">
                <input
                  type="checkbox"
                  checked={keysReturned}
                  onChange={(e) => setKeysReturned(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#0c1219]"
                />
                <span className="text-[13.5px] leading-snug text-ink">
                  Keys and fuel card are back in the gatehouse, and the vehicle is parked in its bank.
                </span>
              </label>

              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold text-ink">Anything wrong with the vehicle or load?</legend>
                <div className="flex flex-wrap gap-2">
                  {DEFECT_LABELS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDefectId(d.id)}
                      aria-pressed={defectId === d.id}
                      className={clsx(
                        'rounded-tile border-2 px-3 py-2 text-[13px] font-semibold transition-colors',
                        defectId === d.id
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
                {defectId !== 'none' && (
                  <input
                    value={defectNote}
                    onChange={(e) => setDefectNote(e.target.value)}
                    placeholder="Say what it is, in a few words"
                    className="field mt-2.5"
                  />
                )}
              </fieldset>

              <div>
                <label htmlFor="b-note" className="mb-1.5 block text-[13px] font-semibold text-ink">
                  Anything the office should know? <span className="font-normal text-ink-faint">Optional</span>
                </label>
                <textarea
                  id="b-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Load short, refused delivery, damaged pallet"
                  className="field resize-y"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-[13px] font-semibold text-ink">Your signature</span>
                <SignaturePad value={signaturePaths} onChange={setSignaturePaths} />
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {state === 'error' && (
        <p role="alert" className="rounded-card border-2 border-stop/40 bg-stop-wash px-4 py-3 text-[13px] text-stop">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur no-print">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-tile border-2 border-line-strong bg-card px-4 py-3 text-[14px] font-semibold text-ink transition-colors hover:border-ink"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (step === 1 ? setStep(2) : void submit())}
            disabled={state === 'sending' || (step === 1 ? !canLeave1 : !canSubmit)}
            className="ml-auto flex items-center justify-center gap-2 rounded-tile border-2 border-ink bg-ink px-5 py-3 text-[15px] font-bold text-card transition-colors hover:bg-ink-soft disabled:opacity-40"
          >
            {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {step === 1 ? 'Continue' : state === 'sending' ? 'Recording' : 'Record handover'}
          </button>
        </div>
      </div>
    </div>
  );
}
