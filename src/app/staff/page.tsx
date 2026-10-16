import { ClipboardList, Truck, Warehouse } from 'lucide-react';

import { KeyContacts } from '@/components/KeyContacts';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { Stagger, StaggerItem } from '@/components/Stagger';
import { Tile } from '@/components/Tile';

export const metadata = { title: 'Staff' };

export default function StaffPage() {
  return (
    <>
      <ScreenHeader
        title="Staff"
        subtitle="Pick the job you're doing. Each one shows only the forms and contacts that job needs."
        backHref="/"
        backLabel="Start"
        right={<KeyContacts context="driver" />}
      />
      <Screen>
        <Stagger>
          <StaggerItem>
            <div className="grid gap-3">
              <Tile
                href="/staff/driver"
                variant="primary"
                title="Driver"
                description="Debrief out, brief in, pre-start checks and your own records."
                icon={<Truck className="h-5 w-5 text-card" />}
              />
              <Tile
                href="/staff/warehouse"
                title="Warehouse"
                description="Shift handover, FLT checks and the yard board."
                icon={<Warehouse className="h-5 w-5 text-ink" />}
              />
              <Tile
                href="/staff/admin"
                title="Front desk and office"
                description="Today's movements, who hasn't debriefed, and the export."
                icon={<ClipboardList className="h-5 w-5 text-ink" />}
              />
            </div>
          </StaggerItem>
        </Stagger>
      </Screen>
    </>
  );
}
