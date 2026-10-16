'use client';

import { CheckCircle2, CloudOff, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Tile } from '@/components/Tile';
import { enqueue, useRememberedDriver } from '@/lib/client-storage';
import { SITE_NAME } from '@/lib/site';
import { localNow } from '@/lib/time';

/**
 * Warehouse shift note.
 *
 * The warehouse equivalent of a debrief is much smaller: one line about what
 * changed, plus a name. Anything longer does not get filled in at the end of a
 * shift, so this stays at two fields and a button.
 */
export function ShiftNoteForm() {
  const { driver } = useRememberedDriver();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'queued' | 'error'>('idle');
  const [error, setError] = useState('');

  const who = name || driver?.name || '';
  const canSubmit = who.trim().length >= 2 && note.trim().length >= 4;

  const submit = async () => {
    setState('sending');
    setError('');

    const now = localNow();
    const body = {
      kind: 'warehouse' as const,
      operatorName: who.trim(),
      operatorRef: '',
      operatorBasis: 'employed' as const,
      company: '',
      visitorPurpose: null,
      reg: '',
      trailer: '',
      contract: '',
      runningHeight: 0,
      direction: 'in' as const,
      recordedAt: now,
      delayMinutes: 0,
      runRef: '',
      routeRef: '',
      routeHasHeightRestriction: false,
      defectFlagged: false,
      defectNote: '',
      heightAcknowledged: true,
      operatorSignature: null,
      securityName: '',
      securitySignedAt: null,
      riskScore: 0,
      riskBand: 'green' as const,
      bridgeWarning: '',
      siteName: SITE_NAME,
      note: note.trim(),
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
        setError(detail?.error ?? 'The note was not accepted. Check it and try again.');
        setState('error');
        return;
      }
      setState('done');
    } catch {
      enqueue(body);
      setState('queued');
    }
  };

  if (state === 'done' || state === 'queued') {
    return (
      <div className="grid gap-4">
        <div
          className={`rounded-card border-2 p-5 ${
            state === 'done' ? 'border-clear/30 bg-clear-wash' : 'border-caution/40 bg-caution-wash'
          }`}
        >
          {state === 'done' ? (
            <CheckCircle2 className="h-6 w-6 text-clear" aria-hidden />
          ) : (
            <CloudOff className="h-6 w-6 text-caution" aria-hidden />
          )}
          <h2 className="mt-2 font-display text-lg font-bold text-ink">
            {state === 'done' ? 'Note recorded' : 'Saved on your phone, not sent yet'}
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">
            {state === 'done'
              ? 'The shift manager and the office can see it.'
              : 'No signal. It will send itself when the app is next open with a connection.'}
          </p>
        </div>
        <Tile href="/staff/warehouse" variant="primary" title="Done" description="Back to the warehouse screen." />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor="w-name" className="mb-1.5 block text-[13px] font-semibold text-ink">Your name</label>
        <input id="w-name" value={who} onChange={(e) => setName(e.target.value)} autoComplete="name" className="field" />
      </div>

      <div>
        <label htmlFor="w-note" className="mb-1.5 block text-[13px] font-semibold text-ink">What changed this shift?</label>
        <textarea
          id="w-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Bank 4 coned off, FLT 12 off the road, trailer pool down to two"
          className="field resize-y"
        />
        <p className="mt-1.5 text-[12.5px] text-ink-muted">
          One or two lines is enough. It goes on the record with your name and the time.
        </p>
      </div>

      {state === 'error' && (
        <p role="alert" className="rounded-card border-2 border-stop/40 bg-stop-wash px-4 py-3 text-[13px] text-stop">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!canSubmit || state === 'sending'}
        className="flex items-center justify-center gap-2 rounded-tile border-2 border-ink bg-ink px-5 py-3 text-[15px] font-bold text-card transition-colors hover:bg-ink-soft disabled:opacity-40"
      >
        {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {state === 'sending' ? 'Recording' : 'Record note'}
      </button>
    </div>
  );
}
