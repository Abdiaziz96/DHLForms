'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker.
 *
 * Without this the service worker file exists and does nothing. It is registered
 * here rather than in the layout's inline script so it can be skipped cleanly in
 * development, where a cached shell fights with hot reload and produces confusing
 * stale pages.
 *
 * Registration is deliberately silent. There is no update prompt and no "app
 * ready" toast: the only thing the worker is for is surviving a dead spot in the
 * yard, and that is not something a driver needs to be told about.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // A failed registration must never break the app. Offline resilience is
        // a bonus on top of a working form, not a precondition for one.
      });
    };

    // Registering during the initial load competes with the first paint for
    // bandwidth on a poor connection, which is exactly the connection this
    // feature exists to help with.
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
