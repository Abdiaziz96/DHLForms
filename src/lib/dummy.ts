import { assessRisk } from './risk';
import { ROUTES } from './routes';
import { RUNSHEET } from './runsheet';
import { CONTRACTS, SITE_NAME } from './site';
import type { DriverBasis, RecordKind, SiteRecord, VisitorPurpose } from './types';

/**
 * Sample data generator.
 *
 * Everything produced here is invented. It exists so the Power BI layer can be
 * built and argued over before a single real name, registration or visitor
 * enters the workbook. Nothing generated here should ever be mixed with live
 * records — the admin export marks the sample window so the two cannot be
 * confused.
 *
 * Deterministic: same seed, same output. That matters because a dashboard that
 * changes shape every time you regenerate it is impossible to review.
 */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Alan', 'Marcus', 'Priya', 'Dean', 'Sofia', 'Karl', 'Nadia', 'Rhys', 'Tomas', 'Grace', 'Ibrahim', 'Ewan', 'Leanne', 'Victor', 'Omar', 'Bethan', 'Callum', 'Yusuf', 'Dawn', 'Piotr'];
const LAST = ['Whitcombe', 'Okafor', 'Trelawney', 'Bhatt', 'Nowak', 'Ferreira', 'Ashdown', 'Kowalski', 'Mensah', 'Ridley', 'Novak', 'Hargreaves', 'Duarte', 'Ellery', 'Sandhu', 'Probert', 'Ivanov', 'Chandra', 'Merrick', 'Boateng'];

const REG_PREFIX = ['YX', 'WR', 'BV', 'LR', 'PK', 'SN', 'MF', 'GK'];
const REG_LETTERS = ['KDJ', 'FHP', 'NTA', 'OEC', 'WUD', 'GVR', 'HZL', 'BPX', 'TMR', 'CJE'];
const BASIS: DriverBasis[] = ['employed', 'employed', 'employed', 'agency', 'agency', 'subcontractor'];

function pad(n: number, len = 2) {
  return String(n).padStart(len, '0');
}

function isoLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface DummyOptions {
  seed?: number;
  /** How many days back to generate. */
  days?: number;
  /** Roughly how many records per day. */
  perDay?: number;
}

export function generateSampleRecords(opts: DummyOptions = {}): SiteRecord[] {
  const seed = opts.seed ?? 20261001;
  const days = opts.days ?? 14;
  const perDay = opts.perDay ?? 22;

  const rand = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

  // A stable pool of drivers so per-driver patterns emerge, which is the whole
  // point of the exercise — you cannot see "this agency driver keeps getting
  // flagged" if every record has a different name.
  const driverPool = Array.from({ length: 24 }, (_, i) => {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    return {
      ref: `D-${pad(1000 + i, 4)}`,
      name,
      basis: BASIS[i % BASIS.length],
      priorIncidents: rand() < 0.11 ? (rand() < 0.25 ? 2 : 1) : 0,
    };
  });

  const records: SiteRecord[] = [];
  const now = new Date();

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const count = Math.round(perDay * (isWeekend ? 0.35 : 1) * between(0.85, 1.15));

    for (let i = 0; i < count; i++) {
      const driver = pick(driverPool);
      const route = pick(ROUTES);
      const contract = pick(CONTRACTS);

      const hour = Math.floor(between(4, 20));
      const minute = Math.floor(between(0, 59));
      const recorded = new Date(day);
      recorded.setHours(hour, minute, 0, 0);

      const height = pick([3.6, 3.8, 4.0, 4.2, 4.2, 4.4, 4.4, 4.6, 4.75]);
      const routeTrips90d = driver.basis === 'employed' ? Math.floor(between(4, 40)) : Math.floor(between(0, 6));
      const delayMinutes = Math.max(0, Math.round(between(-20, 55)));
      const defectFlagged = rand() < 0.08;

      const risk = assessRisk({
        basis: driver.basis,
        routeTrips90d,
        runningHeight: height,
        routeHasHeightRestriction: route.restrictionMetres !== null,
        routeRestrictionMetres: route.restrictionMetres,
        routeRestrictionName: route.restrictionName,
        heightAcknowledged: rand() > 0.12,
        priorIncidents: driver.priorIncidents,
        delayMinutes,
      });

      const bridgeWarning =
        route.restrictionMetres !== null && height > route.restrictionMetres && route.restrictionName
          ? `${route.restrictionName} — signed ${route.restrictionMetres.toFixed(1)}m, vehicle ${height.toFixed(2)}m`
          : '';

      records.push({
        id: `GH-${pad(dayOffset, 2)}${pad(i, 3)}-${pad(Math.floor(rand() * 999), 3)}`,
        kind: 'debrief',
        operatorName: driver.name,
        operatorRef: driver.ref,
        operatorBasis: driver.basis,
        company: contract,
        visitorPurpose: null,
        reg: `${pick(REG_PREFIX)}${Math.floor(between(20, 26))} ${pick(REG_LETTERS)}`,
        trailer: `TRL-${Math.floor(between(1000, 9999))}`,
        contract,
        runningHeight: height,
        direction: rand() < 0.5 ? 'out' : 'in',
        recordedAt: isoLocal(recorded),
        delayMinutes,
        runRef: pick(RUNSHEET).ref,
        routeRef: route.ref,
        routeHasHeightRestriction: route.restrictionMetres !== null,
        defectFlagged,
        defectNote: defectFlagged ? pick(['Nearside marker lamp out', 'Curtain tensioner torn', 'Offside mirror cracked', 'Trailer ABS warning']) : '',
        heightAcknowledged: rand() > 0.12,
        operatorSignature: { paths: [], name: driver.name, signedAt: isoLocal(recorded) },
        securityName: pick(['J. Ferris', 'M. Osei', 'T. Blake', 'A. Nunes']),
        securitySignedAt: isoLocal(recorded),
        riskScore: risk.score,
        riskBand: risk.band,
        bridgeWarning,
        siteName: SITE_NAME,
        submittedAt: isoLocal(recorded),
        note: '',
      });
    }
  }

  // A handful of visitor and warehouse records so the admin filters are not empty.
  const visitorNames = ['H. Lindqvist', 'R. Anwar', 'C. Boateng', 'S. Delgado', 'N. Petrov'];
  const purposes: VisitorPurpose[] = ['delivering', 'collecting'];
  for (let i = 0; i < 40; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - Math.floor(between(0, days - 1)));
    day.setHours(Math.floor(between(7, 17)), Math.floor(between(0, 59)), 0, 0);
    const purpose = pick(purposes);
    const kind: RecordKind = 'visitor';
    records.push({
      id: `GH-V${pad(i, 4)}`,
      kind,
      operatorName: pick(visitorNames),
      operatorRef: `V-${pad(500 + i, 4)}`,
      operatorBasis: 'subcontractor',
      company: pick(CONTRACTS),
      visitorPurpose: purpose,
      reg: `${pick(REG_PREFIX)}${Math.floor(between(20, 26))} ${pick(REG_LETTERS)}`,
      trailer: '',
      contract: pick(CONTRACTS),
      runningHeight: pick([3.8, 4.0, 4.2]),
      direction: purpose === 'delivering' ? 'in' : 'out',
      recordedAt: isoLocal(day),
      delayMinutes: 0,
      runRef: '',
      routeRef: '',
      routeHasHeightRestriction: false,
      defectFlagged: false,
      defectNote: '',
      heightAcknowledged: true,
      operatorSignature: { paths: [], name: '', signedAt: isoLocal(day) },
      securityName: pick(['J. Ferris', 'M. Osei']),
      securitySignedAt: isoLocal(day),
      riskScore: 0,
      riskBand: 'green',
      bridgeWarning: '',
      siteName: SITE_NAME,
      submittedAt: isoLocal(day),
      note: purpose === 'delivering' ? 'Palletised delivery' : 'Collection against order',
    });
  }

  return records.sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1));
}
