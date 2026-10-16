import { ClipboardCheck, KeyRound, Map as MapIcon, ShieldAlert } from 'lucide-react';

import { KeyContacts } from '@/components/KeyContacts';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { Stagger, StaggerItem } from '@/components/Stagger';
import { Tile } from '@/components/Tile';

export const metadata = { title: 'Driver' };

export default function DriverPage() {
  return (
    <>
      <ScreenHeader
        title="Driver"
        subtitle="Going out, coming back, or checking something before you set off."
        backHref="/staff"
        backLabel="Staff"
        right={<KeyContacts context="driver" />}
      />
      <Screen>
        <Stagger>
          <StaggerItem>
            <div className="grid gap-3">
              <Tile
                href="/staff/driver/debrief"
                variant="primary"
                title="Debrief — going out"
                description="Keys, trailer, route and your height check. This is the one that replaces the sheet at the desk."
                icon={<KeyRound className="h-5 w-5 text-card" />}
                meta={
                  <span className="rounded-full bg-white/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-card">
                    30 sec
                  </span>
                }
              />
              <Tile
                href="/staff/driver/brief"
                title="Brief in — coming back"
                description="Hand the vehicle back, return the keys, flag anything that went wrong."
                icon={<ClipboardCheck className="h-5 w-5 text-ink" />}
              />
              <Tile
                href="/safety?from=driver"
                title="Safety notice"
                description="The site rules, the height warning, and what to do if something goes wrong."
                icon={<ShieldAlert className="h-5 w-5 text-ink" />}
              />
              <Tile
                href="/map?from=driver"
                title="Site map"
                description="Bays, banks, fuel, and where to walk."
                icon={<MapIcon className="h-5 w-5 text-ink" />}
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-7 text-[13px] leading-relaxed text-ink-muted">
              Nothing here needs a login and nothing needs installing. Your name and driver number are remembered on
              this phone once you have entered them, so the next debrief is quicker still.
            </p>
          </StaggerItem>
        </Stagger>
      </Screen>
    </>
  );
}
