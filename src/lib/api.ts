import { NextResponse } from 'next/server';
import type { SiteRecord } from './types';

/**
 * Helpers shared by the record API routes.
 */

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function newId(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `GH-${stamp}-${rand}`;
}

/** ISO local time (no Z) so the workbook reads as site-local time, not UTC. */
export function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayLocalISO(): string {
  return localNow().slice(0, 10);
}

/** Minimal shape check. Deliberately permissive — the UI validates properly. */
export function coerceRecord(body: unknown): SiteRecord | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Partial<SiteRecord>;
  if (!b.operatorName || !b.reg) return null;

  return {
    id: b.id ?? newId(),
    kind: b.kind ?? 'debrief',
    operatorName: String(b.operatorName),
    operatorRef: String(b.operatorRef ?? ''),
    operatorBasis: b.operatorBasis ?? 'employed',
    company: String(b.company ?? ''),
    visitorPurpose: b.visitorPurpose ?? null,
    reg: String(b.reg).toUpperCase().replace(/\s+/g, ' ').trim(),
    trailer: String(b.trailer ?? ''),
    contract: String(b.contract ?? ''),
    runningHeight: Number(b.runningHeight ?? 0),
    direction: b.direction ?? 'out',
    recordedAt: b.recordedAt ?? localNow(),
    delayMinutes: Number(b.delayMinutes ?? 0),
    runRef: String(b.runRef ?? ''),
    routeRef: String(b.routeRef ?? ''),
    routeHasHeightRestriction: Boolean(b.routeHasHeightRestriction),
    defectFlagged: Boolean(b.defectFlagged),
    defectNote: String(b.defectNote ?? ''),
    heightAcknowledged: Boolean(b.heightAcknowledged),
    operatorSignature: b.operatorSignature ?? null,
    securityName: String(b.securityName ?? ''),
    securitySignedAt: b.securitySignedAt ?? null,
    riskScore: Number(b.riskScore ?? 0),
    riskBand: b.riskBand ?? 'green',
    bridgeWarning: String(b.bridgeWarning ?? ''),
    siteName: String(b.siteName ?? ''),
    submittedAt: localNow(),
    note: String(b.note ?? ''),
  };
}
