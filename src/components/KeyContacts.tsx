'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Phone, Search, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { CONTEXT_LABEL, contactsFor, type ContactContext } from '@/lib/contacts';

/**
 * Key contacts.
 *
 * Filtered by where the person actually is: a driver sees the yard, a goods-in
 * visitor sees goods-in. The filter is not a nicety — a contacts list where the
 * relevant number is buried under eleven irrelevant ones gets abandoned, and the
 * person rings the number they already had, which is how the office ends up
 * answering the same question for the tenth time.
 */
export function KeyContacts({ context }: { context: ContactContext }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const contacts = useMemo(() => contactsFor(context), [context]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [contacts, query]);

  // Escape closes. A sheet you cannot dismiss with a keyboard is a trap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-tile border-2 border-line-strong bg-card px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink active:bg-card-sunk"
      >
        <Users className="h-4 w-4" aria-hidden />
        Key contacts
        <span className="rounded-full bg-card-sunk px-1.5 py-0.5 font-mono text-[11px] tabular text-ink-muted">
          {contacts.length}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <button
              type="button"
              aria-label="Close key contacts"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Key contacts"
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="relative z-10 flex max-h-[86dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[20px] border-2 border-ink/10 bg-paper shadow-lift sm:rounded-card"
            >
              <header className="flex items-start justify-between gap-3 border-b border-line bg-card px-5 pb-4 pt-5">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight text-ink">Key contacts</h2>
                  <p className="mt-0.5 text-[13px] text-ink-muted">
                    Showing {CONTEXT_LABEL[context].toLowerCase()}. Emergency numbers are always in the red bar above.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-tile border-2 border-line-strong bg-paper p-2 text-ink-soft transition-colors hover:border-ink active:bg-card-sunk"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </header>

              <div className="border-b border-line bg-card px-5 py-3">
                <label className="relative block">
                  <span className="sr-only">Search contacts</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, job or number"
                    className="field pl-9"
                  />
                </label>
              </div>

              <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`tel:${c.phone.replace(/\s/g, '')}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-card active:bg-card-sunk"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink">{c.name}</span>
                        <span className="block truncate text-[13px] text-ink-muted">{c.role}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono text-sm tabular font-medium text-ink">{c.phone}</span>
                        {c.ext && <span className="block font-mono text-[11px] tabular text-ink-faint">ext {c.ext}</span>}
                      </span>
                      <Phone className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                    </a>
                  </li>
                ))}

                {filtered.length === 0 && (
                  <li className="px-5 py-10 text-center">
                    <p className="text-sm font-semibold text-ink">No contact matches “{query}”</p>
                    <p className="mx-auto mt-1 max-w-xs text-[13px] text-ink-muted">
                      Try a job title instead, or use the emergency bar at the top of the screen — it is never filtered.
                    </p>
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="mt-4 rounded-tile border-2 border-line-strong bg-card px-4 py-2 text-sm font-semibold text-ink"
                    >
                      Clear search
                    </button>
                  </li>
                )}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
