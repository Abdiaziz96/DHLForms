import type { RiskAssessment, BridgeWarning } from './types';

/**
 * Bridge strike risk.
 *
 * This is deliberately a transparent additive score, not a model. Every point is
 * traceable to a field the operator filled in, so a transport manager can argue
 * with it — and can see exactly why a departure was flagged.
 *
 * It is a *risk flag*, not a prediction. Do not describe it as predicting strikes.
 * Until incidents are recorded in the same workbook there is nothing to validate
 * the weights against; treat them as a starting hypothesis to be tuned.
 *
 * Weights live in one place so they can be adjusted without touching the UI.
 */
export const RISK_WEIGHTS = {
  /** Agency and subcontracted drivers are the dominant factor in bridge strikes. */
  agencyDriver: 2,
  subcontractor: 1,
  /** Unfamiliarity: fewer than three previous runs of this route in 90 days. */
  unfamiliarRoute: 3,
  /** Tall vehicles reduce the margin for error at every restriction. */
  tallVehicle: 2,
  veryTallVehicle: 3,
  /** The route itself passes under a restriction. */
  routeRestricted: 2,
  /** Route restriction is lower than the vehicle's declared height. */
  heightExceedsBridge: 6,
  /** Prior bridge strike or near miss on record. */
  priorIncident: 2,
  /** Departing late correlates with route deviation around traffic. */
  delayed: 1,
  /** Height not acknowledged when the route carries a restriction. */
  unacknowledgedHeight: 2,
} as const;

/** Bands. Tuned so that a familiar employed driver in a standard vehicle stays green. */
export const RISK_BANDS = { amber: 3, red: 7 } as const;

export interface RiskInput {
  basis: 'employed' | 'agency' | 'subcontractor';
  routeTrips90d: number;
  runningHeight: number;
  routeHasHeightRestriction: boolean;
  routeRestrictionMetres: number | null;
  /** Readable name of the restriction, so the warning can name the bridge. */
  routeRestrictionName?: string | null;
  heightAcknowledged: boolean;
  priorIncidents: number;
  delayMinutes: number;
}

export function assessRisk(input: RiskInput): RiskAssessment {
  const reasons: string[] = [];
  let score = 0;
  let bridgeWarning: BridgeWarning | null = null;

  if (input.basis === 'agency') {
    score += RISK_WEIGHTS.agencyDriver;
    reasons.push('Agency driver');
  } else if (input.basis === 'subcontractor') {
    score += RISK_WEIGHTS.subcontractor;
    reasons.push('Subcontracted driver');
  }

  if (input.routeTrips90d < 3) {
    score += RISK_WEIGHTS.unfamiliarRoute;
    reasons.push(input.routeTrips90d === 0 ? 'First time on this route' : 'Fewer than 3 runs of this route');
  }

  if (input.runningHeight >= 4.6) {
    score += RISK_WEIGHTS.veryTallVehicle;
    reasons.push(`Vehicle ${input.runningHeight.toFixed(2)}m — very tall`);
  } else if (input.runningHeight >= 4.4) {
    score += RISK_WEIGHTS.tallVehicle;
    reasons.push(`Vehicle ${input.runningHeight.toFixed(2)}m — tall`);
  }

  if (input.routeHasHeightRestriction) {
    score += RISK_WEIGHTS.routeRestricted;
    reasons.push('Route passes a height restriction');
  }

  // The one case that must always block. A declared height over the restriction
  // is not a risk score, it is a known collision on the planned route.
  if (
    input.routeHasHeightRestriction &&
    input.routeRestrictionMetres !== null &&
    input.runningHeight > input.routeRestrictionMetres
  ) {
    score += RISK_WEIGHTS.heightExceedsBridge;
    reasons.unshift('Vehicle is taller than a bridge on the planned route');
    bridgeWarning = {
      // Resolved here rather than stitched on by the caller. A caller that forgot
      // would produce a real height conflict with a blank bridge name, which is
      // the one message that must never be vague.
      bridgeName: input.routeRestrictionName ?? 'Unnamed restriction on the planned route',
      restrictionMetres: input.routeRestrictionMetres,
      vehicleMetres: input.runningHeight,
    };
  }

  if (input.priorIncidents > 0) {
    score += RISK_WEIGHTS.priorIncident;
    reasons.push(
      input.priorIncidents === 1 ? '1 prior bridge incident' : `${input.priorIncidents} prior bridge incidents`,
    );
  }

  if (input.delayMinutes > 30) {
    score += RISK_WEIGHTS.delayed;
    reasons.push(`Departing ${input.delayMinutes} min late`);
  }

  if (input.routeHasHeightRestriction && !input.heightAcknowledged) {
    score += RISK_WEIGHTS.unacknowledgedHeight;
    reasons.push('Height not yet acknowledged');
  }

  const band: RiskAssessment['band'] = score >= RISK_BANDS.red ? 'red' : score >= RISK_BANDS.amber ? 'amber' : 'green';

  return { score, band, reasons, bridgeWarning };
}

/** Human label for a band. Used by every surface so the wording stays identical. */
export const BAND_LABEL: Record<RiskAssessment['band'], string> = {
  green: 'Clear',
  amber: 'Check',
  red: 'Stop',
};

/** Plain-English guidance shown to the operator for each band. */
export const BAND_GUIDANCE: Record<RiskAssessment['band'], string> = {
  green: 'Nothing to acknowledge. Carry on to the vehicle.',
  amber: 'Confirm your running height before you move.',
  red: 'Do not move off. Tell the transport office first.',
};
