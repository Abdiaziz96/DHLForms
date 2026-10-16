/**
 * Site identity and shared constants.
 *
 * White-labelling lives here. Nothing in `components/` or `app/` should hard-code
 * a site name, an app name, or a customer brand. Set these via env at deploy time.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Gatehouse';
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'Severn Beach';

export const APP_TAGLINE = 'Site access and vehicle movements, recorded in thirty seconds.';

/** Contract names in circulation on site. Placeholder data. */
export const CONTRACTS = [
  'Northgate Retail',
  'Bristol Fine Foods',
  'Severnside Chemicals',
  'Cotswold Home',
  'Wessex Drinks',
  'Network Parts',
  'Deepline Bulk',
  'Internal Trunk',
];

/** Fleet heights in service, for the height picker. */
export const HEIGHT_OPTIONS = [3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.75, 4.9];

export const DEFECT_LABELS: { id: string; label: string }[] = [
  { id: 'none', label: 'Nothing to report' },
  { id: 'lights', label: 'Lights or indicators' },
  { id: 'tyres', label: 'Tyres or wheels' },
  { id: 'body', label: 'Bodywork or curtain' },
  { id: 'brakes', label: 'Brakes or air' },
  { id: 'load', label: 'Load security' },
  { id: 'other', label: 'Something else' },
];
