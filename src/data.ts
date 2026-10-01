import { FormConfig } from './types';

export const DEFAULT_FORMS: FormConfig[] = [
  {
    id: 'main-sheet',
    title: 'Driver Run Sheet (Main)',
    url: 'https://api.leadconnectorhq.com/widget/form/kvhJhNuUMTuY6wB5TLU1?notrack=true',
    category: 'main',
    isDefault: true,
  },
  {
    id: 'pre-start-inspection',
    title: 'Vehicle Pre-Start Inspection Checklist',
    url: 'https://api.leadconnectorhq.com/widget/form/9qEob0nLIJpklT9bbWpd', // Customizable GHL form link
    category: 'secondary',
    isDefault: true,
  },
  {
    id: 'incident-damage-report',
    title: 'Incident & Damage Report',
    url: 'https://api.leadconnectorhq.com/widget/form/9qEob0nLIJpklT9bbWpd', // Customizable GHL form link
    category: 'secondary',
    isDefault: true,
  },
  {
    id: 'fuel-purchase-log',
    title: 'Fuel Purchase & Mileage Log',
    url: 'https://api.leadconnectorhq.com/widget/form/9qEob0nLIJpklT9bbWpd', // Customizable GHL form link
    category: 'secondary',
    isDefault: true,
  },
  {
    id: 'fatigue-safety-assessment',
    title: 'Driver Fatigue & Safety Assessment',
    url: 'https://api.leadconnectorhq.com/widget/form/9qEob0nLIJpklT9bbWpd', // Customizable GHL form link
    category: 'secondary',
    isDefault: true,
  },
  {
    id: 'end-shift-summary',
    title: 'End of Shift Summary',
    url: 'https://api.leadconnectorhq.com/widget/form/9qEob0nLIJpklT9bbWpd', // Customizable GHL form link
    category: 'finish',
    isDefault: true,
  }
];

