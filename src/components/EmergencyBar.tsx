'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Phone, Siren } from 'lucide-react';
import { useState } from 'react';

import { emergencyContacts } from '@/lib/contacts';

/**
 * The emergency bar.
 *
 * This is the one piece of chrome on every single screen, including the landing
 * page, and it is deliberately not filtered by context. Contextual contacts are
 * useful; an emergency contact you have to navigate to is not.
 *
 * It sits above everything in the tab order so it is the first thing reachable
 * with a keyboard and the first thing a thumb can hit.
 */
export function EmergencyBar() {
  const [open, setOpen] = useState(false);
  const contacts = emergencyContacts();
  const firstAider = contacts.find((c) => c.id === 'em-firstaid');

  return (
    <div className="sticky top-0 z-40 no-print">
      <div className="bg-stop text-white">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="emergency-list"
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#a82c26] active:bg-[#95261f]"
        >
          <Siren className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-display text-[13px] font-bold uppercase tracking-wider">Emergency</span>
          <span className="h-4 w-px bg-white/30" aria-hidden />
          {firstAider && (
            <span className="truncate text-[13px] text-white/90">
              First aider{' '}
              <span className="tabular font-mono font-medium">{firstAider.phone}</span>
            </span>
          )}
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.ul
              id="emergency-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="overflow-hidden bg-[#8f231d]"
            >
              {contacts.map((c) => (
                <li key={c.id} className="border-t border-white/15">
                  <a
                    href={`tel:${c.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 px-3 py-3 text-white active:bg-[#7a1d18]"
                  >
                    <Phone className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.name}</span>
                      <span className="block truncate text-xs text-white/75">{c.role}</span>
                    </span>
                    <span className="tabular font-mono text-sm font-medium">
                      {c.phone}
                      {c.ext ? ` · ${c.ext}` : ''}
                    </span>
                  </a>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
