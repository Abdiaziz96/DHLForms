'use client';

import { CloudOff, RefreshCw, UploadCloud } from 'lucide-react';

import { useSyncQueue } from '@/lib/client-storage';

/**
 * Connectivity and queue status.
 *
 * Shown only when there is something to say. A banner that is always present
 * becomes furniture and stops being read, which defeats the point of having it.
 *
 * The wording matters: "saved on this phone" is accurate and "sending" is not,
 * because on iOS there is no background sync and nothing is moving until the app
 * is open with a connection.
 */
export function SyncBanner() {
  const { pending, online, draining, drain } = useSyncQueue();

  if (online && pending === 0) return null;

  const offline = !online;

  return (
    <div
      role="status"
      className={`border-b px-4 py-2.5 no-print ${offline ? 'border-caution/40 bg-caution-wash' : 'border-line bg-card-sunk'}`}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2.5 text-[12.5px]">
        {offline ? (
          <CloudOff className="h-4 w-4 shrink-0 text-caution" aria-hidden />
        ) : (
          <UploadCloud className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
        )}

        <p className="min-w-0 flex-1 text-ink-soft">
          {offline && pending === 0 && 'No signal. Anything you submit now is saved on this phone and sent later.'}
          {offline && pending > 0 && `No signal. ${pending} ${pending === 1 ? 'record is' : 'records are'} waiting on this phone.`}
          {!offline && pending > 0 && `${pending} ${pending === 1 ? 'record is' : 'records are'} still to send.`}
        </p>

        {!offline && pending > 0 && (
          <button
            type="button"
            onClick={() => void drain()}
            disabled={draining}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-tile border-2 border-line-strong bg-paper px-2.5 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${draining ? 'animate-spin' : ''}`} aria-hidden />
            {draining ? 'Sending' : 'Send now'}
          </button>
        )}
      </div>
    </div>
  );
}
