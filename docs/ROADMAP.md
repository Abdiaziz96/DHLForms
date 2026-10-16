# Roadmap

What is built, what comes next, and what is deliberately being left alone — with the reasoning for each decision, including the ones that amount to "not yet".

This plan is written from the code as it exists. The prototype is narrower than its own screens imply, and a roadmap that assumed otherwise would be fiction.

## Contents

- [Where the project is](#where-the-project-is)
- [Done](#done)
- [Next](#next)
- [Later](#later)
- [Deliberately deferred](#deliberately-deferred)
  - [Photo and OCR capture of paper forms](#photo-and-ocr-capture-of-paper-forms)
  - [Postgres](#postgres)
  - [SharePoint hosting of the workbook](#sharepoint-hosting-of-the-workbook)
  - [In-house CMS or transport management system integration](#in-house-cms-or-transport-management-system-integration)
  - [Background sync for the offline queue](#background-sync-for-the-offline-queue)
  - [A native or installed app](#a-native-or-installed-app)
  - [ANPR, tailgating detection and facial recognition](#anpr-tailgating-detection-and-facial-recognition)
- [The workbook is the integration bus](#the-workbook-is-the-integration-bus)
- [Staged plan](#staged-plan)
- [Open risks](#open-risks)

## Where the project is

Working prototype. A driver can complete a debrief on a phone, the record lands in a single Excel workbook, the risk flag is computed on the server, and a Power BI layer can be built on the output. The data is invented.

It is a supplement to the existing operation, not a replacement for it. It has not been run against real traffic, no real driver or visitor detail should enter it yet, and the route clearances it holds are placeholders.

## Done

| Area | What exists | Where |
| --- | --- | --- |
| Domain model | `SiteRecord`, `COLUMNS` — the column order is a typed contract against the record shape | `src/lib/types.ts` |
| Risk model | Ten weights, three bands, reasons, band labels and operator guidance | `src/lib/risk.ts` |
| Store | Single-workbook read/append, serialised writes, atomic rename, in-memory cache, honest degradation | `src/lib/store.ts` |
| Submission | Open POST with server-side risk recomputation; permissive coercion with a name-and-registration minimum | `src/app/api/records/route.ts`, `src/lib/api.ts` |
| Read and export | Gated GET for records, gated download of the workbook with `scope` and `kind` slices | `src/app/api/records/route.ts`, `src/app/api/export/route.ts` |
| Sample data | Deterministic generator with a stable driver pool, so per-driver patterns emerge | `src/lib/dummy.ts`, `src/app/api/admin/seed/route.ts` |
| Admin authentication | HMAC-signed expiring cookie, verified in middleware, no session store | `src/lib/session.ts`, `src/middleware.ts` |
| Driver forms | Debrief and brief, with signature pad, height check, defect capture and risk feedback | `src/components/DebriefForm.tsx`, `src/components/BriefForm.tsx` |
| Offline capture | Failed submissions are queued in `localStorage`; identity is remembered between visits | `src/lib/client-storage.ts` |
| Navigation | Landing, staff, driver, visitor screens, with contextual contacts and a persistent emergency strip | `src/app/**/page.tsx`, `src/components/` |
| Design tokens | Galvanised-neutral palette, one accent, three risk bands, 44px touch floors, reduced-motion and print support | `src/app/globals.css` |
| White-labelling | Site and app name read from environment variables | `src/lib/site.ts` |
| Service worker | Written, with a stale-while-revalidate shell policy and a hard no-cache rule for `/api/` | `public/sw.js` — **not registered** |

## Next

In the order that gets the most safety value per unit of effort.

**1. Replace the route data.** `src/lib/routes.ts` holds invented bridge names, references and clearances. This is the highest-priority item in the project, above anything on this list. A wrong clearance figure is worse than no figure at all, because it is acted on with confidence. Until the file holds the site's real planned-route data, verified against the current Network Rail and local authority bridge lists, nothing in the app should be shown to a driver as fact.

**2. Make the two weak risk inputs real.** `routeTrips90d` and `priorIncidents` are read from the request body. `DebriefForm` sends a familiarity toggle value and a hardcoded zero, so the unfamiliarity weight is self-declared and the prior-incident weight never fires. Either supply a real driver history, or change the model and the form to stop implying that these two weights are live. A safety score that claims to know something it does not is worse than a simpler score that is honest.

**3. Mount the queue drain.** `useSyncQueue` exists and nothing calls it. Queued submissions sit in `localStorage` indefinitely. Mounting it at the shell level is a small change with a real effect: it is the difference between "we queued your record" and "your record reached the office".

**4. Register the service worker.** `public/sw.js` exists and no file calls `navigator.serviceWorker.register`. Registering it gives the shell caching it describes, plus a web manifest so the app can be added to a home screen. Note that two of the five precached routes, `/safety` and `/map`, do not exist; the `cache.addAll` call is wrapped in a catch, so the install survives, but the list should be corrected at the same time.

**5. Build the admin desk.** `/staff/admin` is linked from `/staff` and does not exist, and the login page it redirects to is missing too. Until both exist, the only way to see the record set or download the workbook is the API. This is the screen the office will actually judge the project on.

**6. Build the missing linked routes.** `/staff/warehouse`, `/visitor/delivering`, `/visitor/collecting`, `/safety` and `/map` are all linked and none resolve. A broken link in front of a driver costs more credibility than a feature that was never mentioned.

**7. Decide retention.** Nothing in the app archives or deletes. The workbook grows without limit, and Power BI will report on all of it. This is a decision for the operation, not a coding task, but it is a precondition for real data entering the file.

## Later

- Postgres. See [the deferral reasoning](#postgres) — the trigger is a decision, not a date.
- Incident recording, so the risk model can be validated. This is the item that turns the score from a hypothesis into something with evidence behind it, and it is the most important thing on this list after the route data.
- SharePoint hosting of the workbook for cloud-to-cloud refresh.
- A licence-check and induction state per driver, which also helps with the driver history in item 2 above.
- Weekly emailed summary to the transport manager, driven by the Power BI dataset.

## Deliberately deferred

Each of these is a decision, not an oversight. The reasoning is recorded so it can be revisited on its merits rather than reopened from scratch.

### Photo and OCR capture of paper forms

**Deferred. Not rejected.**

The proposal is to photograph the existing paper debrief and read the fields off it automatically.

Two arguments against doing it now.

**A written field is cheaper and more accurate than a guessed one.** Asking the driver or the gate staff to type a height and a registration is one tap each on a phone, and the value that arrives is exactly the value intended. Optical character recognition on the same content guesses, and every guess that matters has to be checked. For a field like vehicle registration, a single wrong character produces a record that looks plausible and joins to nothing.

**Handwriting accuracy forces a human review step anyway.** Recognition on a printed form is good. On a completed one, with a height written in a box in the rain by someone in gloves, it is not good enough to trust unattended. So the workflow acquires a review queue, an interface to correct recognised values, and an exception path for the ones that fail — and the volume of records on a site this size does not justify any of it. The prototype's whole premise is that capture takes thirty seconds. A process that ends with somebody checking a photograph takes longer than that.

**The condition under which this changes.** Photograph capture becomes worth building when either the volume of paper forms is large enough that retyping them is a real cost, or when the paper form is the legal record and has to be retained as an image in any case. If the second one is true, capture the image and keep it, but still have the driver confirm the typed values rather than relying on the reading.

### Postgres

**Deferred. The migration path is fully specified and the store is designed for it.**

`src/lib/store.ts` exports `readAll`, `append` and `getById` — the same shape a database implementation would expose. The migration is a one-file change plus a schema, and the details are in `docs/ARCHITECTURE.md`.

Why not now.

**The store is not the bottleneck.** Nobody has been unable to complete a form because the workbook was a spreadsheet. The constraints that matter are the placeholder route data and the two self-reported risk inputs, and neither is fixed by a database.

**Nothing has been run against real traffic.** Committing to a production datastore before the app has a week of real use means guessing at the schema, the indexes and the retention rules.

**Postgres brings the approvals the workbook avoids.** A database is a new system: a host, a backup policy, a network path, an owner and a data protection conversation. The workbook was chosen partly to avoid needing any of that. Migrating to Postgres before the operation has decided it wants the app is trading away the project's main advantage for a performance improvement nobody has asked for.

**The condition under which this changes.** Migrate when one of these is true: a real driver history is required, so the two weak risk inputs can be derived rather than self-reported; the row count makes the whole-file rewrite per append too slow; more than one server process has to run; or the operation decides it wants reports reading live from a system rather than from a file. The first of those is the most likely trigger and the most valuable.

### SharePoint hosting of the workbook

**Deferred. Intended, and specified.**

The plan is to place `site-records.xlsx` in a SharePoint document library so Power BI can refresh cloud-to-cloud without an on-premises data gateway. The data loading steps and the refresh options are in `docs/POWERBI.md`.

Why not yet.

**It needs an owner for the file.** The app writes to `DATA_DIR`, which is a local path. SharePoint hosting means something has to put the file there: either the app points at a synced folder, or a scheduled job copies it, or the office downloads the export and saves it. Each of those is a small commitment by a named person, and until somebody takes it, the arrangement breaks silently the first time it is forgotten.

**A gateway is the alternative and it is worse.** An on-premises data gateway would work today, and it means a gateway install, a service account and a firewall rule. That is exactly the IT approval the workbook exists to avoid.

**The condition under which this changes.** Implement it when the Power BI pages are agreed and someone wants them refreshing without a manual download. Do it at the same time as setting the refresh schedule, not before.

### In-house CMS or transport management system integration

**Deferred. Deferred on principle, not on effort.**

The site has an in-house content management system, and the obvious-looking move is to read contracts, drivers and routes from it and post movements back to it.

Why not.

**Integration would put the project behind an approval queue it does not need to be in.** A read from an internal system means an API key, a service account, a firewall change and a change request. A write back means the operations team owning data they did not ask for, in a schema they did not design. Any of those can stall the project for months, and none of them improves the form.

**The workbook already is the integration.** Contracts are a column. Drivers are a column. Routes are a column. Power BI reads the file. The office opens the file. An analyst can join it to anything else they have, on their own terms, without a single change to either system. That is a real integration, and it requires nobody's permission.

**The condition under which this changes.** Integrate when the operation asks for it because a duplicate-entry cost is being paid elsewhere — for example, if the same movement has to be typed into the CMS as well, or if the contract list changes often enough that the app drifts. Offer the file first, because that usually solves the problem. Never lead with an API.

### Background sync for the offline queue

**Deferred. It cannot be done on the target device.**

iOS Safari does not support the Background Sync API. A driver on an iPhone will not get a queued submission sent while the app is closed, whatever the code says. The comment in `src/lib/client-storage.ts` states this directly, and it is the right call: a feature that works on Android and silently does not work on half the fleet's phones is worse than no feature, because it teaches people to trust something that is not there.

**What is done instead.** The queue drains when the app is open and the browser reports a connection. The operator is told, at the point of submission, that the record is queued rather than saved. That is honest, and it puts the decision in the driver's hands: wait a moment for a bar of signal, or move on knowing the record is on the phone.

**The condition under which this changes.** If the fleet standardises on a platform with working background sync. Even then, the visible-state behaviour should stay, because a driver who does not know whether their record reached the office is the actual problem being solved.

### A native or installed app

**Deferred. A browser is the correct target here.**

Nothing installs, on any device, which is stated on the landing page as a feature. A driver gets a link and uses it. There is no app store, no version skew across devices, no install step to explain at the gatehouse, and no IT involvement in distribution. Adding a manifest and registering the service worker gets most of the home-screen behaviour without any of that.

**The condition under which this changes.** A hard requirement for camera access, background location or reliable offline storage beyond the browser's limits. None is currently on the list, and the two candidates — the deferred photo capture above and anything depending on background sync — are already deferred for their own reasons.

### ANPR, tailgating detection and facial recognition

**Deferred. Out of scope.**

These would mean cameras at the gate, a recognition pipeline, and a category of personal data — biometric templates — that carries legal obligations well beyond anything a prototype should take on. The operation has not asked for them, and the value they add over a typed registration is not established.

**The condition under which this changes.** A request from the operation with a stated operational problem that a typed registration cannot solve. A biometric system is not a form improvement, and it should not arrive through the back door of one.

## The workbook is the integration bus

This is the central architectural decision and it is worth stating as a principle rather than a consequence.

The single output of this project is one Excel workbook. Everything downstream — the office reading it, the analyst building Power BI on it, the transport manager comparing this month with last — consumes that file and nothing else.

Four reasons it is deliberate:

**Nothing new has to be approved by IT.** The file already exists in the workflow. It is a spreadsheet in a folder, the same as the one the debrief currently produces. No new system, no API, no service account, no firewall rule, no change request, no data processing agreement with a new processor. That is what lets a prototype built by a driver be adopted by an office without a project board.

**It meets people where they already are.** The transport office opens spreadsheets. The analyst builds Power BI reports from spreadsheets. Nobody has to learn a new interface to get value out of the data. Adoption is the whole difficulty with a supplement like this, and the file removes most of it.

**It is inspectable.** Anyone can open the workbook, find a row, and check it against what happened on the yard. There is no query layer between the record and the person questioning it. In a safety-adjacent system, that property matters more than performance.

**It survives the app.** If Gatehouse is switched off, the record set remains readable. If the app is rewritten on a database, the export can keep producing the same columns. The file is the durable artifact, and the app is one way of writing into it.

The cost is real and should be stated: a file is not a database. It has no transactions, no concurrent access across processes, no access control, and no retention. The store handles what it can — serialised writes, an atomic rename, honest degradation — and `docs/ARCHITECTURE.md` lists the rest. When the operation is ready to spend the approvals, Postgres is the next step, and the export can keep running alongside it.

## Staged plan

Each stage has an entry condition, so it cannot start until the previous one has actually finished.

### Stage 0 — Prototype (current)

Working, sample data only, no real records.

**Exit condition:** the operation has seen the app and the Power BI pages, and has asked to run it against real traffic.

### Stage 1 — Groundwork

Replace the placeholder route data with verified planned-route clearances. Replace the placeholder contacts. Make the two weak risk inputs real or make the model honest about them. Mount the queue drain. Register the service worker.

**Exit condition:** nothing in the app shows information that is invented, and a queued submission reliably reaches the workbook.

**Do not enter this stage without a named owner for the route data.** It is the one task that cannot be done by a developer working alone.

### Stage 2 — Office-ready

Build the admin desk and the login page. Build the missing linked routes. Decide retention, in writing, and implement whatever is decided.

**Exit condition:** the office can run the day from the app without the API or a developer, and there is a written rule about how long records are kept.

### Stage 3 — Pilot

Run alongside the existing paper process, on one shift or one contract, for a fortnight. Hand the export to Power BI on the current schema. Compare the app's records with the paper records daily.

**Exit condition:** the record set agrees with the paper trail, drivers complete the form without help, and no submission is lost.

### Stage 4 — Production

Real data, real retention, the workbook hosted where Power BI can refresh it, and the four report pages in use by the transport manager. Stop the paper process, or make it the exception path.

**Exit condition:** the transport manager reads the flagged rate weekly and can act on it.

### Stage 5 — Evidence

Add incident recording so bridge strikes and near misses land in the same workbook as the departures preceding them. Then revisit the risk weights against real outcomes.

**Exit condition:** the amber and red bands separate incidents from near misses well enough to justify keeping them, or they do not and the model is re-fitted or simplified.

This stage is the one that turns the risk score from a hypothesis into a control, and no amount of tuning before it substitutes for it. See `docs/RISK-MODEL.md`.

### Stage 6 — Optional, on request only

Postgres, licence and induction state, CMS integration, weekly summary emails. Each has its own reasoning above. None of them should be started without a stated operational problem that it solves.

## Open risks

| Risk | Severity | What is being done |
| --- | --- | --- |
| Placeholder bridge clearances are acted on | High | Nothing yet. `src/lib/routes.ts` is flagged in its own header and in this document. Replacing it is the first task in Stage 1 |
| The high score is mistaken for a validated model | High | The header comment in `src/lib/risk.ts`, `docs/RISK-MODEL.md`, and a note on the leading-indicator report page all state the opposite |
| Real personal data enters the workbook before sign-off | High | Sample data only, driver and visitor names are invented, the workbook is git-ignored, and `README.md` states the condition |
| No retention rule, and the file grows forever | High | Recorded as an open gap in `README.md`. Stage 2 makes the written decision a precondition for production |
| Queued submissions never drain | Medium | `useSyncQueue` is unmodified and unmounted. Stage 1 |
| Single-process store breaks under more than one server | Medium | Documented in `docs/ARCHITECTURE.md`. The migration path to Postgres is specified |
| No admin page, so the record set is API-only | Medium | Stage 2 |
| Two risk weights are effectively inert on real records | Medium | Stage 1 |
| Placeholder contacts are shown to a driver | Medium | Flagged in `src/lib/contacts.ts` and in `README.md` |
| The app is adopted and the workbook is forgotten in a folder | Medium | The export is the only artifact that matters. Stage 4 makes hosting and refresh part of production, not an afterthought |
