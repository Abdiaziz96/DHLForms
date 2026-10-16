import Link from 'next/link';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';

import { Band } from '@/components/Band';
import { CopyRowButton } from '@/components/AdminActions';
import { Plate } from '@/components/Plate';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { COLUMNS, type SiteRecord } from '@/lib/types';
import { columnValue, readAll } from '@/lib/store';
import { dayOf, timeOf } from '@/lib/time';

export const metadata = { title: 'Records' };
export const dynamic = 'force-dynamic';

function tsvFor(record: SiteRecord): string {
  return COLUMNS.map((c) => String(columnValue(record, c.header))).join('\t');
}

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'debrief', label: 'Debriefs' },
  { id: 'brief', label: 'Briefs in' },
  { id: 'visitor', label: 'Visitors' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'defect', label: 'Defects' },
] as const;

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter = 'all' } = await searchParams;
  const all = await readAll();

  const records = all.filter((r) => {
    switch (filter) {
      case 'flagged':
        return r.riskBand !== 'green';
      case 'defect':
        return r.defectFlagged;
      case 'all':
        return true;
      default:
        return r.kind === filter;
    }
  });

  return (
    <>
      <ScreenHeader
        title="Records"
        subtitle={`${records.length} of ${all.length} records. Copy a row straight into your sheet, or take the whole workbook.`}
        backHref="/staff/admin"
        backLabel="Front desk"
      />
      <Screen>
        <div className="strip mb-4">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={`/staff/admin/records?filter=${f.id}`}
              aria-current={filter === f.id ? 'true' : undefined}
              className={`shrink-0 rounded-full border-2 px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                filter === f.id
                  ? 'border-ink bg-ink text-card'
                  : 'border-line-strong bg-card text-ink hover:border-ink'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <a
          href={`/api/export${filter === 'all' ? '' : `?kind=${filter}`}`}
          className="mb-4 inline-flex items-center gap-2 rounded-tile border-2 border-ink bg-ink px-4 py-2.5 text-[14px] font-bold text-card transition-colors hover:bg-ink-soft"
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Download this view as a workbook
        </a>

        {records.length === 0 ? (
          <div className="rounded-card border-2 border-dashed border-line-strong bg-card p-6 text-center">
            <p className="font-display text-[15px] font-bold text-ink">Nothing matches this filter</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-muted">
              Either there is nothing of this type in the workbook yet, or the filter is narrower than you meant.
            </p>
            <Link href="/staff/admin/records" className="mt-4 inline-flex items-center gap-1.5 rounded-tile border-2 border-line-strong bg-paper px-4 py-2 text-[13px] font-semibold text-ink">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Show everything
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border-2 border-line-strong bg-card">
            {records.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                <span className="w-[62px] shrink-0">
                  <span className="block font-mono text-[13px] tabular font-semibold text-ink">{timeOf(r.recordedAt)}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-faint">{dayOf(r.recordedAt)}</span>
                </span>

                {r.reg ? (
                  <Plate reg={r.reg} size="sm" />
                ) : (
                  <span className="w-[86px] shrink-0 text-[11px] text-ink-faint">no vehicle</span>
                )}

                <span className="min-w-[140px] flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{r.operatorName}</span>
                  <span className="block truncate font-mono text-[11px] text-ink-muted">
                    {r.kind} · {r.direction}
                    {r.runRef ? ` · ${r.runRef}` : ''}
                    {r.routeRef ? ` · ${r.routeRef}` : ''}
                    {r.contract ? ` · ${r.contract}` : ''}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  {r.defectFlagged && (
                    <span className="rounded-full border border-stop/40 bg-stop-wash px-2 py-0.5 text-[11px] font-semibold text-stop">
                      Defect
                    </span>
                  )}
                  <Band band={r.riskBand} />
                  <CopyRowButton tsv={tsvFor(r)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Screen>
    </>
  );
}
