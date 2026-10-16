import { ShiftNoteForm } from '@/components/ShiftNoteForm';
import { KeyContacts } from '@/components/KeyContacts';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';

export const metadata = { title: 'Shift handover' };

export default function WarehouseHandoverPage() {
  return (
    <>
      <ScreenHeader
        title="Shift handover"
        subtitle="Short and specific. This is not a report, it is the thing the next shift needs to know."
        backHref="/staff/warehouse"
        backLabel="Warehouse"
        right={<KeyContacts context="warehouse" />}
      />
      <Screen>
        <ShiftNoteForm />
      </Screen>
    </>
  );
}
