import { Map as MapIcon, ShieldAlert, SquarePen } from 'lucide-react';

import { KeyContacts } from '@/components/KeyContacts';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { Stagger, StaggerItem } from '@/components/Stagger';
import { Tile } from '@/components/Tile';

export const metadata = { title: 'Delivering to site' };

/**
 * The delivering landing screen.
 *
 * A visitor who taps "delivering" has one question left: what do I do next. The
 * three steps are in the order the gatehouse wants them taken — sign in, read the
 * notice, find your way in — and the purpose travels in the query string from
 * here on, so no later screen has to ask the same question twice.
 *
 * Key contacts live in the header rather than as a fourth tile: a tile implies a
 * screen of its own, and the contacts are a sheet that opens over this one.
 */
export default function DeliveringPage() {
  return (
    <>
      <ScreenHeader
        title="Delivering to site"
        subtitle="Goods-in will meet you at the delivery entrance, past the gatehouse."
        backHref="/visitor"
        backLabel="Visitor"
        right={<KeyContacts context="delivering" />}
      />
      <Screen>
        <Stagger>
          <StaggerItem>
            <div className="grid gap-3">
              <Tile
                href="/visitor/signin?purpose=delivering"
                variant="primary"
                title="Sign in"
                description="Your name, your company, your registration and a signature. About a minute."
                icon={<SquarePen className="h-5 w-5 text-card" />}
              />
              <Tile
                href="/safety?purpose=delivering&from=delivering"
                title="Safety notice"
                description="The site rules, the height warning and what to do if something goes wrong."
                icon={<ShieldAlert className="h-5 w-5 text-ink" />}
              />
              <Tile
                href="/map?from=delivering"
                title="Site map"
                description="The delivery entrance, the bays, the walkway and where to wait."
                icon={<MapIcon className="h-5 w-5 text-ink" />}
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-7 text-[13px] leading-relaxed text-ink-muted">
              Goods-in will want your delivery note, so have it to hand. Sign in before you go to the delivery
              entrance — the gatehouse sees your details as soon as you submit them, so there is nothing to carry to
              the desk.
            </p>
          </StaggerItem>
        </Stagger>
      </Screen>
    </>
  );
}
