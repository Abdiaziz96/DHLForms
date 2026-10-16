import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { APP_NAME, SITE_NAME } from '@/lib/site';

/**
 * The header used by every screen below the landing page.
 *
 * Left-aligned, no centred hero, no decorative eyebrow. The back control is a
 * real link so the browser's own history and the platform's back gesture both
 * behave, which matters because half the users will swipe rather than tap.
 */
export function ScreenHeader({
  title,
  subtitle,
  backHref = '/',
  backLabel = 'Back',
  right,
  step,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  right?: ReactNode;
  /** Optional position in a sequence, e.g. { index: 1, total: 3 }. Real sequence only. */
  step?: { index: number; total: number };
}) {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto max-w-3xl px-4 pb-4 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={backHref}
            className="-ml-2 flex items-center gap-1 rounded-tile px-2 py-1.5 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-card-sunk hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>

          <span className="truncate font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            {APP_NAME} · {SITE_NAME}
          </span>
        </div>

        <div className="mt-2.5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
              {title}
            </h1>
            {subtitle && <p className="mt-1 max-w-md text-[13.5px] leading-snug text-ink-muted">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>

        {step && (
          <div className="mt-3.5 flex items-center gap-2" aria-label={`Step ${step.index} of ${step.total}`}>
            {Array.from({ length: step.total }).map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${i < step.index ? 'bg-ink' : 'bg-line'}`}
                aria-hidden
              />
            ))}
            <span className="shrink-0 font-mono text-[11px] tabular text-ink-faint">
              {step.index}/{step.total}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

/** Page body wrapper. Consistent gutters everywhere. */
export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto max-w-3xl px-4 py-5 pb-28 ${className}`}>{children}</main>;
}
