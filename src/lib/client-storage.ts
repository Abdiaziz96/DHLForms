'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Local persistence and the offline queue.
 *
 * Both exist for the same reason: a dead spot in the yard must not cost a
 * completed form. A driver at the far end of the site often has one bar of
 * signal, and the app has to behave as though it always works.
 *
 * The queue is deliberately simple. Submissions are held in localStorage and
 * drained when the app is open and the browser reports a connection. There is no
 * Background Sync — iOS Safari does not support it, so anything that promised to
 * send "in the background" on an iPhone would be a lie.
 */

const QUEUE_KEY = 'gatehouse.queue';
const DRIVER_KEY = 'gatehouse.driver';

export interface QueuedSubmission {
  id: string;
  body: Record<string, unknown>;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // A corrupt entry must not brick the app. Drop it and carry on.
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota. Nothing sensible to do but continue —
    // the caller keeps its in-memory copy and the submit still goes to the server.
  }
}

/** Remember who is driving, so the next shift pre-fills instead of re-asking. */
export function useRememberedDriver() {
  const [driver, setDriver] = useState<{ name: string; ref: string; basis: string } | null>(null);

  useEffect(() => {
    setDriver(read<{ name: string; ref: string; basis: string } | null>(DRIVER_KEY, null));
  }, []);

  const remember = useCallback((d: { name: string; ref: string; basis: string }) => {
    setDriver(d);
    write(DRIVER_KEY, d);
  }, []);

  const forget = useCallback(() => {
    setDriver(null);
    if (typeof window !== 'undefined') window.localStorage.removeItem(DRIVER_KEY);
  }, []);

  return { driver, remember, forget };
}

export function queuedCount(): number {
  return read<QueuedSubmission[]>(QUEUE_KEY, []).length;
}

function setQueue(items: QueuedSubmission[]) {
  write(QUEUE_KEY, items);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('gatehouse:queue'));
}

export function enqueue(body: Record<string, unknown>): QueuedSubmission {
  const item: QueuedSubmission = {
    id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    body,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  setQueue([...read<QueuedSubmission[]>(QUEUE_KEY, []), item]);
  return item;
}

/**
 * Tracks connectivity and drains the queue.
 *
 * Mounted once, at the shell level. Returns the counts the UI needs to be honest
 * with the operator about what has and has not reached the office.
 */
export function useSyncQueue() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [draining, setDraining] = useState(false);

  useEffect(() => {
    setPending(queuedCount());
    setOnline(navigator.onLine);

    const onQueue = () => setPending(queuedCount());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('gatehouse:queue', onQueue);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('gatehouse:queue', onQueue);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const drain = useCallback(async () => {
    const items = read<QueuedSubmission[]>(QUEUE_KEY, []);
    if (items.length === 0 || draining) return;

    setDraining(true);
    const remaining: QueuedSubmission[] = [];

    for (const item of items) {
      try {
        const res = await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.body),
        });
        // A rejection means the payload is wrong, not that the network failed.
        // Retrying it forever would block every good submission behind it.
        if (!res.ok && res.status >= 400 && res.status < 500) continue;
        if (!res.ok) remaining.push({ ...item, attempts: item.attempts + 1, lastError: `HTTP ${res.status}` });
      } catch {
        remaining.push({ ...item, attempts: item.attempts + 1, lastError: 'No connection' });
      }
    }

    setQueue(remaining);
    setPending(remaining.length);
    setDraining(false);
  }, [draining]);

  // Drain on mount and whenever the browser reports the connection coming back.
  useEffect(() => {
    if (online) void drain();
  }, [online, drain]);

  return { pending, online, draining, drain };
}
