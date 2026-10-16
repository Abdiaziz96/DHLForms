'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Check, OctagonAlert } from 'lucide-react';

import { BAND_GUIDANCE, BAND_LABEL } from '@/lib/risk';
import type { RiskAssessment } from '@/lib/types';

/**
 * The risk result.
 *
 * This is the one moment in the product that is allowed to raise its voice. A
 * clear departure gets a quiet confirmation and nothing else — the fast path has
 * to stay fast or nobody uses it. A stop gets the whole screen, because the only
 * failure that matters here is a driver glancing past a warning.
 *
 * The reasons are always listed verbatim. A score nobody can interrogate is a
 * score nobody will trust, and a transport manager needs to be able to disagree
 * with it out loud.
 */
export function RiskNotice({
  assessment,
  bridgeWarning,
}: {
  assessment: RiskAssessment;
  bridgeWarning?: string;
}) {
  const reduced = useReducedMotion();
  const { band, score, reasons } = assessment;

  if (band === 'green') {
    return (
      <div className="flex items-start gap-3 rounded-card border-2 border-clear/30 bg-clear-wash p-4">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-clear text-white" aria-hidden>
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <div>
          <p className="font-display text-[15px] font-bold text-clear">Clear to go</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{BAND_GUIDANCE.green}</p>
        </div>
      </div>
    );
  }

  const isStop = band === 'red';
  const tone = isStop
    ? { wrap: 'border-stop bg-stop text-white', muted: 'text-white/80', chip: 'bg-white/15' }
    : { wrap: 'border-caution bg-caution-wash text-ink', muted: 'text-ink-soft', chip: 'bg-caution/15' };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      role={isStop ? 'alert' : 'status'}
      className={`overflow-hidden rounded-card border-2 ${tone.wrap}`}
    >
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 shrink-0" aria-hidden>
          {isStop ? <OctagonAlert className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6 text-caution" />}
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">
            {isStop ? 'Do not move off' : 'Check before you go'}
          </p>
          <p className={`mt-1 text-[13px] leading-snug ${tone.muted}`}>{BAND_GUIDANCE[band]}</p>
        </div>
        <span
          className={`ml-auto shrink-0 rounded-full px-2 py-1 font-mono text-[11px] tabular font-semibold ${tone.chip}`}
          title={`Risk score ${score}`}
        >
          {BAND_LABEL[band]} {score}
        </span>
      </div>

      {isStop && bridgeWarning && (
        <div className="border-t border-white/20 bg-black/15 px-4 py-3">
          <p className="font-display text-[11px] font-bold uppercase tracking-wider text-white/70">Height conflict</p>
          <p className="mt-1 font-mono text-[13px] leading-relaxed text-white">{bridgeWarning}</p>
          <p className="mt-2 text-[13px] leading-snug text-white/85">
            Your declared running height is above a restriction on the planned route. Ring the transport office before
            you move. There is no route variation that makes this safe to attempt.
          </p>
        </div>
      )}

      {reasons.length > 0 && (
        <ul className={`border-t px-4 py-3 ${isStop ? 'border-white/20' : 'border-caution/25'}`}>
          {reasons.map((r) => (
            <li key={r} className={`flex items-start gap-2 py-0.5 text-[13px] ${tone.muted}`}>
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
