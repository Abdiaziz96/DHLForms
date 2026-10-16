# Gatehouse

Site access and vehicle movements, recorded in thirty seconds.

Gatehouse is a phone-first web app that records who comes onto an industrial distribution site and what vehicle they move. It replaces the paper brief and debrief at the transport desk. The site is Severn Beach; the operator entering most of the records is a Class 1 HGV driver leaving the yard.

The app is a supplement to the existing operation, not a replacement for it. It writes one thing: a single Excel workbook, one row per movement. That workbook is the product. Everything else — the forms, the risk flag, the office screens — exists to keep the workbook accurate.

**Status: prototype. Sample data only. Not connected to any live site system.**

## Contents

- [What this is](#what-this-is)
- [Who it is for](#who-it-is-for)
- [Running it](#running-it)
- [How the workbook works](#how-the-workbook-works)
- [The workbook columns](#the-workbook-columns)
- [The risk flag](#the-risk-flag)
- [Environment variables](#environment-variables)
- [Data protection](#data-protection)
- [The safety angle, in plain English](#the-safety-angle-in-plain-english)
- [What is not built yet](#what-is-not-built-yet)
- [Where the rest of the documentation lives](#where-the-rest-of-the-documentation-lives)

## What this is

A driver opens a link on their own phone. They pick who they are, confirm the vehicle, the trailer, the contract and the route, declare their running height, and sign. The office sees the record immediately instead of waiting for a sheet of paper to reach the desk.

The record is stored as a row in `data/site-records.xlsx`. Rows are appended, never regenerated. There is no database. That is a deliberate choice, not an omission — the office asked for one accumulating file they can open by hand, and the same file feeds Power BI.

Three flows exist in the current build:

| Flow | Route | Who uses it |
| --- | --- | --- |
| Debrief (going out) | `/staff/driver/debrief` | Drivers leaving the yard |
| Brief (coming back) | `/staff/driver/brief` | Drivers returning the vehicle |
| Office desk | `/staff/admin` | Front desk and transport office |

The app is white-labelled from environment variables. Nothing in the UI hard-codes a site name or an app name; both come from `src/lib/site.ts`.

## Who it is for

- **Drivers and operators.** They fill the form in, one-handed, outdoors, often in the rain. Their job is to be back in the cab in under a minute.
- **The transport office and front desk.** They use the office screens and the workbook to see who has moved, who is late, and who has not debriefed.
- **The transport manager.** They read the Power BI layer to see whether the site's exposure is going up or down. See `docs/POWERBI.md`.
- **The site manager.** They need the leading indicator and the escalation, not the raw rows.
- **Whoever owns compliance and data protection.** The workbook holds names, registrations and visitor details. See [Data protection](#data-protection).

## Running it

Requirements: Node 20 or newer, and npm.

```bash
# 1. Install
npm install

# 2. Configure
copy .env.example .env.local        # Windows
cp .env.example .env.local          # macOS / Linux

# 3. Edit .env.local and set a real ADMIN_PASSWORD and SESSION_SECRET.
#    The app refuses to sign an admin session while SESSION_SECRET is
#    left at "change-me-too".

# 4. Run
npm run dev            # http://localhost:3000

# Other scripts
npm run build          # production build
npm start              # production server on port 3000
npm run lint           # tsc --noEmit
```

Load sample data through the admin API once the workbook is empty:

```bash
# Requires an admin session cookie. Load up to 90 days, up to 200 rows per day.
curl -X POST http://localhost:3000/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"days":14,"perDay":22}'
```

The seed endpoint returns `409` and adds nothing if the workbook already holds rows. That refusal is intentional: mixing invented names and registrations into a file that already contains real ones makes the whole dataset unusable, and there is no way afterwards to tell which rows were which.

`package.json` also declares `npm run seed`, which runs `scripts/seed.ts`. That file does not exist in this repository, so the script fails. Use the API route or build the workbook by hand.

## How the workbook works

The store lives in `src/lib/store.ts` and exposes three operations: `readAll`, `append` and `getById`. Every read and write goes through those.

Behaviour worth knowing before you rely on the file:

| Property | What actually happens |
| --- | --- |
| Shape | One worksheet named `Records`, one row per movement, header row frozen |
| Growth | Rows are appended. The file is rebuilt on each write from the in-memory list, but no existing row is ever dropped or rewritten |
| Filename | `data/site-records.xlsx` by default, set by `WORKBOOK` and `DATA_DIR` |
| Header | Row 1, bold on an amber fill, column widths from `COLUMNS`, autofilter on the exported copy |
| Atomicity | Each write goes to a temporary file and is renamed over the real one, so a crash mid-write cannot truncate the workbook |
| Concurrency | Writes are serialised through a single in-process promise chain, so two simultaneous submissions cannot lose a row |
| Caching | The file is read once per server process and held in memory. A second server process will not see the first one's rows |
| Read-only disk | A failed write is logged, the row stays in memory, and the API reports `"persisted": false` so the UI can say so plainly |
| Sample markers | Sample rows carry invented names and registrations. The admin export marks the sample window so the two sets cannot be confused |

Two date columns exist in the file and only one in the code. `recordedAt` is a single ISO local timestamp; `COLUMNS` in `src/lib/types.ts` projects it twice, as `Date` and as `Time`. That split is there for Power BI, and it is the reason the export and the stored file agree exactly — both are built by the same function.

The export endpoint at `/api/export` downloads a workbook built from the same column order as the stored file. `?scope=today` returns a slice, and the filename says `today` so the two files can never be confused on disk. The endpoint writes nothing; the workbook on disk already holds every row.

## The workbook columns

This is the exact column order, taken from `COLUMNS` in `src/lib/types.ts`. It is the contract between the app and Power BI. Changing it breaks every report, so change it deliberately.

| # | Header | Source field | Notes |
| --- | --- | --- | --- |
| 1 | Record ID | `id` | `GH-YYYYMMDD-NNNNNN` |
| 2 | Type | `kind` | `debrief`, `brief`, `visitor` or `warehouse` |
| 3 | Date | `recordedAt` | `YYYY-MM-DD`, split from the timestamp |
| 4 | Time | `recordedAt` | `HH:MM`, local site time |
| 5 | Operator | `operatorName` | Driver, or visitor name |
| 6 | Operator Ref | `operatorRef` | Payroll, licence or agency reference |
| 7 | Basis | `operatorBasis` | `employed`, `agency` or `subcontractor` |
| 8 | Company | `company` | Company the operator works for |
| 9 | Vehicle Reg | `reg` | Normalised to upper case with no leading or trailing space |
| 10 | Trailer No | `trailer` | As stencilled on the trailer |
| 11 | Contract | `contract` | Customer or contract the load belongs to |
| 12 | Height (m) | `runningHeight` | Declared running height in metres |
| 13 | Direction | `direction` | `In` or `Out` |
| 14 | Route | `routeRef` | `R1` to `R5` |
| 15 | Delay (min) | `delayMinutes` | Signed difference between planned and actual departure |
| 16 | Defect | `defectFlagged` | `Yes` or `No` |
| 17 | Defect Note | `defectNote` | Free text, or the selected defect label |
| 18 | Height Ack | `heightAcknowledged` | `Yes` or `No` |
| 19 | Risk Score | `riskScore` | Computed on the server, never on the device |
| 20 | Risk Band | `riskBand` | `green`, `amber` or `red` |
| 21 | Bridge Warning | `bridgeWarning` | Populated only when the vehicle exceeds a restriction on the route |
| 22 | Security | `securityName` | Person at the gate who signed |
| 23 | Security Sign | `securitySignedAt` | `HH:MM` only, or blank |
| 24 | Notes | `note` | Free text for the office |
| 25 | Submitted At | `submittedAt` | ISO local timestamp |

Two fields on `SiteRecord` are deliberately absent from the workbook: `routeHasHeightRestriction` and `visitorPurpose`. Both are reconstructable from `Route` and `Type`, and neither earns its own column in a file a human has to read.

Booleans are written as `Yes`/`No`, not `TRUE`/`FALSE`. Blank cells are written as empty strings, which Power BI reads as null.

## The risk flag

Every departure gets a score. Nine weighted factors add up to a number, and the number falls into one of three bands:

| Band | Score | Label | What the operator is told |
| --- | --- | --- | --- |
| Green | 0 to 2 | Clear | Nothing to acknowledge. Carry on to the vehicle. |
| Amber | 3 to 6 | Check | Confirm your running height before you move. |
| Red | 7 and above | Stop | Do not move off. Tell the transport office first. |

The weights are in `src/lib/risk.ts`: agency driver 2, subcontractor 1, unfamiliar route 3, tall vehicle 2, very tall vehicle 3, route restricted 2, height exceeds bridge 6, prior incident 2, delayed 1, unacknowledged height 2.

The full model, every threshold, worked examples and the limits of what it can claim are in `docs/RISK-MODEL.md`. Read that before quoting a number from this app.

The score is computed on the server in the POST handler at `src/app/api/records/route.ts`, from the fields as submitted. A score the device could set would be worthless as a safety signal.

## Environment variables

Copy `.env.example` and set real values. Nothing here should be committed.

| Variable | Default | Required | What it does |
| --- | --- | --- | --- |
| `DATA_DIR` | `./data` | No | Directory holding the live workbook. On a read-only host, set this to a writable path such as `/tmp` |
| `WORKBOOK` | `site-records.xlsx` | No | Filename of the single workbook |
| `ADMIN_PASSWORD` | `change-me` | Yes | Shared password for the office surfaces. The check rejects the literal default `change-me` |
| `SESSION_SECRET` | `change-me-too` | Yes | HMAC key that signs the admin session cookie. The app throws rather than sign with the default. Generate with `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_NAME` | `Severn Beach` | No | Site name shown in the UI |
| `NEXT_PUBLIC_APP_NAME` | `Gatehouse` | No | App name shown in the UI and written as the workbook creator |

`ADMIN_PASSWORD` is a single shared password, not a per-user credential. There is no user table and no audit of who logged in. That is a known limitation, and it is why the admin surface is a prototype-quality gate rather than an access control system.

## Data protection

The workbook holds personal data. Be direct about what:

- Driver and operator names, payroll or licence references, and employment basis.
- Visitor names.
- Vehicle registrations and trailer numbers — not personal data on their own, but they identify a driver when combined with the other fields.

How the project handles that today:

- **Sample data only, until sign-off.** The app ships with invented names and registrations generated by `src/lib/dummy.ts`. No real driver, vehicle or visitor detail should enter the workbook until the operation has signed off the retention and access rules below.
- **The workbook is excluded from version control.** `.gitignore` lists `data/*.xlsx` and `data/*.xls`, so records containing real people are not staged. Note that this project is not currently a git repository, so the rules are written but not yet in force anywhere.
- **The record set is behind the admin gate.** `src/middleware.ts` protects `/api/records` (GET), `/api/export` and `/api/admin/*`. Submitting a record is open to anyone with the link; reading the record set back is not, because it contains every name and registration on site.
- **Sessions expire after one shift.** The admin cookie is valid for 12 hours, signed with HMAC-SHA256 and verified in middleware.
- **Data minimisation.** The form asks for what the operation needs to run the yard: who, what vehicle, which contract, which route, what height, what delay, what defect. It does not ask for dates of birth, addresses, licence categories or anything else.
- **Retention is not implemented.** Nothing in the code deletes or archives a record. The workbook grows indefinitely. Retention has to be a decision the operation makes and someone then enforces by hand, because the app does not support it. This is the largest open gap in the current build.
- **Where the file lives.** By default `DATA_DIR` resolves to `./data` inside the project, on whatever machine runs the server. On a serverless host the filesystem is read-only, the write fails, and the API reports `"persisted": false` — the app is honest about it rather than silently losing the row.

The specific risk of a hosted third-party form platform is that this data would sit in someone else's tenant under someone else's retention, sub-processor list, region and breach notification process. A driver name, a registration and a vehicle height is a small dataset, but it identifies a person and it describes where that person was at a given minute. Putting it into a general-purpose form tool means the operation loses direct control of who can query it, how long it is kept, and where it is stored — and gains a data processing agreement it did not previously need. Sample data avoids that question entirely, which is the second reason the prototype holds nothing real.

None of this is an argument against collecting the data. The operation already collects it on paper. The point is that moving it into a system is the moment to decide, in writing, who can read it, how long it is kept and where it lives.

## The safety angle, in plain English

A bridge strike is what happens when a tall vehicle meets a structure lower than its roof, and nobody noticed in time. The consequences are a damaged bridge, a damaged vehicle, a closed road, and sometimes an injury. It is one of the few transport incidents that is entirely predictable in advance: the height of the vehicle is known, the clearance of the structure is published, and the driver's familiarity with the route is knowable.

Gatehouse does three modest things about it.

First, it asks for the running height on every departure and records the answer. A height that is written down and stored is a height that can be checked. A height that stays in a driver's head is a height nobody can audit.

Second, it flags every departure whose declared height is greater than a restriction on the planned route. That case scores 6 on its own, which puts the record into the red band regardless of anything else. This is not a risk estimate; it is a stated conflict between two numbers the app has in hand.

Third, it writes the warnings, the acknowledgements and the outcome into the same workbook as everything else, so the office can see how often the site comes close. The rate of amber-or-red departures per 100 is the headline number — see `docs/POWERBI.md`.

What it does not do is stop a vehicle. The app flags a departure and tells the driver what to do; the decision, and the legal responsibility, stay with the driver and the transport office. It is also not a substitute for the physical height marker on the trailer, the published bridge list, or the site's own risk assessment.

And the app is only as good as its route data. `src/lib/routes.ts` is flagged as placeholder: the bridge names, road references and clearances are invented for the prototype. A wrong clearance figure is worse than no figure at all, because it is acted on with confidence. Until that file holds the site's real planned-route data, verified against the current Network Rail and local authority bridge lists, nothing this app says about a specific bridge should be shown to a driver as fact.

## What is not built yet

The prototype is narrower than the screens suggest. Recorded here so nothing is assumed:

- There is no admin dashboard, no login page, no warehouse screen, no safety notice page, no site map, no visitor sign-in page. Several of those are linked from screens that do exist: `/staff/warehouse`, `/staff/admin`, `/visitor/delivering`, `/visitor/collecting`, `/safety` and `/map` are all linked and none of them resolve yet.
- `src/middleware.ts` protects `/staff/admin/*` and `/api/admin/*`, but no admin page or login page exists to reach. The API routes under those prefixes do exist.
- `public/sw.js` exists but is never registered. No file calls `navigator.serviceWorker.register`, and no manifest is set. The app-shell caching it describes is not active.
- `src/lib/client-storage.ts` exports `useSyncQueue` to drain the offline queue, but nothing mounts it. Submissions made without signal are stored in localStorage and stay there until something calls `drain`.
- The counts of prior bridge incidents and previous runs of a route are not read from any driver record. `DebriefForm` sends `routeTrips90d` as 10 or 0 depending on a familiarity toggle and `priorIncidents` as 0, so two of the nine risk weights never fire on real submissions.
- `src/lib/contacts.ts` and `src/lib/runsheet.ts` are placeholder data and need replacing before anyone acts on them.
- `npm run seed` points at a script that does not exist.

The staged plan and the reasoning behind each deferral are in `docs/ROADMAP.md`.

## Where the rest of the documentation lives

- `docs/ARCHITECTURE.md` — the system as built, the single-workbook store, the offline approach and its real limits, white-labelling, admin authentication, and the migration path to Postgres.
- `docs/RISK-MODEL.md` — every weight, every band threshold, worked examples and what the model cannot claim.
- `docs/POWERBI.md` — build guide for the analysis layer, with the DAX and the report pages.
- `docs/ROADMAP.md` — what is done, what is next, and what is deliberately deferred.
