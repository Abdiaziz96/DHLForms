/**
 * Route and bridge data.
 *
 * PLACEHOLDER DATA. The bridge names, road references and clearances below are
 * invented for the prototype and must be replaced with the site's actual
 * planned-route data (and verified against the current Network Rail and local
 * authority bridge lists) before anything in here is shown to a driver as fact.
 * A wrong clearance figure is worse than no figure at all.
 */
export interface RouteDef {
  ref: string;
  name: string;
  /** Lowest structure on the planned route that a high vehicle could reach. */
  restrictionMetres: number | null;
  restrictionName: string | null;
  notes: string;
}

export const ROUTES: RouteDef[] = [
  {
    ref: 'R1',
    name: 'Severn Beach — Avonmouth loop',
    restrictionMetres: null,
    restrictionName: null,
    notes: 'Motorway and A-road only. No low structures on the planned line.',
  },
  {
    ref: 'R2',
    name: 'Severn Beach — Pilning & Easter Compton',
    restrictionMetres: 4.4,
    restrictionName: 'Pilning station bridge',
    notes: 'Railway bridge on the lane into Pilning. Signed 4.4m.',
  },
  {
    ref: 'R3',
    name: 'Severn Beach — Hallen & Lawrence Weston',
    restrictionMetres: 4.9,
    restrictionName: 'Hallen lane aqueduct',
    notes: 'Clearance is adequate for standard trailers but not for high-cube.',
  },
  {
    ref: 'R4',
    name: 'Severn Beach — Aust & Olveston',
    restrictionMetres: 4.2,
    restrictionName: 'Olveston village bridge',
    notes: 'Village centre, signed 4.2m, no turning space once committed.',
  },
  {
    ref: 'R5',
    name: 'Severn Beach — Avonmouth docks shuttle',
    restrictionMetres: 5.1,
    restrictionName: 'Dock estate gantry',
    notes: 'Dock gantry at 5.1m. Clear for all current fleet heights.',
  },
];

export function routeByRef(ref: string): RouteDef | undefined {
  return ROUTES.find((r) => r.ref === ref);
}
