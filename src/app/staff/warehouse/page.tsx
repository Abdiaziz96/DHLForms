import { ClipboardList, Map as MapIcon, ShieldAlert } from 'lucide-react';

import { KeyContacts } from '@/components/KeyContacts';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { Stagger, StaggerItem } from '@/components/Stagger';
import { Tile } from '@/components/Tile';

export const metadata = { title: 'Warehouse' };

export default function WarehousePage() {
  return (
    <>
      <ScreenHeader
        title="Warehouse"
        subtitle="Shift handover, the yard, and who to ring when something is in the way."
        backHref="/staff"
        backLabel="Staff"
        right={<KeyContacts context="warehouse" />}
      />
      <Screen>
        <Stagger>
          <StaggerItem>
            <div className="grid gap-3">
              <Tile
                href="/staff/warehouse/handover"
                variant="primary"
                title="Shift handover"
                description="One or two lines about what changed, so the next shift does not start blind."
                icon={<ClipboardList className="h-5 w-5 text-card" />}
              />
              <Tile
                href="/safety?from=warehouse"
                title="Safety notice"
                description="Site rules, vehicle movements and the height warning."
                icon={<ShieldAlert className="h-5 w-5 text-ink" />}
              />
              <Tile
                href="/map?from=warehouse"
                title="Yard and bays"
                description="Banks, bays, the trailer park and the pedestrian routes."
                icon={<MapIcon className="h-5 w-5 text-ink" />}
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-7 text-[13px] leading-relaxed text-ink-muted">
              Trailer movements are recorded by drivers at the debrief. If a bank or a bay is out of use, put it in the
              handover note so the transport office sees it on the same screen as the movements.
            </p>
          </StaggerItem>
        </Stagger>
      </Screen>
    </>
  );
}
