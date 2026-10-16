'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Footprints, Info, MapPin } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { clsx } from 'clsx';

/**
 * The site map.
 *
 * There is no drawing of this site in the prototype, so this screen draws a
 * schematic instead of pretending. A stock photograph of a warehouse roof, or a
 * grey box labelled "map", would both be worse than a plain plan: one is a lie
 * and the other tells a driver nothing. What follows is built from the design
 * tokens, carries real text rather than scaled-down labels, and stays legible on
 * a 360px screen — which is the only size that matters here.
 *
 * The note at the top is not disclaiming the work, it is stating a fact: this
 * has to be replaced with the site's own drawing before anyone relies on it.
 */

// SVG geometry attributes cannot take Tailwind classes reliably across renderers,
// so the four palette values used in the diagrams are named once, here.
const INK = '#0c1219';
const LINE_STRONG = '#9dabb8';
const SINK = '#dfe4e8';
const MUTED = '#5d6e7e';

type TabId = 'inside' | 'outside';

const TABS: { id: TabId; label: string }[] = [
  { id: 'inside', label: 'Inside' },
  { id: 'outside', label: 'Outside' },
];

type Tone = 'building' | 'road' | 'bay' | 'clear' | 'caution';

const TONE: Record<Tone, string> = {
  building: 'border-line-strong bg-card text-ink',
  road: 'border-line bg-card-sunk text-ink-muted',
  bay: 'border-line-strong bg-card text-ink',
  clear: 'border-clear bg-clear-wash text-clear',
  caution: 'border-caution bg-caution-wash text-caution',
};

export function MapPanel() {
  const [tab, setTab] = useState<TabId>('inside');
  const tabs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  // Arrow keys move between tabs and select as they go, which is the pattern for
  // a two-panel view where the content is already loaded: no second Enter.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const go = (next: TabId) => {
      setTab(next);
      tabs.current[next]?.focus();
    };

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      go(TABS[(i + 1) % TABS.length].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      go(TABS[(i - 1 + TABS.length) % TABS.length].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(TABS[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(TABS[TABS.length - 1].id);
    }
  };

  return (
    <div>
      <p className="flex items-start gap-2 rounded-card border border-caution/40 bg-caution-wash px-3 py-2.5 text-[12.5px] leading-snug text-caution">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">Schematic, not a survey.</span> This layout is drawn for the prototype and is
          not to scale. It must be replaced with the site&apos;s actual layout drawing before it is used on site.
        </span>
      </p>

      <div
        role="tablist"
        aria-label="Site map view"
        onKeyDown={onKeyDown}
        className="mt-4 flex gap-1.5 rounded-tile border-2 border-line-strong bg-card-sunk p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`map-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`map-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex-1 rounded-tile px-3 py-2.5 text-[14px] font-semibold transition-colors',
              tab === t.id ? 'bg-card text-ink shadow-contact' : 'text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Both panels stay in the document so aria-controls always resolves; the
          inactive one is hidden and its content is not rendered at all. */}
      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`map-panel-${t.id}`}
          aria-labelledby={`map-tab-${t.id}`}
          tabIndex={0}
          hidden={tab !== t.id}
          className="mt-4 rounded-card"
        >
          {tab === t.id && <Swap>{t.id === 'inside' ? <InsidePlan /> : <OutsidePlan />}</Swap>}
        </div>
      ))}
    </div>
  );
}

// ── Inside ──────────────────────────────────────────────────────────────────

/**
 * Read top to bottom as north to south, with the gate at the north end and the
 * yard between the warehouse and despatch, which is how the site actually works:
 * everything crosses the yard, and the yard is where the risk is.
 */
function InsidePlan() {
  return (
    <div>
      <div className="grid gap-1.5 rounded-card border-2 border-line-strong bg-paper p-1.5">
        <div className="flex items-center justify-between gap-2 rounded-tile border-2 border-line bg-card-sunk px-2.5 py-2">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-muted">
            Plan view — north at the top
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
            North
            <Compass />
          </span>
        </div>

        <RoadRow label="Site road — one way, 5 mph" />

        <div className="grid grid-cols-2 gap-1.5">
          <Zone label="HGV entrance" sub="barrier, one vehicle at a time" tone="road" />
          <Zone label="Delivery entrance" sub="goods-in, north side" tone="road" />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Zone label="Gatehouse" sub="stop and report here" />
          <Zone label="Offices" sub="visitor reception" />
        </div>

        <div className="flex items-center justify-between gap-2 rounded-tile border-2 border-dashed border-line-strong bg-card px-2.5 py-2">
          <span className="flex items-center gap-2">
            <Footprints className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
            <span className="text-[12.5px] font-semibold text-ink">Pedestrian walkway</span>
          </span>
          <span className="text-right text-[10.5px] text-ink-muted">Gatehouse to the offices</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Zone label="Warehouse" sub="racks and pick faces" />
          <Zone label="Despatch" sub="collections and paperwork" />
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-muted">Loading bays 1–8</p>
          <div className="grid grid-cols-8 gap-[3px]">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="flex min-h-[44px] items-center justify-center rounded-tile border-2 border-line-strong bg-card"
              >
                <span className="sr-only">Loading bay {i + 1}</span>
                <span aria-hidden className="font-mono text-[13px] font-semibold tabular text-ink">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Zone label="Yard banks" sub="vehicles reverse here" />
          <Zone label="Trailer park" sub="parked trailers and units" />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Zone label="Fuel bay" sub="no smoking, engines off" tone="caution" />
          <Zone label="Driver waiting area" sub="sit here, not in the yard" />
        </div>

        <Zone label="Muster point" sub="assemble here if the alarm sounds" tone="clear" />
      </div>

      <Legend
        items={[
          { tone: 'road', label: 'Vehicle route, one way' },
          { tone: 'building', label: 'Building or covered area' },
          { tone: 'bay', label: 'Loading bay' },
          { dashed: true, label: 'Pedestrian walkway' },
          { tone: 'clear', label: 'Muster point' },
          { tone: 'caution', label: 'Fuel — no smoking' },
        ]}
      />

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
        Traffic runs one way around the yard, so you may have to pass a bay and come back to it. Keep to the walkway on
        foot, and give the reversing area at the banks a wide berth.
      </p>
    </div>
  );
}

// ── Outside ─────────────────────────────────────────────────────────────────

/**
 * The approach. Whoever wrote the site's road sign knows the answer to "which
 * way do I turn", and no driver should have to guess it at a busy junction.
 */
function OutsidePlan() {
  return (
    <div className="rounded-card border-2 border-line-strong bg-paper p-1.5">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2 rounded-tile border-2 border-line bg-card-sunk px-2.5 py-2">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-muted">
            Approach — north at the top
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
            North
            <Compass />
          </span>
        </div>

        <div className="rounded-tile border-2 border-line-strong bg-card px-2.5 py-2">
          <p className="text-[12.5px] font-semibold text-ink">Main road — two way</p>
          <p className="text-[11px] text-ink-muted">Eastbound traffic in the north lane, westbound in the south lane.</p>
        </div>
        <LaneStrip />

        <div className="grid gap-1.5 sm:grid-cols-2">
          <div className="flex items-center gap-2.5 rounded-tile border-2 border-line-strong bg-card px-2.5 py-2">
            <TurnArrow dir="left" />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-ink">Coming from the east</span>
              <span className="block text-[11px] leading-snug text-ink-muted">
                Turn left into the site entrance, signposted HGV entrance.
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2.5 rounded-tile border-2 border-line-strong bg-card px-2.5 py-2">
            <TurnArrow dir="right" />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-ink">Coming from the west</span>
              <span className="block text-[11px] leading-snug text-ink-muted">
                Do not turn right across the traffic. Carry on to the roundabout and come back.
              </span>
            </span>
          </div>
        </div>

        <Zone
          label="Holding area"
          sub="Wait here if the yard is full. Do not queue on the main road."
          tone="caution"
        />

        <div className="flex items-center gap-2.5 rounded-tile border-2 border-line-strong bg-card px-2.5 py-2">
          <MapPin className="h-4 w-4 shrink-0 text-ink" aria-hidden />
          <span className="min-w-0">
            <span className="block text-[12.5px] font-semibold text-ink">Site entrance</span>
            <span className="block text-[11px] leading-snug text-ink-muted">
              Stop at the barrier and report to the gatehouse. One gate for everything: HGVs, vans and cars.
            </span>
          </span>
        </div>
      </div>

      <Legend
        items={[
          { lane: true, label: 'Lane direction' },
          { tone: 'building', label: 'Site entrance and gatehouse' },
          { tone: 'caution', label: 'Holding area — wait here' },
        ]}
      />

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
        Keep the entrance, the roundabout and the main road clear at all times. If the yard is full, the gatehouse will
        tell you where to wait rather than having you sit on the approach.
      </p>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** A named part of the plan. Real text, so it stays readable at 360px. */
function Zone({ label, sub, tone = 'building', className }: { label: string; sub?: string; tone?: Tone; className?: string }) {
  return (
    <div
      className={clsx('flex min-h-[54px] flex-col justify-center rounded-tile border-2 px-2.5 py-2', TONE[tone], className)}
    >
      <span className="text-[12.5px] font-semibold leading-tight">{label}</span>
      {sub && <span className="mt-0.5 text-[10.5px] leading-tight opacity-80">{sub}</span>}
    </div>
  );
}

/** A vehicle route, drawn as a road strip with a direction of travel on it. */
function RoadRow({ label }: { label: string }) {
  return (
    <div className={clsx('flex items-center gap-2 rounded-tile border-2 px-2.5 py-2', TONE.road)}>
      <Chevrons />
      <span className="font-mono text-[10.5px] uppercase tracking-wider">{label}</span>
    </div>
  );
}

function Legend({ items }: { items: { tone?: Tone; label: string; dashed?: boolean; lane?: boolean }[] }) {
  return (
    <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-[12px] text-ink-muted">
          {item.lane ? (
            <span className="flex w-6 shrink-0 justify-center">
              <Chevrons />
            </span>
          ) : (
            <span
              className={clsx(
                'h-3.5 w-6 shrink-0 rounded-[3px] border-2',
                item.tone ? TONE[item.tone] : 'border-line-strong bg-card',
                item.dashed && 'border-dashed border-line-strong bg-card',
              )}
              aria-hidden
            />
          )}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Chevrons() {
  return (
    <svg viewBox="0 0 66 12" className="h-3 w-16 shrink-0" aria-hidden fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 1 l5 5 -5 5 M20 1 l5 5 -5 5 M38 1 l5 5 -5 5 M56 1 l5 5 -5 5" />
    </svg>
  );
}

function Compass() {
  return (
    <svg viewBox="0 0 20 24" className="h-4 w-3.5 shrink-0" aria-hidden fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 23 V3" />
      <path d="M10 3 l-3.5 5 M10 3 l3.5 5" />
    </svg>
  );
}

/** Straight on, then a 90 degree turn — the move a driver actually has to make. */
function TurnArrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 28 28" className="h-6 w-6 shrink-0" aria-hidden fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'left' ? <path d="M20 24 V12 H6 M6 12 l5 -5 M6 12 l5 5" /> : <path d="M8 24 V12 H22 M22 12 l-5 -5 M22 12 l-5 5" />}
    </svg>
  );
}

/** The main road: one lane each way, drawn flat so the lanes stay legible. */
function LaneStrip() {
  return (
    <svg
      viewBox="0 0 320 60"
      className="h-auto w-full"
      role="img"
      aria-label="Main road, two way: eastbound in the north lane, westbound in the south lane"
    >
      <rect x="1" y="6" width="318" height="48" rx="5" fill={SINK} stroke={LINE_STRONG} strokeWidth="2" />
      <line x1="10" y1="30" x2="310" y2="30" stroke={LINE_STRONG} strokeWidth="2" strokeDasharray="12 8" />

      <g fill={MUTED}>
        <path d="M258 14 l10 5 -10 5z" />
        <path d="M112 14 l10 5 -10 5z" />
        <path d="M62 36 l-10 5 10 5z" />
        <path d="M208 36 l-10 5 10 5z" />
      </g>
    </svg>
  );
}

/** One short swap per tab change, and a plain swap under reduced motion. */
function Swap({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  if (reduced) return <div>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    >
      {children}
    </motion.div>
  );
}
