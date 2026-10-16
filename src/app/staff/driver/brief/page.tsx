import { BriefForm } from '@/components/BriefForm';
import { KeyContacts } from '@/components/KeyContacts';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';

export const metadata = { title: 'Brief in — coming back' };

export default function BriefPage() {
  return (
    <>
      <ScreenHeader
        title="Brief in"
        subtitle="Hand the vehicle back. Two steps, and the office stops chasing you for the keys and the paperwork."
        backHref="/staff/driver"
        backLabel="Driver"
        right={<KeyContacts context="driver" />}
      />
      <Screen>
        <BriefForm />
      </Screen>
    </>
  );
}
