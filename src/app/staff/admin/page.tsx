import Link from 'next/link';
import { AlertTriangle, ArrowRight, ClipboardList, Download, FileSpreadsheet, Info, Truck } from 'lucide-react';

import { Band } from '@/components/Band';
import { CopyRowButton, SeedButton, SignOutButton } from '@/components/AdminActions';
import { Plate } from '@/components/Plate';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { RUNSHEET } from '@/lib/runsheet';
import { COLUMNS, type SiteRecord } from '@/lib/types';
import { columnValue, describeStorage, isDegraded, readAll, sameLocalDay } from '@/lib/store';
import { dayOf, timeOf } from '@/lib/time';

export const metadata = { title: 'Front desk' };
export const dynamic = 'force-dynamic';

/** One tab-separated row, built from the same column definition as the workbook. */
function tsvFor(record: SiteRecord): string {
  return COLUMNS.map((c) => String(columnValue(record, c.header))).join('\t');
}

function Stat({ label, value, hint, tone = 'plain' }: { label: string; value: string; hint?: string; tone?: 'plain' | 'stop' | 'caution' }) {
  const colour = tone === 'stop' ? 'text-stop' : tone === 'caution' ? 'text-caution' : 'text-ink';
  return (
    <div className="rounded-card border-2 border-line-strong bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`mt-1 font-display text-3xl font-extrabold tabular leading-none ${colour}`}>{value}</p>
      {hint && <p className="mt-1.5 text-[12px] leading-snug text-ink-muted">{hint}</p>}
    </div>
  );
}

export default async function AdminPage() {
  const all = await readAll();
  const today = all.filter((r) => sameLocalDay(r.recordedAt));
  const storage = describeStorage();

  const debriefs = today.filter((r) => r.kind === 'debrief');
  const flagged = today.filter((r) => r.riskBand !== 'green');
  const stops = today.filter((r) => r.riskBand === 'red');
  const visitors = today.filter((r) => r.kind === 'visitor');
  const defects = today.filter((r) => r.defectFlagged);

  const debriefedRuns = new Set(debriefs.map((r) => r.runRef).filter(Boolean));
  const outstanding = RUNSHEET.filter((r) => !debriefedRuns.has(r.ref));

  const recent = all.slice(0, 25);

  return (
    <>
      <ScreenHeader
        title="Front desk"
        subtitle={`${today.length} movements recorded today. Nothing here needs transcribing — it is already typed.`}
        backHref="/staff"
        backLabel="Staff"
        right={<SignOutButton />}
      />
      <Screen>
        {all.length === 0 ? (
          <div className="rounded-card border-2 border-dashed border-line-strong bg-card p-6 text-center">
            <FileSpreadsheet className="mx-auto h-7 w-7 text-ink-faint" aria-hidden />
            <h2 className="mt-3 font-display text-lg font-bold text-ink">The workbook is empty</h2>
            <p className="mx-auto mt-1 max-w-md text-[13px] leading-snug text-ink-muted">
              Fill it with sample data to build and review the Power BI layer. The data is invented — no real driver,
              vehicle or visitor details — and the generator refuses to run once real records exist, so the two can
              never end up in the same file.
            </p>
            <div className="mt-4 flex justify-center">
              <SeedButton />
            </div>
          </div>
        ) : (
          <div className="grid gap-7">
            {/* ── Today ─────────────────────────────────────────────────── */}
            <section>
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-ink-faint">Today</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Debriefs out" value={String(debriefs.filter((r) => r.direction === 'out').length)} hint="Drivers recorded leaving" />
                <Stat label="Briefs in" value={String(today.filter((r) => r.kind === 'brief').length)} hint="Vehicles handed back" />
                <Stat
                  label="Flagged"
                  value={String(flagged.length)}
                  tone={flagged.length > 0 ? 'caution' : 'plain'}
                  hint={stops.length > 0 ? `${stops.length} stopped before moving` : 'Amber and red departures'}
                />
                <Stat
                  label="Defects"
                  value={String(defects.length)}
                  tone={defects.length > 0 ? 'stop' : 'plain'}
                  hint="Raised against a vehicle"
                />
              </div>
            </section>

            {/* ── Outstanding ───────────────────────────────────────────── */}
            <section>
              <h2 className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-ink-faint">Not yet debriefed</h2>
              <p className="mb-3 text-[13px] text-ink-muted">
                Runs on the plan with no debrief recorded against them. This is the list that used to be worked out by
                asking around the yard at the end of the shift.
              </p>

              {outstanding.length === 0 ? (
                <p className="rounded-card border-2 border-clear/30 bg-clear-wash px-4 py-3 text-[13px] text-clear">
                  Every run on the plan has been debriefed.
                </p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-card border-2 border-line-strong bg-card">
                  {outstanding.map((run) => (
                    <li key={run.ref} className="flex items-center gap-3 px-3.5 py-3">
                      <span className="w-[52px] shrink-0 text-center">
                        <span className="block font-mono text-[14px] tabular font-semibold text-ink">{run.plannedDeparture}</span>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-faint">{run.routeRef}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{run.contract}</span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <Plate reg={run.plannedReg} size="sm" />
                          <span className="truncate font-mono text-[11px] text-ink-muted">{run.ref}</span>
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full border border-line bg-card-sunk px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                        {run.stops} stops
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Flagged today ─────────────────────────────────────────── */}
            {flagged.length > 0 && (
              <section>
                <h2 className="mb-1 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-ink-faint">
                  <AlertTriangle className="h-4 w-4 text-caution" aria-hidden />
                  Height and risk flags today
                </h2>
                <p className="mb-3 text-[13px] text-ink-muted">
                  Departures where the running height, the route, or the driver's familiarity raised a flag before the
                  vehicle moved.
                </p>
                <ul className="divide-y divide-line overflow-hidden rounded-card border-2 border-line-strong bg-card">
                  {flagged.slice(0, 12).map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-3.5 py-3">
                      <Plate reg={r.reg} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{r.operatorName}</span>
                        <span className="block truncate text-[12px] text-ink-muted">
                          {r.bridgeWarning || `${r.runningHeight.toFixed(2)}m · route ${r.routeRef} · ${r.contract}`}
                        </span>
                      </span>
                      <Band band={r.riskBand} score={r.riskScore} />
                    </li>
                  ))}
                </ul>
                {flagged.length > 12 && (
                  <Link href="/staff/admin/records?band=flagged" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
                    See all {flagged.length}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </section>
            )}

            {/* ── Export ────────────────────────────────────────────────── */}
            <section>
              <h2 className="mb-1 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-ink-faint">
                <Download className="h-4 w-4" aria-hidden />
                Get the data out
              </h2>
              <p className="mb-3 text-[13px] text-ink-muted">
                One workbook, appended to and never regenerated. Point Power BI at it once and it refreshes itself.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href="/api/export"
                  className="flex items-center gap-3 rounded-card border-2 border-ink bg-ink p-4 text-card transition-colors hover:bg-ink-soft"
                >
                  <FileSpreadsheet className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-display text-[15px] font-bold">Whole workbook</span>
                    <span className="block text-[12px] text-white/70">All {all.length} records</span>
                  </span>
                </a>
                <a
                  href="/api/export?scope=today"
                  className="flex items-center gap-3 rounded-card border-2 border-line-strong bg-card p-4 transition-colors hover:border-ink"
                >
                  <FileSpreadsheet className="h-5 w-5 shrink-0 text-ink" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-display text-[15px] font-bold text-ink">Today only</span>
                    <span className="block text-[12px] text-ink-muted">A slice for the day's sheet</span>
                  </span>
                </a>
              </div>
            </section>

            {/* ── Recent ────────────────────────────────────────────────── */}
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink-faint">Most recent</h2>
                <Link href="/staff/admin/records" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
                  All records
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-card border-2 border-line-strong bg-card">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3.5 py-3">
                    <span className="w-[62px] shrink-0">
                      <span className="block font-mono text-[13px] tabular font-semibold text-ink">{timeOf(r.recordedAt)}</span>
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-faint">{dayOf(r.recordedAt)}</span>
                    </span>
                    {r.reg ? <Plate reg={r.reg} size="sm" /> : <span className="w-[86px] shrink-0 text-[11px] text-ink-faint">no vehicle</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{r.operatorName}</span>
                      <span className="block truncate font-mono text-[11px] text-ink-muted">
                        {r.kind} · {r.direction === 'in' ? 'in' : 'out'}
                        {r.runRef ? ` · ${r.runRef}` : ''}
                        {r.trailer ? ` · ${r.trailer}` : ''}
                      </span>
                    </span>
                    <Band band={r.riskBand} />
                    <CopyRowButton tsv={tsvFor(r)} />
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Storage ───────────────────────────────────────────────── */}
            <section className="rounded-card border border-line bg-card-sunk p-4">
              <h2 className="flex items-center gap-2 font-display text-[13px] font-bold text-ink">
                <Info className="h-4 w-4 text-ink-muted" aria-hidden />
                Where this is stored
              </h2>
              <p className="mt-1.5 font-mono text-[12px] leading-relaxed break-all text-ink-muted">
                {storage.dir}\{storage.file}
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
                {isDegraded()
                  ? 'This server could not write to disk, so records are only held in memory and will be lost on restart. Set a writable DATA_DIR before relying on it.'
                  : `This screen and the workbook read the same records, so there is nothing to reconcile. ${visitors.length} visitor movements recorded today.`}
              </p>
            </section>
          </div>
        )}
      </Screen>
    </>
  );
}
