import { DebriefForm } from '@/components/DebriefForm';
import { KeyContacts } from '@/components/KeyContacts';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';

export const metadata = { title: 'Debrief — going out' };

export default function DebriefPage() {
  return (
    <>
      <ScreenHeader
        title="Debrief"
        subtitle="Four steps. The office sees it the moment you finish, so there is nothing to carry to the desk."
        backHref="/staff/driver"
        backLabel="Driver"
        right={<KeyContacts context="driver" />}
      />
      <Screen>
        <DebriefForm />
      </Screen>
    </>
  );
}
