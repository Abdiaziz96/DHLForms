import { clsx } from 'clsx';

import { BAND_LABEL } from '@/lib/risk';
import type { RiskAssessment } from '@/lib/types';

/**
 * Risk band chip.
 *
 * Colour is never the only signal — the band always carries its word, so the
 * chip survives colour blindness, a cracked screen and a monochrome printout.
 */
export function Band({
  band,
  score,
  className,
}: {
  band: RiskAssessment['band'];
  score?: number;
  className?: string;
}) {
  const styles: Record<RiskAssessment['band'], string> = {
    green: 'bg-clear-wash text-clear border-clear/35',
    amber: 'bg-caution-wash text-caution border-caution/45',
    red: 'bg-stop-wash text-stop border-stop/45',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-wide',
        styles[band],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {BAND_LABEL[band]}
      {typeof score === 'number' && <span className="tabular font-mono font-medium opacity-70">{score}</span>}
    </span>
  );
}
