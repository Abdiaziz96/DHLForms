import { PackageCheck, PackageOpen } from 'lucide-react';

import { KeyContacts } from '@/components/KeyContacts';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { Stagger, StaggerItem } from '@/components/Stagger';
import { Tile } from '@/components/Tile';

export const metadata = { title: "I'm visiting" };

export default function VisitorPage() {
  return (
    <>
      <ScreenHeader
        title="What are you here to do?"
        subtitle="Delivering and collecting use different doors, different paperwork and different people."
        backHref="/"
        backLabel="Start"
        right={<KeyContacts context="general" />}
      />
      <Screen>
        <Stagger>
          <StaggerItem>
            <div className="grid gap-3">
              <Tile
                href="/visitor/delivering"
                variant="primary"
                title="Delivering to site"
                description="Bringing goods in. Goods-in will meet you at the delivery entrance."
                icon={<PackageOpen className="h-5 w-5 text-card" />}
              />
              <Tile
                href="/visitor/collecting"
                title="Collecting from site"
                description="Taking goods away. Despatch handles the paperwork and the loading."
                icon={<PackageCheck className="h-5 w-5 text-ink" />}
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-7 text-[13px] leading-relaxed text-ink-muted">
              Either way you will be asked to read the site safety notice and sign in. It takes about a minute, and it
              is the same information the gatehouse used to take on paper.
            </p>
          </StaggerItem>
        </Stagger>
      </Screen>
    </>
  );
}
