import type { StaffRole, VisitorPurpose } from './types';

export type ContactContext = 'general' | StaffRole | VisitorPurpose;

export interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  /** Optional internal extension, shown alongside the number. */
  ext?: string;
  /** Contexts this contact appears in. `general` shows everywhere. */
  contexts: ContactContext[];
  /** Emergency contacts render in the persistent red strip, never in the drawer. */
  emergency?: boolean;
}

/**
 * PLACEHOLDER CONTACTS.
 *
 * Names, numbers and extensions here are invented for the prototype. Nothing in
 * this file should survive contact with a real site — every entry needs replacing
 * with the current site contact list before this is shown to a driver. The only
 * numbers that are real are 999 and the site name.
 */
export const CONTACTS: Contact[] = [
  // ── Always visible, never filtered ────────────────────────────────────────
  { id: 'em-999', name: 'Emergency services', role: 'Fire, ambulance, police', phone: '999', contexts: ['general'], emergency: true },
  { id: 'em-firstaid', name: 'Site first aider', role: 'First aid, injury', phone: '0117 000 0000', ext: '2101', contexts: ['general'], emergency: true },
  { id: 'em-marshal', name: 'Fire marshal', role: 'Evacuation, fire', phone: '0117 000 0000', ext: '2102', contexts: ['general'], emergency: true },
  { id: 'em-incident', name: 'Incident line', role: 'Accidents, near misses, damage', phone: '0117 000 0000', ext: '2103', contexts: ['general'], emergency: true },

  // ── Gatehouse — the one contact every arrival needs ───────────────────────
  {
    id: 'gatehouse',
    name: 'Gatehouse',
    role: 'Access, keys, paperwork',
    phone: '0117 000 0000',
    ext: '2220',
    contexts: ['driver', 'admin', 'delivering', 'collecting'],
  },

  // ── Driver ────────────────────────────────────────────────────────────────
  { id: 'd-transport', name: 'Transport office', role: 'Route changes, delays, load queries', phone: '0117 000 0000', ext: '2200', contexts: ['driver', 'admin'] },
  { id: 'd-shunter', name: 'Yard shunter', role: 'Bay moves, trailer swaps', phone: '0117 000 0000', ext: '2210', contexts: ['driver', 'warehouse'] },
  { id: 'd-yard', name: 'Yard supervisor', role: 'Parking, banks, obstructions', phone: '0117 000 0000', ext: '2230', contexts: ['driver', 'warehouse'] },

  // ── Warehouse ─────────────────────────────────────────────────────────────
  { id: 'w-shift', name: 'Warehouse shift manager', role: 'Resourcing, priorities', phone: '0117 000 0000', ext: '2300', contexts: ['warehouse', 'admin'] },
  { id: 'w-flt', name: 'FLT supervisor', role: 'Truck faults, licence checks', phone: '0117 000 0000', ext: '2310', contexts: ['warehouse'] },
  { id: 'w-hs', name: 'Health & safety rep', role: 'Risk, near misses, PPE', phone: '0117 000 0000', ext: '2320', contexts: ['warehouse', 'admin', 'driver'] },

  // ── Admin ─────────────────────────────────────────────────────────────────
  { id: 'a-site', name: 'Site manager', role: 'Escalations, site decisions', phone: '0117 000 0000', ext: '2000', contexts: ['admin'] },
  { id: 'a-hr', name: 'HR', role: 'Driver records, disputes', phone: '0117 000 0000', ext: '2400', contexts: ['admin'] },
  { id: 'a-it', name: 'IT service desk', role: 'Access, devices, this app', phone: '0117 000 0000', ext: '2410', contexts: ['admin'] },

  // ── Visitor: delivering ───────────────────────────────────────────────────
  { id: 'v-goodsin', name: 'Goods-in', role: 'Deliveries, unloading, PODs', phone: '0117 000 0000', ext: '2500', contexts: ['delivering'] },
  { id: 'v-receiving', name: 'Receiving supervisor', role: 'Rejected or damaged loads', phone: '0117 000 0000', ext: '2510', contexts: ['delivering'] },

  // ── Visitor: collecting ───────────────────────────────────────────────────
  { id: 'v-despatch', name: 'Despatch', role: 'Collections, paperwork', phone: '0117 000 0000', ext: '2600', contexts: ['collecting'] },
  { id: 'v-loading', name: 'Loading supervisor', role: 'Load ready, restraints', phone: '0117 000 0000', ext: '2610', contexts: ['collecting'] },
];

/** Contextual contacts for a screen. Emergency contacts are always excluded. */
export function contactsFor(context: ContactContext): Contact[] {
  // "general" is the untriaged context (the landing page, a shared link). Showing
  // everything is more useful than showing nothing, and the search box is right there.
  if (context === 'general') return CONTACTS.filter((c) => !c.emergency);
  return CONTACTS.filter((c) => !c.emergency && c.contexts.includes(context));
}

/** The always-on red strip. Identical on every screen, never filtered. */
export function emergencyContacts(): Contact[] {
  return CONTACTS.filter((c) => c.emergency);
}

export const CONTEXT_LABEL: Record<ContactContext, string> = {
  general: 'Everyone',
  driver: 'Drivers',
  warehouse: 'Warehouse',
  admin: 'Office',
  delivering: 'Delivering here',
  collecting: 'Collecting here',
};

/** Route from a URL pathname to the contact context that screen should show. */
export function contextFromPath(pathname: string): ContactContext {
  if (pathname.startsWith('/visitor/collecting') || pathname.includes('collecting')) return 'collecting';
  if (pathname.startsWith('/visitor/delivering') || pathname.includes('delivering')) return 'delivering';
  if (pathname.startsWith('/staff/driver')) return 'driver';
  if (pathname.startsWith('/staff/warehouse')) return 'warehouse';
  if (pathname.startsWith('/staff/admin')) return 'admin';
  return 'general';
}
