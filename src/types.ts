export type FormCategory = 'main' | 'secondary' | 'finish';

export interface FormConfig {
  id: string;
  title: string;
  url: string;
  category: FormCategory;
  isDefault?: boolean;
}

export type ShiftStatus = 'idle' | 'started' | 'finishing' | 'completed';

export interface ShiftState {
  status: ShiftStatus;
  startTime: string | null;
  endTime: string | null;
  selectedSecondaryIds: string[]; // Track which secondary forms have been opened or active
  activeFormId: string | null; // Currently visible form ID
}
