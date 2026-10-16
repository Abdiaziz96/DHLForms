import { Map as MapIcon, SquarePen, TriangleAlert } from 'lucide-react';

import { KeyContacts } from '@/components/KeyContacts';
import { SafetyAcknowledge } from '@/components/SafetyAcknowledge';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { Stagger, StaggerItem } from '@/components/Stagger';
import { Tile } from '@/components/Tile';
import type { ContactContext } from '@/lib/contacts';
import { SITE_NAME } from '@/lib/site';
import type { VisitorPurpose } from '@/lib/types';

export const metadata = { title: 'Safety notice' };

/**
 * The site safety notice.
 *
 * Written for someone who has never been on this site, in the plainest terms the
 * rules allow. Each block is one rule, one heading and one short paragraph,
 * because this is read standing up in daylight — a paragraph that needs a second
 * pass is a paragraph that has failed.
 *
 * The purpose travels in from the delivering and collecting screens so the next
 * step and the contacts match where the person actually is. Anything missing, or
 * a link from the driver pages, falls back to the general contact list.
 */

type NoticeItem = { id: string; title: string; body: string; emphasis?: boolean };

const NOTICE: NoticeItem[] = [
  {
    id: 'vehicles',
    title: 'Trailers and vehicles move without warning. On foot, you have right of way',
    body: 'Shunters, forklifts and wagons move around this yard all day, and the drivers do not always see you. You have right of way as a pedestrian, but use it: catch the driver\u2019s eye before you step out, and never walk behind a trailer that is being moved or between a vehicle and a loading bay.',
  },
  {
    id: 'ppe',
    title: 'Hi-vis and safety footwear beyond the gatehouse',
    body: 'Wear a hi-vis vest and safety footwear from the gatehouse onwards, with full-length trousers and no open shoes. This applies to a two-minute walk to the office as much as it does to the yard.',
  },
  {
    id: 'speed',
    title: '5 mph anywhere on site',
    body: 'Five miles an hour is walking pace, and it applies to every vehicle on site including forklifts, shunters and your own. If you cannot stop within the distance you can see, you are going too fast for this yard.',
  },
  {
    id: 'phones',
    title: 'No phone use while walking',
    body: 'Stop walking, stand clear of every vehicle route, then use the phone. Someone reading a screen cannot see a reversing trailer.',
  },
  {
    id: 'reversing',
    title: 'Reversing and banksman rules',
    body: 'Vehicles reverse at the bays and on the banks. Watch for reversing lights, listen for the horn, and leave the space behind any vehicle empty. Only a trained banksman directs a reversing vehicle — if you are asked to help, stand clear instead.',
  },
  {
    id: 'load',
    title: 'You are responsible for your own load restraint',
    body: 'Check the straps, the curtains and the twist locks yourself before you move, and check them again after the first few miles. Nobody signs that off for you, and a load that shifts is a danger to everyone on the road behind you.',
  },
  {
    id: 'report',
    title: 'Report every accident and near miss, including the ones that hurt nobody',
    body: 'Tell the gatehouse before you leave. A near miss reported today is an accident that does not happen next month, and reporting one is not a complaint about anyone. Do not move a damaged vehicle or load before someone has looked at it.',
  },
  {
    id: 'height',
    title: 'Know your running height before you drive under anything',
    body: 'Know the running height of your vehicle and trailer before you move, and check it against every bridge, pipe bridge, canopy, weighbridge and bay sign on your route. A height you guessed is a height you do not know, and a strike happens in the time it takes to duck. If you are unsure, stop and ask the gatehouse.',
    emphasis: true,
  },
];

/** First value of a query parameter that may arrive repeated. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const CONTEXTS: ContactContext[] = ['delivering', 'collecting', 'driver', 'warehouse', 'admin'];

/** Only the contexts this app actually has; anything else is general. */
function contextFor(...values: (string | undefined)[]): ContactContext {
  for (const v of values) {
    if (v && (CONTEXTS as string[]).includes(v)) return v as ContactContext;
  }
  return 'general';
}

/** Where the back control goes: whoever sent you here knows the way back. */
function backTarget(purpose: VisitorPurpose | null, from: string | undefined): { href: string; label: string } {
  if (purpose === 'delivering') return { href: '/visitor/delivering', label: 'Delivering' };
  if (purpose === 'collecting') return { href: '/visitor/collecting', label: 'Collecting' };
  if (from === 'driver') return { href: '/staff/driver', label: 'Driver' };
  return { href: '/', label: 'Start' };
}

export default async function SafetyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const purpose = first(params.purpose);
  const from = first(params.from);
  const context = contextFor(purpose, from);

  const visitorPurpose = purpose === 'delivering' || purpose === 'collecting' ? purpose : null;
  const signInHref = visitorPurpose ? `/visitor/signin?purpose=${visitorPurpose}` : '/visitor';
  const back = backTarget(visitorPurpose, from);

  return (
    <>
      <ScreenHeader
        title="Safety notice"
        subtitle="Everyone on site follows this notice, on foot or in a vehicle, for as long as they are here."
        backHref={back.href}
        backLabel={back.label}
        right={<KeyContacts context={context} />}
      />
      <Screen>
        <Stagger>
          <StaggerItem>
            <section
              id="safety-notice"
              aria-labelledby="safety-notice-heading"
              className="overflow-hidden rounded-card border-2 border-line-strong bg-card"
            >
              <header className="border-b border-line px-4 py-3.5">
                <h2 id="safety-notice-heading" className="font-display text-lg font-bold tracking-tight text-ink">
                  {SITE_NAME} site rules
                </h2>
                <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">
                  Read it before you go past the gatehouse. The gatehouse can answer anything this notice does not —
                  their number is in Key contacts at the top of this screen.
                </p>
              </header>

              <ul className="divide-y divide-line">
                {NOTICE.map((item) => (
                  <li key={item.id} className={item.emphasis ? 'bg-caution-wash px-4 py-4' : 'px-4 py-4'}>
                    <h3
                      className={`flex items-start gap-2 font-display text-[15.5px] font-bold leading-snug tracking-tight ${
                        item.emphasis ? 'text-caution' : 'text-ink'
                      }`}
                    >
                      {item.emphasis && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                      {item.title}
                    </h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </StaggerItem>

          <StaggerItem className="mt-4">
            <SafetyAcknowledge />
          </StaggerItem>

          <StaggerItem className="mt-8">
            <h2 className="font-display text-lg font-bold tracking-tight text-ink">Next</h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              {visitorPurpose
                ? 'About a minute at the barrier, then you are in.'
                : 'Signing in is what gets you past the gatehouse.'}
            </p>

            <div className="mt-3 grid gap-3">
              <Tile
                href="/map"
                title="Site map"
                description={
                  visitorPurpose === 'delivering'
                    ? 'The delivery entrance, the bays, the walkway and where to wait.'
                    : visitorPurpose === 'collecting'
                      ? 'Despatch, the loading bays, the walkway and where to wait.'
                      : 'Where the bays, the banks and the walkway are, and where to go if the yard is full.'
                }
                icon={<MapIcon className="h-5 w-5 text-ink" />}
              />
              <Tile
                href={signInHref}
                variant="primary"
                title="Sign in"
                description={
                  visitorPurpose
                    ? 'Your name, company, registration and a signature.'
                    : 'Tell us whether you are delivering or collecting, then sign in.'
                }
                icon={<SquarePen className="h-5 w-5 text-card" />}
              />
            </div>
          </StaggerItem>
        </Stagger>
      </Screen>
    </>
  );
}
