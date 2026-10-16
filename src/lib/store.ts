import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ExcelJS from 'exceljs';

import { COLUMNS, type Signature, type SiteRecord } from './types';

/**
 * The workbook store.
 *
 * One file. Rows are appended; the file is never regenerated. That is a hard
 * requirement from the office — a fresh export per click is how a spreadsheet
 * ends up as `forms_final_v3(2).xlsx` and nobody trusts the numbers.
 *
 * This is the *interim* store. It exists so the app runs with no database. The
 * exported surface below (readAll / append / getById) is deliberately the same
 * shape a Postgres implementation would expose, so swapping it later is a
 * one-file change rather than a rewrite. See `docs/ROADMAP.md`.
 *
 * Concurrency: writes are serialised through a single promise chain. Two drivers
 * submitting at the same moment would otherwise both read the file, both append
 * one row, and one row would be lost.
 */

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
const WORKBOOK = process.env.WORKBOOK ?? 'site-records.xlsx';

export function workbookPath(): string {
  return path.join(DATA_DIR, WORKBOOK);
}

/** Serialises every write. Reads never wait on it. */
let writeChain: Promise<unknown> = Promise.resolve();

/** Hydrated once per process; keeps reads cheap and survives a read-only disk. */
let cache: SiteRecord[] | null = null;

/** Set true the first time a write fails, so the UI can say so honestly. */
let degraded = false;
export function isDegraded(): boolean {
  return degraded;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? '');
}

function datePart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function timePart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function columnValue(record: SiteRecord, header: string): string | number | boolean {
  switch (header) {
    case 'Date':
      return datePart(record.recordedAt);
    case 'Time':
      return timePart(record.recordedAt);
    case 'Security Sign':
      return record.securitySignedAt ? timePart(record.securitySignedAt) : '';
    case 'Basis':
      return record.operatorBasis;
    case 'Purpose':
      // A null purpose must read as an empty cell. `String(null)` would put the
      // literal text "null" in the workbook, which then breaks every pivot.
      return record.visitorPurpose ?? '';
    case 'Direction':
      return record.direction === 'in' ? 'In' : 'Out';
    default: {
      const key = COLUMNS.find((c) => c.header === header)?.key;
      if (!key) return '';
      const raw = record[key];
      if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
      if (raw === null || raw === undefined) return '';
      return String(raw);
    }
  }
}

function applyHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.addRow(COLUMNS.map((c) => c.header));
  header.font = { bold: true, color: { argb: 'FF0B0F14' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC53D' } };
  header.height = 22;
  COLUMNS.forEach((c, i) => {
    sheet.getColumn(i + 1).width = c.width;
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function rowFromRecord(record: SiteRecord): (string | number | boolean)[] {
  return COLUMNS.map((c) => columnValue(record, c.header));
}

/** Map a worksheet row back to a record. Tolerant: missing cells become defaults. */
function recordFromRow(row: ExcelJS.Row, signatures: Map<string, Signature>): SiteRecord {
  const raw: Record<string, string> = {};
  COLUMNS.forEach((c, i) => {
    if (raw[c.header] !== undefined) return;
    const cell = row.getCell(i + 1).value;
    const text = cell instanceof Date ? cell.toISOString() : String(cell ?? '').trim();
    raw[c.header] = text;
  });

  const asBool = (v: string) => v.toLowerCase() === 'yes' || v === 'true';
  const asNum = (v: string, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    id: raw['Record ID'] ?? '',
    kind: (raw['Type'] as SiteRecord['kind']) ?? 'debrief',
    operatorName: raw['Operator'] ?? '',
    operatorRef: raw['Operator Ref'] ?? '',
    operatorBasis: (raw['Basis'] as SiteRecord['operatorBasis']) ?? 'employed',
    company: raw['Company'] ?? '',
    visitorPurpose: (raw['Purpose'] as SiteRecord['visitorPurpose']) || null,
    reg: raw['Vehicle Reg'] ?? '',
    trailer: raw['Trailer No'] ?? '',
    contract: raw['Contract'] ?? '',
    runningHeight: asNum(raw['Height (m)']),
    direction: raw['Direction'] === 'In' ? 'in' : 'out',
    recordedAt: `${raw['Date'] ?? ''}T${raw['Time'] ?? '00:00'}`,
    delayMinutes: asNum(raw['Delay (min)']),
    runRef: raw['Run'] ?? '',
    routeRef: raw['Route'] ?? '',
    routeHasHeightRestriction: asBool(raw['Route Restricted'] ?? ''),
    defectFlagged: asBool(raw['Defect'] ?? '') || (raw['Defect Note'] ?? '').length > 0,
    defectNote: raw['Defect Note'] ?? '',
    heightAcknowledged: asBool(raw['Height Ack'] ?? ''),
    operatorSignature: signatures.get(raw['Record ID'] ?? '') ?? null,
    securityName: raw['Security'] ?? '',
    securitySignedAt: raw['Security Sign'] ? `${raw['Date'] ?? ''}T${raw['Security Sign']}` : null,
    riskScore: asNum(raw['Risk Score']),
    riskBand: (raw['Risk Band'] as SiteRecord['riskBand']) ?? 'green',
    bridgeWarning: raw['Bridge Warning'] ?? '',
    siteName: '',
    submittedAt: raw['Submitted At'] ?? '',
    note: raw['Notes'] ?? '',
  };
}

/**
 * Where the signature strokes live.
 *
 * The signature is the evidence that a record is the driver's own, so it has to
 * be stored rather than just displayed. A few thousand characters of SVG path
 * data per row would make the main table unreadable for the people who open this
 * every day, so the main sheet stays a clean table and the strokes go on their
 * own sheet, joined by Record ID. Power BI ignores this sheet entirely.
 */
export const SIGNATURE_SHEET = 'Signatures';

function applySignatureSheet(wb: ExcelJS.Workbook, records: SiteRecord[]): void {
  const sheet = wb.addWorksheet(SIGNATURE_SHEET);
  const header = sheet.addRow(['Record ID', 'Signed By', 'Signed At', 'Strokes', 'Signature (SVG path data)']);
  header.font = { bold: true, color: { argb: 'FF0B0F14' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC53D' } };
  sheet.getColumn(1).width = 20;
  sheet.getColumn(2).width = 22;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 9;
  sheet.getColumn(5).width = 90;

  for (const r of records) {
    const sig = r.operatorSignature;
    if (!sig || sig.paths.length === 0) continue;
    sheet.addRow([r.id, sig.name, sig.signedAt, sig.paths.length, sig.paths.join(' ')]);
  }
}

function readSignatureSheet(wb: ExcelJS.Workbook): Map<string, Signature> {
  const out = new Map<string, Signature>();
  const sheet = wb.getWorksheet(SIGNATURE_SHEET);
  if (!sheet) return out;

  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const id = String(row.getCell(1).value ?? '').trim();
    const data = String(row.getCell(5).value ?? '').trim();
    if (!id || !data) return;
    out.set(id, {
      // Every stroke starts with M and contains no other M, so this splits
      // strokes without needing a delimiter that Excel might mangle.
      paths: data.split(/\s+(?=M)/),
      name: String(row.getCell(2).value ?? '').trim(),
      signedAt: toIso(row.getCell(3).value),
    });
  });

  return out;
}

async function loadFromDisk(): Promise<SiteRecord[]> {
  if (cache) return cache;

  const file = workbookPath();
  try {
    await fs.access(file);
  } catch {
    cache = [];
    return cache;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = wb.getWorksheet('Records') ?? wb.worksheets[0];
  if (!sheet) {
    cache = [];
    return cache;
  }

  const signatures = readSignatureSheet(wb);
  const out: SiteRecord[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const rec = recordFromRow(row, signatures);
    if (rec.id) out.push(rec);
  });
  cache = out;
  return out;
}

async function persist(records: SiteRecord[]): Promise<void> {
  const file = workbookPath();
  const wb = new ExcelJS.Workbook();
  wb.creator = process.env.NEXT_PUBLIC_APP_NAME ?? 'Gatehouse';
  const sheet = wb.addWorksheet('Records', { views: [{ state: 'frozen', ySplit: 1 }] });
  applyHeader(sheet);
  for (const r of records) sheet.addRow(rowFromRecord(r));
  applySignatureSheet(wb, records);

  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = path.join(DATA_DIR, `.${WORKBOOK}.tmp`);
  await wb.xlsx.writeFile(tmp);
  // Rename is atomic on the same volume, so a crash mid-write cannot truncate
  // the real workbook.
  await fs.rename(tmp, file);
}

/** Every record, newest first. */
export async function readAll(): Promise<SiteRecord[]> {
  const all = await loadFromDisk();
  return [...all].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
}

export async function getById(id: string): Promise<SiteRecord | undefined> {
  const all = await loadFromDisk();
  return all.find((r) => r.id === id);
}

/** Append one or many. Never rewrites existing rows. */
export async function append(records: SiteRecord | SiteRecord[]): Promise<void> {
  const list = Array.isArray(records) ? records : [records];
  if (list.length === 0) return;

  const run = writeChain.then(async () => {
    const all = await loadFromDisk();
    all.push(...list);
    cache = all;
    try {
      await persist(all);
    } catch (err) {
      // A read-only filesystem (serverless) must not lose the submission — the
      // row stays in memory so the operator still sees a confirmation and the
      // current session keeps working. The dashboard says so plainly.
      degraded = true;
      console.error('[gatehouse] workbook write failed, serving from memory:', err);
    }
  });

  writeChain = run.catch(() => undefined);
  return run;
}

/** True when the workbook has no rows at all. Used to decide on seeding. */
export async function isEmpty(): Promise<boolean> {
  const all = await loadFromDisk();
  return all.length === 0;
}

/**
 * Build a workbook in memory, using the same column order and header styling as
 * the file on disk. The export endpoint uses this so the office always receives
 * exactly the file they would have opened by hand — same columns, same order,
 * same date/time split. An export that differs from the stored record is a
 * dispute waiting to happen.
 */
export async function buildWorkbookBuffer(records: SiteRecord[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = process.env.NEXT_PUBLIC_APP_NAME ?? 'Gatehouse';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Records', { views: [{ state: 'frozen', ySplit: 1 }] });
  applyHeader(sheet);
  for (const r of records) sheet.addRow(rowFromRecord(r));
  applySignatureSheet(wb, records);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/** Wipe the in-process cache. Only used by the seed script. */
export function resetCache() {
  cache = null;
}

export function describeStorage(): { dir: string; file: string; host: string; degraded: boolean } {
  return { dir: DATA_DIR, file: WORKBOOK, host: os.hostname(), degraded };
}

/** Fields that carry a Date/Time pair for the "today" filters. */
export function sameLocalDay(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate()
  );
}
