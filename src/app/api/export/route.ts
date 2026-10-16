import { NextResponse } from 'next/server';

import { buildWorkbookBuffer, readAll, sameLocalDay } from '@/lib/store';

/**
 * Download the workbook.
 *
 * Default is the whole record set — the same accumulating file the office keeps.
 * `?scope=today` is a filtered slice for pasting into the day's sheet, and it is
 * named as a slice in the filename so the two can never be confused on disk.
 *
 * This endpoint never creates a new permanent file. Nothing is written; the
 * workbook on disk already holds every row, and this is a view of it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') === 'today' ? 'today' : 'all';
  const kind = url.searchParams.get('kind');

  let records = await readAll();
  if (scope === 'today') records = records.filter((r) => sameLocalDay(r.recordedAt));
  if (kind) {
    const kinds = kind.split(',');
    records = records.filter((r) => kinds.includes(r.kind));
  }

  const buffer = await buildWorkbookBuffer(records);

  const stamp = new Date().toISOString().slice(0, 10);
  const parts = ['gatehouse-records'];
  if (scope === 'today') parts.push('today');
  if (kind) parts.push(kind.replace(/,/g, '-'));
  parts.push(stamp);
  const filename = `${parts.join('_')}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Record-Count': String(records.length),
    },
  });
}

export const dynamic = 'force-dynamic';
