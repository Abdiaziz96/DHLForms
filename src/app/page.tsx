import { HardHat, UserRound } from 'lucide-react';

import { KeyContacts } from '@/components/KeyContacts';
import { Plate } from '@/components/Plate';
import { Stagger, StaggerItem } from '@/components/Stagger';
import { Tile } from '@/components/Tile';
import { APP_NAME, SITE_NAME } from '@/lib/site';

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="hazard w-7 shrink-0 rounded-sm" aria-hidden />
            <span className="font-display text-lg font-bold tracking-tight text-ink">{APP_NAME}</span>
            <span className="h-4 w-px bg-line-strong" aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">{SITE_NAME}</span>
          </div>
          <KeyContacts context="general" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8">
        <Stagger>
          <StaggerItem>
            <h1 className="max-w-[10ch] font-display text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.02em] text-ink sm:text-6xl">
              Who are you here as?
            </h1>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-muted">
              Every visit and every vehicle movement on this site gets one record. Thirty seconds on your phone, and
              the office stops asking you for it at the desk.
            </p>
          </StaggerItem>

          <StaggerItem className="mt-9">
            <div className="grid gap-3">
              <Tile
                href="/staff"
                variant="primary"
                title="I work here"
                description="Drivers, warehouse and office. Shift handover, vehicle checks and the desk view."
                icon={<HardHat className="h-5 w-5 text-card" />}
              />
              <Tile
                href="/visitor"
                title="I'm visiting"
                description="Delivering or collecting. Sign in, read the safety notice, find where you're going."
                icon={<UserRound className="h-5 w-5 text-ink" />}
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5 text-[12.5px] text-ink-muted">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-clear" aria-hidden />
                Works without signal in the yard
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-clear" aria-hidden />
                No sign-in for drivers
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-clear" aria-hidden />
                Nothing installs
              </span>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="mt-6 flex items-center gap-3 text-[12.5px] text-ink-faint">
              <Plate reg="YX24 KDJ" size="sm" />
              <span>Registrations appear like this throughout, so a column of vehicles is scannable at a glance.</span>
            </div>
          </StaggerItem>
        </Stagger>
      </main>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <p className="text-[12px] leading-relaxed text-ink-faint">
            Prototype running on sample data. Not connected to any live site system, and no real driver, vehicle or
            visitor details are held here. Emergency numbers are in the red bar at the top of every screen.
          </p>
        </div>
      </footer>
    </div>
  );
}
