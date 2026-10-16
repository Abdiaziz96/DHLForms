# Architecture

How Gatehouse is built, why it is built that way, and what would have to change to take it to a real database.

This document describes the code as it exists in the repository. Where something is linked but not implemented, it says so. Where a limitation is real, it says so plainly rather than describing the intent behind it.

## Contents

- [The shape of the system](#the-shape-of-the-system)
- [The stack](#the-stack)
- [Routes and endpoints](#routes-and-endpoints)
- [The single-workbook store](#the-single-workbook-store)
- [Why the store sits behind a narrow interface](#why-the-store-sits-behind-a-narrow-interface)
- [The offline approach and its real limitations](#the-offline-approach-and-its-real-limitations)
- [Where the risk score is computed](#where-the-risk-score-is-computed)
- [White-labelling](#white-labelling)
- [Admin authentication](#admin-authentication)
- [The design tokens](#the-design-tokens)
- [The migration path to Postgres](#the-migration-path-to-postgres)

## The shape of the system

```
  Driver's phone                Next.js server                Disk
  ──────────────                ──────────────                ────
  /staff/driver/debrief
        │
        │  POST /api/records   (open, no login)
        ├──────────────────────►  coerceRecord()
        │                         assessRisk()   ← server computes
        │                         append()
        │                              ├──────────────────────►  data/site-records.xlsx
        │  ◄──── 201 { risk, persisted }
        │
  Office browser
  /staff/admin  ──(middleware)──►  GET /api/records   (gated)
                                   GET /api/export    (gated)

  Analyst
  site-records.xlsx  ──►  Power BI  ──►  four report pages
```

There is one writer, one file, and one downstream consumer. Every design decision in the app is downstream of that.

## The stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15, App Router, React 19 | Server route handlers and server components in one project, no separate API service |
| Language | TypeScript 5.8, strict via `tsc --noEmit` | The workbook column order is a type-level contract; `COLUMNS` is typed against `SiteRecord` |
| Styling | Tailwind CSS 4, `@import 'tailwindcss'` in `src/app/globals.css` | Tokens live in `@theme`, so the palette is one file |
| Motion | `framer-motion`, wrapped in `Stagger` | |
| Icons | `lucide-react` | Listed in `optimizePackageImports` in `next.config.ts` |
| Workbook | `exceljs` 4.4 | Read and write XLSX on the server. Kept external to the server bundle via `serverExternalPackages` |
| Persistence | The filesystem, through `src/lib/store.ts` | No database to provision, approve or back up |

`next.config.ts` does two things: it marks `exceljs` as a server external package, because it is a large CommonJS dependency that should not be bundled, and it enables `optimizePackageImports` for `lucide-react`.

## Routes and endpoints

Pages that exist:

| Route | File | Notes |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Landing. Two tiles: staff or visitor |
| `/staff` | `src/app/staff/page.tsx` | Job picker. Links to driver, warehouse and admin |
| `/staff/driver` | `src/app/staff/driver/page.tsx` | Driver task picker |
| `/staff/driver/debrief` | `src/app/staff/driver/debrief/page.tsx` | Going out |
| `/staff/driver/brief` | `src/app/staff/driver/brief/page.tsx` | Coming back |
| `/visitor` | `src/app/visitor/page.tsx` | Delivering or collecting |

Linked but not implemented: `/staff/warehouse`, `/staff/admin`, `/staff/admin/login`, `/visitor/delivering`, `/visitor/collecting`, `/safety`, `/map`. The last two are also listed in the service worker's shell cache in `public/sw.js`, where `cache.addAll` is wrapped in a `.catch` so a missing route does not break the install.

API endpoints that exist:

| Method | Route | Gate | What it does |
| --- | --- | --- | --- |
| `GET` | `/api/records` | Admin session | Every record, newest first. `?scope=today` filters to the current local day. `?kind=a,b` filters by record type |
| `POST` | `/api/records` | **Open** | Accepts a submission, recomputes risk, appends a row |
| `GET` | `/api/export` | Admin session | Downloads a workbook. `?scope=today` and `?kind=` slice it |
| `POST` | `/api/admin/seed` | Admin session | Loads sample data. Refuses when the workbook already holds rows |

Both `/api/records` and `/api/export` are marked `export const dynamic = 'force-dynamic'`. The workbook is read at runtime and never cached at the route level.

## The single-workbook store

`src/lib/store.ts` is the whole persistence layer. It imports `server-only`, so it cannot be pulled into a client component by accident.

Its public surface is three functions:

```ts
export async function readAll(): Promise<SiteRecord[]>          // newest first
export async function getById(id: string): Promise<SiteRecord | undefined>
export async function append(records: SiteRecord | SiteRecord[]): Promise<void>
```

plus `isEmpty()`, `buildWorkbookBuffer()`, `isDegraded()`, `describeStorage()` and `resetCache()`.

What it does internally, in order:

1. **Reads once.** `loadFromDisk()` populates a module-level `cache` on first call and returns it on every later call. The file is parsed with `exceljs` and mapped back to `SiteRecord` by `recordFromRow`, which is deliberately tolerant — a missing cell becomes a sensible default rather than a crash.
2. **Serialises writes.** `append` chains onto a module-level `writeChain` promise, so two simultaneous submissions run one after the other. Without it, both callers would read the same list, both append one row, and one row would be lost.
3. **Writes atomically.** `persist()` writes to `.site-records.xlsx.tmp` and renames it over the real file. Rename is atomic on the same volume, so a crash mid-write leaves the previous workbook intact.
4. **Fails honestly.** If the write throws — a read-only filesystem on a serverless host, most often — the row stays in the cache, `degraded` is set to `true`, and the error is logged. `POST /api/records` reads `isDegraded()` and returns `"persisted": false`, and `DebriefForm` renders a warning instead of a clean confirmation.

The file is not itself an append-only log. `persist()` rebuilds the whole workbook from the in-memory list each time. The guarantee the office asked for is that no row is ever dropped or rewritten, and that holds: `append` only ever pushes. But the write cost grows with the row count, so this design has a ceiling. At a few thousand rows it is fine; at a few hundred thousand it would not be.

Known limitations, stated plainly:

| Limitation | Consequence |
| --- | --- |
| One process, one cache | Two server processes hold different views. A write in one is invisible to the other until restart. Horizontal scaling breaks this store |
| Whole-file rewrite per append | Write latency grows linearly with the number of rows |
| No deletion or update path | Records can be corrected only by editing the file by hand, which the in-memory cache will not notice until restart |
| No retention | Nothing archives or expires. See the data protection section of `README.md` |
| Read-only host | The app degrades to in-memory and says so, but every row is lost on restart |
| `routeHasHeightRestriction` is not persisted | `recordFromRow` reconstructs it as `false` for every row read back. Anything downstream that depends on it must read `Route` and look it up instead |
| `visitorPurpose` is not persisted | Same. `recordFromRow` always returns `null`; the visitor's purpose survives only in `Type` and `Notes` |
| `operatorSignature` is not persisted | The workbook has no signature column. `recordFromRow` returns `null` |

Those last three are consequences of the workbook being the schema rather than the database being the schema. It is a real trade: the file stays readable by a human, and three fields that only the app cares about are dropped.

## Why the store sits behind a narrow interface

Three reasons, in order of importance.

**The store is temporary and everyone knows it.** The workbook exists so the app runs with no database and nothing for IT to approve. That is a staging decision, not an architectural one. Writing the rest of the app directly against file operations would mean rewriting the app when the staging decision reverses. Writing it against `readAll` / `append` / `getById` means the change is confined to one file.

**The exported surface already has the shape a database would.** `readAll` returns a list, `getById` returns one row or nothing, `append` takes one record or an array. Those map onto `SELECT`, `SELECT … WHERE id = $1` and `INSERT`. The method signatures do not change when the implementation does.

**It keeps the honesty in one place.** Every limitation above — the cache, the atomic rename, the degraded flag — is a property of the file store, not of the app. When the store is replaced, the limitations go with it, and no other file has to be revisited.

The interface is narrow on purpose. There is no query builder, no filter language, no partial update. `GET /api/records` filters in memory after calling `readAll`, which is the correct choice at this data volume and would be the wrong choice at a larger one.

## The offline approach and its real limitations

The yard has dead spots. A driver at the far end of the site may have one bar of signal, and losing a completed form to a dropped connection is not acceptable.

Two mechanisms address this, plus one that was written and never wired up.

**1. The composition queue, in `src/lib/client-storage.ts`.**

`DebriefForm` and `BriefForm` both POST to `/api/records` inside a `try`/`catch`. If the fetch throws — no signal, a dropped connection — the catch calls `enqueue(body)`, which writes the submission into `localStorage` under `gatehouse.queue` and shows a "queued" result to the driver. The record is not lost from the device.

`useSyncQueue()` provides the drain: it tracks `navigator.onLine`, listens for the `online` event, and on regaining a connection loops the queue and re-posts each item. Its handling of failures is deliberate:

- A `4xx` response means the payload is wrong, not that the network failed. The item is dropped rather than retried, because retrying a permanently invalid payload forever would block every good submission behind it.
- A `5xx` or a thrown fetch keeps the item, increments `attempts` and records `lastError`.

**The limitation that matters: nothing mounts `useSyncQueue`.** As built, queued submissions are written to `localStorage` and stay there. The form tells the driver the record is queued, which is true, but nothing currently drains the queue automatically. A submission made in a dead spot reaches the workbook only if something calls `drain`. This is the single largest gap between what the UI implies and what the code does.

Further limitations of the queue as written:

- There is no background sync. iOS Safari does not support the Background Sync API, so a submission will never send while the app is closed on an iPhone. The author's comment in `client-storage.ts` says exactly this, and it is the right call: promising background delivery on iOS would be a lie.
- The queue lives in `localStorage`, which is per browser and per device. Clearing site data, or using a private window, discards it. `write()` catches the quota error and silently continues, so a full or unavailable store loses the submission.
- Queue items are ordered and drained in order, one at a time.
- There is no upper bound on the queue, and no expiry.

**2. The service worker, in `public/sw.js`.**

The file is written and describes a sensible policy: stale-while-revalidate for the app shell and static assets, and a hard rule that anything under `/api/` is never cached, because records must be live or not at all. It precaches `/`, `/staff`, `/visitor`, `/safety` and `/map`.

**It is not registered.** No file in `src/` calls `navigator.serviceWorker.register`, and there is no web manifest. The caching described above is therefore not active, and a driver who reloads the page in a dead spot gets a browser error rather than a cached shell. The `.catch(() => undefined)` on `cache.addAll` would also hide the fact that `/safety` and `/map` do not exist.

**3. `useRememberedDriver`.**

The one part of the offline story that does work as intended. The driver's name, reference and basis are written to `localStorage` under `gatehouse.driver` and pre-filled on the next visit, so a returning driver skips the identity step. `read()` drops a corrupt entry rather than letting it break the app.

## Where the risk score is computed

The score is computed on the server, in the `POST` handler at `src/app/api/records/route.ts`, and never on the device.

The handler:

1. Parses the body and runs `coerceRecord()`. A record needs at least `operatorName` and `reg`; anything else gets a default. This check is permissive on purpose — the UI validates properly, and a rejected submission in a yard is worse than a sparse one.
2. Looks the route up with `routeByRef(record.routeRef)` and derives `routeHasHeightRestriction` from the route rather than from the request body.
3. Calls `assessRisk()` with the submitted basis, height, acknowledgement and delay, plus `routeTrips90d` and `priorIncidents` read from the body.
4. Writes `riskScore`, `riskBand` and `bridgeWarning` onto the record and appends it.

`bridgeWarning` is a formatted string naming the restriction and showing both numbers, for example `Pilning station bridge — signed 4.4m, vehicle 4.60m`. It is built only when the assessment produced a `BridgeWarning` and the route has a named restriction.

Two inputs to `assessRisk` are not really trustworthy yet. `routeTrips90d` and `priorIncidents` are read from the request body, and `DebriefForm` sends `routeTrips90d: familiar === true ? 10 : 0` and `priorIncidents: 0`. So the familiarity weight fires on a single self-reported toggle, and the prior-incident weight never fires at all on real submissions. Both need a real driver history source before the score means what it looks like it means. The full account is in `docs/RISK-MODEL.md`.

## White-labelling

Site identity is three values in `src/lib/site.ts`, all read from environment variables with a default:

```ts
export const APP_NAME  = process.env.NEXT_PUBLIC_APP_NAME  ?? 'Gatehouse';
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'Severn Beach';
export const APP_TAGLINE = 'Site access and vehicle movements, recorded in thirty seconds.';
```

The rule the file states is that nothing in `components/` or `app/` hard-codes a site name, an app name or a customer brand. The app name and site name appear in `src/app/layout.tsx` as page metadata, in `src/app/page.tsx` in the header, and are written as the workbook creator in `store.ts`.

Two things are *not* white-labelled, and both matter:

- **`src/lib/contacts.ts`** holds the site contact list. The names, numbers and extensions are invented, and the file says so. Every entry needs replacing before the app is shown to a driver. Only `999` and the site name are real.
- **`src/lib/routes.ts`** holds the bridge and route data, and is also flagged placeholder. See `docs/RISK-MODEL.md` for why a wrong clearance figure is the most serious data problem in the project.

Contract names in `src/lib/site.ts` and the runsheet in `src/lib/runsheet.ts` are placeholder too.

Because both values are `NEXT_PUBLIC_*`, they are inlined at build time. Changing either requires a rebuild, not just a restart.

## Admin authentication

The gate replaced an earlier client-side passcode that shipped in the JavaScript bundle and was enforced by a `localStorage` flag. That version meant anyone could read the password out of devtools or set the flag by hand. Since the data is driver names, registrations and visitor details, the gate had to become real.

The current mechanism, in `src/lib/session.ts` and `src/middleware.ts`:

- **Signed cookie, no session store.** `createSession()` builds the payload `admin.<expiry>` and appends a base64url HMAC-SHA256 signature over that payload. The cookie is `gh_admin`. There is no server-side session table, which is what makes the mechanism work on a serverless host with no shared state.
- **Wire format.** Three dot-separated parts: scope, expiry, signature. `verifySession()` rejects anything that is not three parts, that does not carry the `admin` scope, that has already expired, or whose signature does not match.
- **TTL of 12 hours.** `TTL_SECONDS = 60 * 60 * 12`, described in the code as one shift. `SESSION_MAX_AGE` re-exports it so the cookie can be set with the same lifetime.
- **Web Crypto, not Node crypto.** The HMAC is computed with `crypto.subtle`, so the same module runs both in middleware (edge runtime) and in route handlers (Node runtime). This constrains the implementation to async functions and to no Node built-ins, which is why `hmacHex` is `async`.
- **Constant-time-ish comparison.** `safeEqual` compares lengths first and then XORs the whole string, so an early exit leaks nothing useful.
- **Refusing to sign with a default.** `secret()` throws if `SESSION_SECRET` is missing or is still `change-me-too`. A predictable session key would be worse than no session at all, so failing loudly is correct.
- **The password check is deliberately not constant time.** `checkPassword` is a plain string comparison against `ADMIN_PASSWORD`, and returns false for an unset variable or the literal `change-me`. The comment in the file is right: this is a shared site password, not a per-user credential, so timing resistance is not the relevant property.

`src/middleware.ts` decides what is gated:

```ts
export const config = {
  matcher: ['/staff/admin', '/staff/admin/((?!login).*)', '/api/admin/:path*', '/api/records', '/api/export'],
};
```

Inside the handler, `POST /api/records` is allowed through before the cookie is checked:

```ts
if (pathname.startsWith('/api/records') && request.method === 'POST') {
  return NextResponse.next();
}
```

So submission is open to anyone with the link, because a login screen is where most driver take-up is lost, and the operator identity is captured on the record itself. Reading the record set back is gated. A failed check redirects to `/staff/admin/login?next=<original>`, a page that does not exist yet.

What this authentication does not do:

- It does not distinguish one admin from another. There is one shared password, so no per-user access and no record of who viewed what.
- It has no rate limiting and no lockout on the password check.
- It does not support revocation. A stolen cookie is valid until it expires; changing `SESSION_SECRET` invalidates every session at once.
- It is not an access control boundary for the driver, warehouse and visitor screens, which are open by design.

## The design tokens

`src/app/globals.css` holds the visual language, in Tailwind 4's `@theme` block. It is light-first on purpose: these screens are read outdoors, in daylight, one-handed.

The direction is stated in the file as galvanised steel and site signage — the palette is drawn from bare metal, hazard amber and industrial red, not from a generic dark dashboard.

| Token group | Values | Purpose |
| --- | --- | --- |
| Surfaces | `--color-paper` `#e9ecef`, `--color-card` `#f7f9fa`, `--color-card-sunk` `#dfe4e8` | Cool galvanised neutrals. Never pure white |
| Lines | `--color-line` `#c7d0d8`, `--color-line-strong` `#9dabb8` | Hairlines and field borders |
| Ink | `--color-ink` `#0c1219`, `--color-ink-soft` `#33414f`, `--color-ink-muted` `#5d6e7e`, `--color-ink-faint` `#8b9aa8` | A cool blue-black, deliberately not a neutral near-black |
| Accent | `--color-hivis` `#f2b705`, `--color-hivis-deep` `#b8860b`, `--color-hivis-wash` `#fdf3d6` | One accent only, carrying primary actions, the amber band and the number-plate chip |
| Bands | `--color-clear` `#1f7a4d` / wash `#e2f2ea`, `--color-caution` `#b8860b` / wash `#fdf3d6`, `--color-stop` `#c7362f` / wash `#fbe9e7` | The three risk bands, green, amber and red |
| Type | `--font-display` Archivo, `--font-sans` IBM Plex Sans, `--font-mono` IBM Plex Mono | Loaded via `next/font/google` in `src/app/layout.tsx` |
| Shadows | `--shadow-contact`, `--shadow-lift`, `--shadow-press` | A two-part shadow law: a tight contact shadow plus a soft ambient one |
| Radius | `--radius-tile` `10px`, `--radius-card` `14px` | |

Three decisions in the stylesheet are worth knowing because they constrain future work:

- **Touch targets have a floor.** `button`, `a[role='button']` and `[role='tab']` all get `min-height: 44px` in the base layer, whatever the layout wants.
- **Motion is a preference.** A `prefers-reduced-motion` block collapses every animation and transition to `0.01ms`.
- **Print is supported.** A `@media print` block hides `.no-print` and forces black on white, because a completed record has to be legible on paper for the audit file.

The one memorable element is the number plate, `.plate` in the components layer — a yellow plate with a black banner and mono type. Registrations are the highest-frequency token in the product, so rendering them as actual plates makes a column scannable at a glance. `.hazard` is a diagonal hazard-stripe utility used exactly once, on the landing page, to mark the threshold into site.

## The migration path to Postgres

The migration is bounded by the store interface. This section states what changes, what does not, and what has to be decided.

### What changes

| Item | Change |
| --- | --- |
| `src/lib/store.ts` | Rewritten. Same exported function names and signatures, different implementation |
| Database | A Postgres instance, plus a driver such as `pg` or an ORM |
| Schema | New. One `movements` table is the minimum; the star schema in `docs/POWERBI.md` is a reasonable target |
| Connection config | A new environment variable, for example `DATABASE_URL`. Add it to `.env.example` and keep it out of the repository |
| The in-memory cache | Removed. `readAll` becomes a query |
| The degraded-write path | Reconsidered. A database failure is not the same as a read-only disk, and silently keeping a row in memory while telling the operator it is queued is the wrong behaviour against a real database |
| `buildWorkbookBuffer()` | Kept, but fed from a query rather than from the cache. The Power BI feed does not have to change |
| `resetCache()` and `describeStorage()` | Removed or repurposed. They exist only because the store is a file |

A sketch of the replacement, to make the size of the change concrete:

```ts
// src/lib/store.ts — after migration
import 'server-only';
import { sql } from './db';
import type { SiteRecord } from './types';

export async function readAll(): Promise<SiteRecord[]> {
  const rows = await sql`SELECT * FROM movements ORDER BY submitted_at DESC`;
  return rows.map(rowToRecord);
}

export async function getById(id: string): Promise<SiteRecord | undefined> {
  const rows = await sql`SELECT * FROM movements WHERE id = ${id} LIMIT 1`;
  return rows[0] ? rowToRecord(rows[0]) : undefined;
}

export async function append(records: SiteRecord | SiteRecord[]): Promise<void> {
  const list = Array.isArray(records) ? records : [records];
  if (list.length === 0) return;
  await insertMovements(list);   // one statement, one transaction
}
```

The write chain, the temporary file, the atomic rename and the cache all disappear. So does the concurrency comment that explains them, because the database now provides that guarantee.

### What does not change

- **`src/lib/types.ts`, including `COLUMNS`.** The workbook shape is the contract with Power BI and with the office. It stays.
- **`src/lib/risk.ts`.** Pure function, no I/O.
- **Every route handler's logic.** They call `readAll`, `append` and `getById`. The calls do not move.
- **The forms.** They POST to the same endpoint with the same payload.
- **`src/lib/api.ts`.** `coerceRecord`, `newId` and `localNow` are transport concerns, not storage concerns.
- **`src/lib/session.ts` and `src/middleware.ts`.** The session is stateless by design, so no session table is needed.
- **`src/app/api/export/route.ts`.** It calls `buildWorkbookBuffer(records)`, which is fed from `readAll`. The column order and the header styling stay identical.
- **The Power BI layer.** It reads a file. Whether that file is produced on demand by the export endpoint or dropped on a schedule is a deployment question, not a report change.
- **The workbook itself.** It remains the integration bus. See `docs/ROADMAP.md` for why that is a deliberate choice rather than a leftover.

### What has to be decided first

1. **Retention.** The database makes deletion possible for the first time. It also makes the absence of a retention rule more visible, because a table that grows forever is easier to notice than a spreadsheet nobody opens. Decide the period, then implement it.
2. **Personal data fields.** `operatorRef` is a payroll, licence or agency reference, and `operatorName` and `reg` identify a person and a vehicle. Decide whether to store them in the clear, whether to separate them from the movement record, and who can read which.
3. **Whether the driver history becomes real.** `routeTrips90d` and `priorIncidents` currently come from the request body. A driver table makes both derivable rather than self-reported, which is what turns two of the nine risk weights into real signals. This is arguably the strongest reason to do the migration at all.
4. **Hosting.** A database brings a host, a backup policy and a network path. That is the thing the workbook was avoiding. The migration is only worth doing when a named system already exists that the operation is allowed to use — an in-house database, an approved cloud tenant, or a managed instance someone else already runs. Standing up a new one to avoid a spreadsheet is not obviously a win.
5. **Whether the workbook stays the interface.** If the operation wants Power BI connected directly to Postgres, the export becomes optional. If they want a file, the export stays and is the only user-facing change.

### Migration order

1. Add the schema and a backfill that reads the existing workbook and inserts every row.
2. Implement the new `store.ts` against the schema.
3. Run both in parallel for a shift, comparing `readAll()` output.
4. Cut over, and keep the workbook export running so the office notices nothing.
5. Remove the file store, `resetCache()` and the degraded-write path.

Step 3 matters more than it looks. The file store's `recordFromRow` already drops `routeHasHeightRestriction`, `visitorPurpose` and `operatorSignature` on every read. A backfill that copies the workbook will inherit those gaps, so the migration is also the moment to decide whether those fields belong in the schema — and if they do, they will need to start being captured at the source rather than reconstructed.
