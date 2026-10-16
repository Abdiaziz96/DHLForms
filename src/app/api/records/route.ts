import { NextResponse } from 'next/server';

import { coerceRecord, badRequest } from '@/lib/api';
import { assessRisk } from '@/lib/risk';
import { routeByRef } from '@/lib/routes';
import { SITE_NAME } from '@/lib/site';
import { append, isDegraded, readAll, sameLocalDay } from '@/lib/store';
import type { SiteRecord } from '@/lib/types';

/**
 * The records endpoint.
 *
 * POST is open: drivers, warehouse and visitors submit here with no account. The
 * identity that matters is on the record, not in a session, because a login screen
 * is the single biggest source of drop-off for a driver standing in a yard.
 *
 * The server — not the client — computes the risk assessment. A score that the
 * submitting device could set would be worthless as a safety signal.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? 'all';
  const kind = url.searchParams.get('kind');

  let records = await readAll();
  if (scope === 'today') records = records.filter((r) => sameLocalDay(r.recordedAt));

  if (kind) {
    const kinds = kind.split(',');
    records = records.filter((r) => kinds.includes(r.kind));
  }

  return NextResponse.json({
    ok: true,
    count: records.length,
    degraded: isDegraded(),
    records,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Send a JSON body.');
  }

  const record = coerceRecord(body);
  if (!record) return badRequest('A record needs at least a name and a vehicle registration.');

  // Recompute risk server-side, from the fields as submitted.
  const route = routeByRef(record.routeRef);
  const routeHasHeightRestriction = route?.restrictionMetres != null;
  const assessed = assessRisk({
    basis: record.operatorBasis,
    routeTrips90d: Number((body as { routeTrips90d?: number }).routeTrips90d ?? 0),
    runningHeight: record.runningHeight,
    routeHasHeightRestriction,
    routeRestrictionMetres: route?.restrictionMetres ?? null,
    routeRestrictionName: route?.restrictionName ?? null,
    heightAcknowledged: record.heightAcknowledged,
    priorIncidents: Number((body as { priorIncidents?: number }).priorIncidents ?? 0),
    delayMinutes: record.delayMinutes,
  });

  const bridgeWarning = assessed.bridgeWarning
    ? `${assessed.bridgeWarning.bridgeName} — signed ${assessed.bridgeWarning.restrictionMetres.toFixed(
        1,
      )}m, vehicle ${assessed.bridgeWarning.vehicleMetres.toFixed(2)}m`
    : '';

  const finalised: SiteRecord = {
    ...record,
    siteName: record.siteName || SITE_NAME,
    routeHasHeightRestriction,
    riskScore: assessed.score,
    riskBand: assessed.band,
    bridgeWarning,
  };

  await append(finalised);

  return NextResponse.json(
    {
      ok: true,
      id: finalised.id,
      risk: assessed,
      bridgeWarning,
      // Told plainly so the UI can be honest about it rather than showing a
      // success that will not survive a restart.
      persisted: !isDegraded(),
    },
    { status: 201 },
  );
}

export const dynamic = 'force-dynamic';
