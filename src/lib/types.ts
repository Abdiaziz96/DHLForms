/**
 * Domain types for Gatehouse.
 *
 * The workbook is the interface: every field below maps to exactly one column in
 * `site-records.xlsx`, in the order defined by `COLUMNS`. If you add a field here,
 * add it there too, or the export will silently drift from the UI.
 */

export type Audience = 'staff' | 'visitor';

export type StaffRole = 'driver' | 'warehouse' | 'admin';

export type VisitorPurpose = 'delivering' | 'collecting';

export type Direction = 'in' | 'out';

/** Which flow produced this record. Drives the admin filter chips. */
export type RecordKind = 'debrief' | 'brief' | 'visitor' | 'warehouse';

/** Employment basis. Agency is a first-class risk input, not a label. */
export type DriverBasis = 'employed' | 'agency' | 'subcontractor';

/** ISO-8601 local timestamp of the departure, e.g. 2026-10-01T14:22 */
export type LocalDateTime = string;

export interface Signature {
  /** Freehand strokes as SVG path data. Small, diffable, resolution independent. */
  paths: string[];
  /** Display name the signer typed or selected. */
  name: string;
  /** ISO timestamp captured when the signature was accepted. */
  signedAt: string;
}

export interface VehicleRecord {
  /** UK registration, normalised to upper case with no spaces. */
  reg: string;
  /** Trailer number, as stencilled on the trailer. */
  trailer: string;
  /** Customer or contract the load belongs to. */
  contract: string;
  /** Running height in metres, as declared by the driver. */
  runningHeight: number;
  /** Whether the driver has acknowledged the low-bridge route risk. */
  heightAcknowledged: boolean;
}

export interface DriverRecord {
  /** Payroll, licence or agency reference. The only field that cannot be prefilled. */
  driverRef: string;
  name: string;
  basis: DriverBasis;
  /** How many times this driver has run this route in the last 90 days. */
  routeTrips90d: number;
  /** Bridge strikes or near misses already on record. */
  priorIncidents: number;
}

export interface RiskAssessment {
  score: number;
  band: 'green' | 'amber' | 'red';
  /** Human-readable reasons, in the order they contributed. */
  reasons: string[];
  /** Populated only when the route carries a height restriction the vehicle exceeds. */
  bridgeWarning: BridgeWarning | null;
}

export interface BridgeWarning {
  bridgeName: string;
  restrictionMetres: number;
  vehicleMetres: number;
}

export interface SiteRecord {
  id: string;
  kind: RecordKind;

  // Identity
  operatorName: string;
  operatorRef: string;
  operatorBasis: DriverBasis;
  company: string;
  visitorPurpose: VisitorPurpose | null;

  // Vehicle
  reg: string;
  trailer: string;
  contract: string;
  runningHeight: number;

  // Movement
  direction: Direction;
  recordedAt: LocalDateTime;
  /** Signed difference between the planned departure and the actual one. */
  delayMinutes: number;
  /** The run card this movement belongs to, e.g. R-0141. Empty for ad-hoc moves. */
  runRef: string;
  routeRef: string;
  routeHasHeightRestriction: boolean;

  // Safety
  defectFlagged: boolean;
  defectNote: string;
  heightAcknowledged: boolean;

  // Sign-off
  operatorSignature: Signature | null;
  securityName: string;
  securitySignedAt: LocalDateTime | null;

  // Derived
  riskScore: number;
  riskBand: RiskAssessment['band'];
  /** True when the route carries a restriction the vehicle's height exceeds. */
  bridgeWarning: string;

  // Housekeeping
  siteName: string;
  submittedAt: LocalDateTime;
  /** Free text for anything the operator needs the office to know. */
  note: string;
}

/**
 * The single source of truth for the workbook shape.
 * `key` must be a key of SiteRecord. Order here is the column order in the XLSX.
 */
export const COLUMNS: { key: keyof SiteRecord; header: string; width: number }[] = [
  { key: 'id', header: 'Record ID', width: 14 },
  { key: 'kind', header: 'Type', width: 12 },
  { key: 'recordedAt', header: 'Date', width: 12 },
  { key: 'recordedAt', header: 'Time', width: 8 },
  { key: 'operatorName', header: 'Operator', width: 20 },
  { key: 'operatorRef', header: 'Operator Ref', width: 14 },
  { key: 'operatorBasis', header: 'Basis', width: 14 },
  { key: 'company', header: 'Company', width: 22 },
  { key: 'visitorPurpose', header: 'Purpose', width: 12 },
  { key: 'reg', header: 'Vehicle Reg', width: 13 },
  { key: 'trailer', header: 'Trailer No', width: 12 },
  { key: 'contract', header: 'Contract', width: 18 },
  { key: 'runningHeight', header: 'Height (m)', width: 11 },
  { key: 'direction', header: 'Direction', width: 10 },
  { key: 'runRef', header: 'Run', width: 10 },
  { key: 'routeRef', header: 'Route', width: 12 },
  { key: 'routeHasHeightRestriction', header: 'Route Restricted', width: 15 },
  { key: 'delayMinutes', header: 'Delay (min)', width: 12 },
  { key: 'defectFlagged', header: 'Defect', width: 9 },
  { key: 'defectNote', header: 'Defect Note', width: 32 },
  { key: 'heightAcknowledged', header: 'Height Ack', width: 11 },
  { key: 'riskScore', header: 'Risk Score', width: 11 },
  { key: 'riskBand', header: 'Risk Band', width: 10 },
  { key: 'bridgeWarning', header: 'Bridge Warning', width: 34 },
  { key: 'securityName', header: 'Security', width: 16 },
  { key: 'securitySignedAt', header: 'Security Sign', width: 18 },
  { key: 'note', header: 'Notes', width: 40 },
  { key: 'submittedAt', header: 'Submitted At', width: 18 },
];
