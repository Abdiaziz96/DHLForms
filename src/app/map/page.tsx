import { MapPanel } from '@/components/MapPanel';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { Stagger, StaggerItem } from '@/components/Stagger';

export const metadata = { title: 'Site map' };

/**
 * The map.
 *
 * A thin shell around the plan: the page itself has no state, so it stays a
 * server component and the switcher only ever ships what it needs. The note
 * about the drawing being a schematic lives inside MapPanel, with the drawing it
 * describes, so the two cannot drift apart.
 */
export default function MapPage() {
  return (
    <>
      <ScreenHeader
        title="Site map"
        subtitle="Where everything is once you are through the gate, and how to get here in the first place."
        backHref="/"
        backLabel="Start"
      />
      <Screen>
        <Stagger>
          <StaggerItem>
            <MapPanel />
          </StaggerItem>
        </Stagger>
      </Screen>
    </>
  );
}
