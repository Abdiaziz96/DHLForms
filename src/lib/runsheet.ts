/**
 * The runsheet.
 *
 * PLACEHOLDER DATA — the plan is made up. In production this is generated the
 * night before and is *subject to change*, which is the whole reason the operator
 * confirms rather than the office dictating. Never treat a runsheet row as truth:
 * it is a starting point the driver corrects in the app.
 *
 * Allocation is not fixed either. Drivers collect whatever keys are on the board,
 * so the vehicle against a run is provisional until the driver confirms it.
 */
export interface RunCard {
  /** Short reference printed on the run card and encoded in its QR. */
  ref: string;
  plannedDeparture: string;
  routeRef: string;
  contract: string;
  /** Provisional allocation. The driver confirms or overrides this. */
  plannedReg: string;
  plannedTrailer: string;
  plannedHeight: number;
  stops: number;
  notes: string;
}

const REGS = ['YX24 KDJ', 'WR23 FHP', 'BV71 NTA', 'LR25 OEC', 'PK22 WUD', 'SN20 GVR'];

function reg(i: number) {
  return REGS[i % REGS.length];
}

/** Today's planned runs, as they would come off the office at close of play. */
export const RUNSHEET: RunCard[] = [
  { ref: 'R-0141', plannedDeparture: '04:30', routeRef: 'R1', contract: 'Northgate Retail', plannedReg: reg(0), plannedTrailer: 'TRL-4471', plannedHeight: 4.2, stops: 6, notes: 'Two drops before 08:00. Backdoor access only.' },
  { ref: 'R-0142', plannedDeparture: '05:15', routeRef: 'R2', contract: 'Bristol Fine Foods', plannedReg: reg(1), plannedTrailer: 'TRL-3318', plannedHeight: 4.4, stops: 4, notes: 'Chilled. Keep doors closed at each stop.' },
  { ref: 'R-0143', plannedDeparture: '06:00', routeRef: 'R4', contract: 'Cotswold Home', plannedReg: reg(2), plannedTrailer: 'TRL-5590', plannedHeight: 4.6, stops: 9, notes: 'Village centre deliveries. Watch the height.' },
  { ref: 'R-0144', plannedDeparture: '06:45', routeRef: 'R5', contract: 'Internal Trunk', plannedReg: reg(3), plannedTrailer: 'TRL-1120', plannedHeight: 4.0, stops: 1, notes: 'Dock shuttle. Swap trailer and return.' },
  { ref: 'R-0145', plannedDeparture: '07:30', routeRef: 'R3', contract: 'Severnside Chemicals', plannedReg: reg(4), plannedTrailer: 'TRL-6642', plannedHeight: 4.75, stops: 3, notes: 'ADR. Documentation must match the load.' },
  { ref: 'R-0146', plannedDeparture: '08:00', routeRef: 'R2', contract: 'Wessex Drinks', plannedReg: reg(5), plannedTrailer: 'TRL-2205', plannedHeight: 4.4, stops: 7, notes: 'Kegs. Restraints checked before leaving each stop.' },
  { ref: 'R-0147', plannedDeparture: '09:30', routeRef: 'R1', contract: 'Network Parts', plannedReg: reg(3), plannedTrailer: 'TRL-7734', plannedHeight: 4.2, stops: 12, notes: 'Multi-drop. Long day — fatigue check on return.' },
  { ref: 'R-0148', plannedDeparture: '11:00', routeRef: 'R4', contract: 'Deepline Bulk', plannedReg: reg(1), plannedTrailer: 'TRL-8811', plannedHeight: 4.6, stops: 2, notes: 'Tipping. Site induction required at first stop.' },
];

export function runByRef(ref: string): RunCard | undefined {
  return RUNSHEET.find((r) => r.ref === ref);
}

/** Minutes between a planned departure (HH:MM) and an actual ISO timestamp. */
export function delayAgainst(planned: string, actualIso: string): number {
  const [h, m] = planned.split(':').map(Number);
  const d = new Date(actualIso);
  const plannedMinutes = h * 60 + m;
  const actualMinutes = d.getHours() * 60 + d.getMinutes();
  return Math.max(0, actualMinutes - plannedMinutes);
}
