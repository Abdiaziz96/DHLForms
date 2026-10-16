import { Map as MapIcon, ShieldAlert, SquarePen } from 'lucide-react';

import { KeyContacts } from '@/components/KeyContacts';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { Stagger, StaggerItem } from '@/components/Stagger';
import { Tile } from '@/components/Tile';

export const metadata = { title: 'Collecting from site' };

/**
 * The collecting landing screen.
 *
 * Mirrors the delivering screen deliberately. A visitor who collected last month
 * and is delivering this month should not have to learn a second layout, so the
 * tiles sit in the same order and only the meeting point and the purpose change.
 */
export default function CollectingPage() {
  return (
    <>
      <ScreenHeader
        title="Collecting from site"
        subtitle="Despatch will meet you at the desk by the loading bays, past the gatehouse."
        backHref="/visitor"
        backLabel="Visitor"
        right={<KeyContacts context="collecting" />}
      />
      <Screen>
        <Stagger>
          <StaggerItem>
            <div className="grid gap-3">
              <Tile
                href="/visitor/signin?purpose=collecting"
                variant="primary"
                title="Sign in"
                description="Your name, your company, your registration and a signature. About a minute."
                icon={<SquarePen className="h-5 w-5 text-card" />}
              />
              <Tile
                href="/safety?purpose=collecting&from=collecting"
                title="Safety notice"
                description="The site rules, the height warning and what to do if something goes wrong."
                icon={<ShieldAlert className="h-5 w-5 text-ink" />}
              />
              <Tile
                href="/map?from=collecting"
                title="Site map"
                description="Despatch, the loading bays, the walkway and where to wait."
                icon={<MapIcon className="h-5 w-5 text-ink" />}
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-7 text-[13px] leading-relaxed text-ink-muted">
              Despatch will want your collection reference, so have it ready. Sign in before you reach the loading
              bays — the gatehouse sees your details as soon as you submit them, so there is nothing to take to the
              desk.
            </p>
          </StaggerItem>
        </Stagger>
      </Screen>
    </>
  );
}
