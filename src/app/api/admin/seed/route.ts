import { NextResponse } from 'next/server';

import { generateSampleRecords } from '@/lib/dummy';
import { append, readAll } from '@/lib/store';

/**
 * Load sample data into the workbook.
 *
 * Guarded by the same session as the rest of the office surfaces, and it refuses
 * to run when the workbook already holds rows. The refusal is the important part:
 * once real records exist, mixing invented names and registrations into the same
 * file would make the whole dataset unusable for anything, and there would be no
 * way afterwards to tell which rows were which.
 */
export async function POST(request: Request) {
  const existing = await readAll();
  if (existing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `The workbook already holds ${existing.length} records. Sample data will not be added to a workbook that has rows in it — empty the file first if you are sure.`,
      },
      { status: 409 },
    );
  }

  let days = 14;
  let perDay = 22;
  try {
    const body = (await request.json()) as { days?: number; perDay?: number };
    if (body.days) days = Math.min(90, Math.max(1, Number(body.days)));
    if (body.perDay) perDay = Math.min(200, Math.max(1, Number(body.perDay)));
  } catch {
    // No body is fine — the defaults are sensible.
  }

  const records = generateSampleRecords({ days, perDay });
  await append(records);

  return NextResponse.json({ ok: true, added: records.length, days, perDay }, { status: 201 });
}

export const dynamic = 'force-dynamic';
