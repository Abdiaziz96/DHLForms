/**
 * Time helpers safe to import from client components.
 *
 * Everything here produces *site-local* ISO strings (`YYYY-MM-DDTHH:MM`) with no
 * timezone suffix and no `Z`. That is deliberate. The workbook is read by people
 * standing on site, and a record showing 03:15 because the host is running UTC is
 * a support call waiting to happen.
 *
 * Never use `Date.prototype.toISOString()` for record timestamps — it converts to
 * UTC and will silently shift every night-time departure by an hour.
 */

function pad(n: number, len = 2) {
  return String(n).padStart(len, '0');
}

export function localNow(): string {
  return toLocal(new Date());
}

export function toLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayLocal(): string {
  return localNow().slice(0, 10);
}

/** `14:22` from a local ISO string. */
export function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

/** `01 Oct` from a local ISO string. */
export function dayOf(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${pad(d)} ${months[m - 1]}`;
}

export function isToday(iso: string): boolean {
  return iso.slice(0, 10) === todayLocal();
}

/** Minutes between a planned `HH:MM` and an actual local ISO timestamp. */
export function minutesLate(planned: string, actualLocal: string): number {
  const [ph, pm] = planned.split(':').map(Number);
  const [ah, am] = actualLocal.slice(11, 16).split(':').map(Number);
  if ([ph, pm, ah, am].some((n) => !Number.isFinite(n))) return 0;
  return Math.max(0, ah * 60 + am - (ph * 60 + pm));
}
