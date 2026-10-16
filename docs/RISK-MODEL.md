# The bridge-strike risk model

How a departure gets a risk score in Gatehouse, what every weight and threshold is, and what the score can and cannot be used to claim.

The implementation is `src/lib/risk.ts`. Every number in this document is taken from that file. If the two disagree, the file is right and this document is out of date.

## Contents

- [What this is, and what it is not](#what-this-is-and-what-it-is-not)
- [Where the score is computed](#where-the-score-is-computed)
- [The weights](#the-weights)
- [The bands](#the-bands)
- [Reason strings](#reason-strings)
- [Worked example: a clear departure](#worked-example-a-clear-departure)
- [Worked example: a check departure](#worked-example-a-check-departure)
- [Worked example: a stop departure](#worked-example-a-stop-departure)
- [The bridge warning](#the-bridge-warning)
- [How the weights interact](#how-the-weights-interact)
- [The route data is placeholder, and that matters more than the weights](#the-route-data-is-placeholder-and-that-matters-more-than-the-weights)
- [What this can claim](#what-this-can-claim)
- [What this cannot claim](#what-this-cannot-claim)
- [How it would be validated](#how-it-would-be-validated)
- [Changing the model](#changing-the-model)

## What this is, and what it is not

It is a transparent additive score. Nine conditions are checked, each one that holds adds a fixed number of points, and the total falls into one of three bands. Every point is traceable to a field the operator filled in, so a transport manager can disagree with the result and see exactly which input caused it.

It is a **risk flag, not a prediction**. It does not estimate the probability that a vehicle will hit a bridge. It does not rank drivers or routes by expected harm. It marks a departure as worth a second look, and it separates the one case that must always stop — a declared height greater than a restriction on the planned route — from everything else.

It is **not a trained model**. No data was fitted, no coefficients were estimated, and no validation set was held back. The weights are an unvalidated starting hypothesis, written by someone who knows what a bridge strike involves rather than derived from incident data.

The file itself says all of this in its header comment, and the wording is worth keeping:

> It is a *risk flag*, not a prediction. Do not describe it as predicting strikes. Until incidents are recorded in the same workbook there is nothing to validate the weights against; treat them as a starting hypothesis to be tuned.

The score is a **flag on a record**, not a **clearance to move**. Nothing in this model authorises a vehicle to pass a structure. The legal and practical responsibility for that stays with the driver, the transport office and the site's own risk assessment.

## Where the score is computed

On the server, never on the device.

`POST /api/records` in `src/app/api/records/route.ts` calls `assessRisk()` after coercing the submitted body, then writes `riskScore` and `riskBand` onto the record before appending it. A score the submitting device could set would be worthless as a safety signal, so the client's value is discarded.

Two inputs are read from the request body rather than derived from a record:

```ts
routeTrips90d: Number((body as { routeTrips90d?: number }).routeTrips90d ?? 0),
priorIncidents: Number((body as { priorIncidents?: number }).priorIncidents ?? 0),
```

`routeHasHeightRestriction` and `routeRestrictionMetres`, by contrast, are taken from `routeByRef(record.routeRef)` and not from the body — the client cannot claim a route is unrestricted.

The current form does not supply these two fields from any real driver history. `DebriefForm` sends `routeTrips90d: effectiveDraft.familiar === true ? 10 : 0` and `priorIncidents: 0`. The consequence is stated again under [What this cannot claim](#what-this-cannot-claim): two of the nine weights behave differently in practice from how they read on paper.

## The weights

Taken verbatim from `RISK_WEIGHTS` in `src/lib/risk.ts`.

| Condition | Points | Input it depends on | Exact trigger |
| --- | --- | --- | --- |
| Agency driver | 2 | `basis` | `basis === 'agency'` |
| Subcontracted driver | 1 | `basis` | `basis === 'subcontractor'` |
| Unfamiliar route | 3 | `routeTrips90d` | `routeTrips90d < 3` |
| Tall vehicle | 2 | `runningHeight` | `runningHeight >= 4.4` and `runningHeight < 4.6` |
| Very tall vehicle | 3 | `runningHeight` | `runningHeight >= 4.6` |
| Route passes a height restriction | 2 | `routeHasHeightRestriction` | `routeHasHeightRestriction === true` |
| Height exceeds bridge | 6 | `routeHasHeightRestriction`, `routeRestrictionMetres`, `runningHeight` | restriction present, metres not null, and `runningHeight > routeRestrictionMetres` |
| Prior bridge incident | 2 | `priorIncidents` | `priorIncidents > 0` |
| Delayed | 1 | `delayMinutes` | `delayMinutes > 30` |
| Height not acknowledged | 2 | `routeHasHeightRestriction`, `heightAcknowledged` | restriction present and `heightAcknowledged === false` |

Details that matter and are easy to get wrong:

- **The height weights are mutually exclusive.** A vehicle at 4.75m gets 3, not 5. The check is an `if`/`else if`, with `4.6` tested first.
- **Employment basis is mutually exclusive too.** Agency gets 2, subcontractor gets 1, employed gets 0. Agency is the heavier weight by design: the comment in the file calls agency and subcontracted drivers the dominant factor in bridge strikes.
- **The unfamiliarity check is strict.** Fewer than three previous runs of this route in 90 days scores. Three or more does not. A driver with exactly three runs is treated as familiar.
- **The delay check is strict.** `delayMinutes > 30`. Exactly 30 minutes scores nothing.
- **The prior-incident weight does not scale.** One prior incident and five prior incidents both score 2. The reason string differs; the points do not.
- **The height-exceeds-bridge comparison is strict.** `runningHeight > routeRestrictionMetres`. A 4.4m vehicle against a 4.4m signed bridge does not score the 6, because the vehicle is not taller than the restriction. Margins are what the tall and very tall weights exist for.
- **Height-exceeds-bridge requires a non-null restriction.** `routeRestrictionMetres !== null` is part of the condition, so a route marked as restricted but with no figure cannot produce the 6 — it produces the 2 for `routeRestricted` and the height band if the vehicle is tall enough.
- **The unacknowledged-height weight only applies on a restricted route.** A driver who never ticks the acknowledgement on an unrestricted route scores nothing for it.

The highest score the model can produce in one record is 21, with every condition firing at its highest: agency (2), unfamiliar (3), very tall (3), route restricted (2), height exceeds bridge (6), prior incident (2), delayed (1), unacknowledged height (2). The lowest is 0.

## The bands

From `RISK_BANDS` and the band expression in `assessRisk`:

| Band | Condition | Label | Score range | Operator guidance |
| --- | --- | --- | --- | --- |
| Green | `score < 3` | Clear | 0 to 2 | Nothing to acknowledge. Carry on to the vehicle. |
| Amber | `score >= 3 && score < 7` | Check | 3 to 6 | Confirm your running height before you move. |
| Red | `score >= 7` | Stop | 7 to 21 | Do not move off. Tell the transport office first. |

The bands are computed from the total only. No individual weight can force a band on its own except `heightExceedsBridge`, which at 6 points with any other condition present reaches 7. On a route with a restriction and an unacknowledged height, the 6 and the 2 already produce a red. A vehicle over a bridge restriction on an unrestricted route cannot happen — the condition requires the route flag — so the 6 always arrives alongside at least the 2 for the restriction, making the effective minimum for that case 8.

The labels and the guidance shown to the operator live in `BAND_LABEL` and `BAND_GUIDANCE`. The comment on `BAND_LABEL` is the reason to keep them exported: every surface uses the same wording, so "Check" means one thing across the app and the workbook.

The band boundaries are the equivalent of the weights being a hypothesis. `RISK_BANDS = { amber: 3, red: 7 }` is described in the file as tuned so a familiar employed driver in a standard vehicle stays green. That is a reasonable design target, and it is not evidence that the boundaries separate anything in the real world. Anyone re-tuning them should expect to move both numbers.

## Reason strings

`assessRisk` returns `reasons: string[]` in the order the contributions were evaluated, so a manager reading the record sees the points in the order they were added. Three exceptions are worth knowing:

| Weight | Reason string |
| --- | --- |
| Agency driver | `Agency driver` |
| Subcontracted driver | `Subcontracted driver` |
| Unfamiliar route, zero trips | `First time on this route` |
| Unfamiliar route, one or two trips | `Fewer than 3 runs of this route` |
| Very tall vehicle | `Vehicle {height}m — very tall`, height to two decimals |
| Tall vehicle | `Vehicle {height}m — tall`, height to two decimals |
| Route restricted | `Route passes a height restriction` |
| Height exceeds bridge | `Vehicle is taller than a bridge on the planned route` — inserted at the **front** of the list with `unshift`, not appended |
| One prior incident | `1 prior bridge incident` |
| More than one | `{n} prior bridge incidents` |
| Delayed | `Departing {n} min late` |
| Unacknowledged height | `Height not yet acknowledged` |

The `unshift` on the bridge case is deliberate: when a vehicle is taller than a structure on its planned route, that is the first thing on the record, not the twelfth. Its position does not change the score.

The reasons are **not written to the workbook**. `COLUMNS` in `src/lib/types.ts` has no reasons column. They are returned in the `POST /api/records` response body as part of `risk`, and rendered by `RiskNotice` on the operator's device. Once the record is a row in the spreadsheet, only `Risk Score`, `Risk Band` and `Bridge Warning` survive. An analyst working in Power BI sees the score and the band, not the breakdown.

## Worked example: a clear departure

An employed driver, familiar with the route, in a 3.8m rigid, on R1, leaving on time, height acknowledged.

| Condition | Fires? | Points |
| --- | --- | --- |
| Agency driver (2) | No — employed | 0 |
| Subcontracted driver (1) | No | 0 |
| Unfamiliar route (3) | No — 22 previous runs | 0 |
| Tall vehicle (2) | No — 3.8m | 0 |
| Very tall vehicle (3) | No | 0 |
| Route restricted (2) | No — R1 has `restrictionMetres: null` | 0 |
| Height exceeds bridge (6) | No — R1 has no restriction | 0 |
| Prior incident (2) | No | 0 |
| Delayed (1) | No — 5 minutes late | 0 |
| Height not acknowledged (2) | No — R1 is unrestricted, so this cannot fire anyway | 0 |
| **Total** | | **0 — green, Clear** |

Result: `Nothing to acknowledge. Carry on to the vehicle.`

This is the case the model was tuned to keep in green, and it is the majority of departures on a functioning site. A model that flags everything trains people to ignore it.

## Worked example: a check departure

An employed driver who has run the route once before, in a 4.75m trailer, on R3 (Hallen lane aqueduct, signed 4.9m), 40 minutes late, and the height has not been acknowledged.

| Condition | Fires? | Points |
| --- | --- | --- |
| Agency driver (2) | No — employed | 0 |
| Subcontracted driver (1) | No | 0 |
| Unfamiliar route (3) | Yes — 1 run in 90 days is fewer than 3 | 3 |
| Tall vehicle (2) | No — the `>= 4.6` branch is tested first | 0 |
| Very tall vehicle (3) | Yes — 4.75 ≥ 4.6 | 3 |
| Route restricted (2) | Yes — R3 carries a 4.9m structure | 2 |
| Height exceeds bridge (6) | No — 4.75 is not greater than 4.90 | 0 |
| Prior incident (2) | No | 0 |
| Delayed (1) | Yes — 40 > 30 | 1 |
| Height not acknowledged (2) | Yes — restricted route and not acknowledged | 2 |
| **Total** | | **11 — red, Stop** |

Result: `Do not move off. Tell the transport office first.`

Reasons, in order: `Fewer than 3 runs of this route`, `Vehicle 4.75m — very tall`, `Route passes a height restriction`, `Departing 40 min late`, `Height not yet acknowledged`.

An amber version of the same situation: change `delayMinutes` to 15 and set `heightAcknowledged` to true. Height still exceeds nothing, so the total drops to 8 — still red. To reach amber, drop the route to R1 as well, which removes the restriction weight and the acknowledgement weight: 3 + 3 = 6, amber. A tall unfamiliar vehicle on an unrestricted motorway route is a check, not a stop. That is the boundary behaving sensibly.

## Worked example: a stop departure

An agency driver, familiar with the route, in a 4.4m trailer, on R4 (Olveston village bridge, signed 4.2m), 10 minutes late, height acknowledged.

| Condition | Fires? | Points |
| --- | --- | --- |
| Agency driver (2) | Yes | 2 |
| Subcontracted driver (1) | No — mutually exclusive with agency | 0 |
| Unfamiliar route (3) | No — 30 previous runs | 0 |
| Tall vehicle (2) | Yes — 4.4 is ≥ 4.4 and < 4.6 | 2 |
| Very tall vehicle (3) | No | 0 |
| Route restricted (2) | Yes — R4 carries a 4.2m structure | 2 |
| Height exceeds bridge (6) | **Yes** — 4.4 > 4.2 | 6 |
| Prior incident (2) | No | 0 |
| Delayed (1) | No — 10 minutes is not > 30 | 0 |
| Height not acknowledged (2) | No — acknowledged | 0 |
| **Total** | | **12 — red, Stop** |

Result: `Do not move off. Tell the transport office first.` with the bridge warning shown first.

Reasons, in order: `Vehicle is taller than a bridge on the planned route` (unshifted to the front), `Agency driver`, `Vehicle 4.40m — tall`, `Route passes a height restriction`.

This case is not really a score at all. The file's comment on it is the clearest statement of intent in the model:

> The one case that must always block. A declared height over the restriction is not a risk score, it is a known collision on the planned route.

It is a stated conflict between two numbers the app holds: the height the driver declared and the clearance on the route the driver selected. Whatever else is going on in the record, that conflict is worth more than every other weight combined.

## The bridge warning

When the height-exceeds-bridge condition fires, `assessRisk` populates `bridgeWarning` on the assessment:

```ts
bridgeWarning = {
  bridgeName: '',                          // always empty here
  restrictionMetres: input.routeRestrictionMetres,
  vehicleMetres: input.runningHeight,
};
```

Note that `bridgeName` is set to an empty string inside `assessRisk`. The name is not part of the risk input, so the function cannot populate it. The readable name is added by the caller. In `POST /api/records`:

```ts
const bridgeWarning =
  assessed.bridgeWarning && route?.restrictionName
    ? `${route.restrictionName} — signed ${route.restrictionMetres?.toFixed(1)}m, vehicle ${record.runningHeight.toFixed(2)}m`
    : '';
```

So the workbook's `Bridge Warning` column holds a string such as `Pilning station bridge — signed 4.4m, vehicle 4.60m`, or is blank. If the route has no `restrictionName`, the column is blank even when the condition fired — which is why both the restriction and its name matter in `src/lib/routes.ts`.

The warning is a formatted sentence, not a structured value. Power BI can count the non-blank ones, which is the useful measure, but cannot parse the clearance out of it without text work. `Height (m)` and the route lookup are the reliable inputs for that.

## How the weights interact

Some observations that follow from reading the conditions as written, and which anyone re-tuning the model should have in view.

**The height-exceeds-bridge case is counted twice, and that is defensible.** It adds 6 for the conflict, and on a route with a restriction it also sits alongside the 2 for `routeRestricted`. So the deliberate double count pushes the case deeper into red, which is the intent.

**The unacknowledged-height weight can stack on top of the exceedance.** When a vehicle is over a bridge restriction *and* the height has not been acknowledged, both fire: 6 + 2 + 2 = 10 before anything else. That is the most dangerous combination the model can describe, and it is scored as such.

**Agency status and unfamiliarity overlap in the real world.** They are separate weights because they are separate inputs, but the same driver often trips both. Since the dummy generator gives agency and subcontracted drivers between 0 and 5 previous runs, it produces that overlap constantly. Whether the two conditions should be additive or one should be conditioned on the other is exactly the kind of question that needs incident data to answer.

**A restricted route is penalised whether or not the driver is over it.** Any departure on R2, R3, R4 or R5 takes 2 for the restriction. That is a route-exposure weight, not a driver-behaviour weight, and it means the site's amber rate is partly a function of which routes are in use that week. The Power BI page that breaks down by route exists to make that visible — see `docs/POWERBI.md`.

**The model cannot tell a false declaration from a true one.** Everything starts with the declared height. A driver who under-declares at 4.0m when the trailer is 4.4m takes the tall-vehicle weight off and may take the exceedance off with it. No scoring rule fixes this. The acknowledgement step, the physical marker on the trailer and the transport office are the controls for it, not the score.

## The route data is placeholder, and that matters more than the weights

`src/lib/routes.ts` opens with this:

> PLACEHOLDER DATA. The bridge names, road references and clearances below are invented for the prototype and must be replaced with the site's actual planned-route data (and verified against the current Network Rail and local authority bridge lists) before anything in here is shown to a driver as fact. **A wrong clearance figure is worse than no figure at all.**

That last sentence is the most important line in the codebase, and it is worth spelling out why.

A missing clearance makes a driver slow down, ask, and look for the sign. A *wrong* clearance — a figure that is too high, or a bridge that is not on the list, or a route described as clear when a structure sits on it — is acted on with confidence. The entire point of the model is that it holds two reliable numbers and compares them. If the route figure is invented, the comparison is meaningless, and the 6-point flag fires on fabricated data or, worse, fails to fire.

The concrete state of the data:

| Ref | Name | `restrictionMetres` | `restrictionName` | Consequences for the model |
| --- | --- | --- | --- | --- |
| R1 | Severn Beach — Avonmouth loop | `null` | `null` | Never contributes restriction weights. Cannot produce a warning |
| R2 | Severn Beach — Pilning & Easter Compton | 4.4 | Pilning station bridge | Fires restriction and warning. Any height above 4.4m is over it |
| R3 | Severn Beach — Hallen & Lawrence Weston | 4.9 | Hallen lane aqueduct | Fires restriction; warning above 4.9m |
| R4 | Severn Beach — Aust & Olveston | 4.2 | Olveston village bridge | The lowest restriction. Anything above 4.2m is over it |
| R5 | Severn Beach — Avonmouth docks shuttle | 5.1 | Dock estate gantry | Fires restriction; never produces a warning at fleet heights |

The names, references, road descriptions and clearances in that table are invented. So are the contract names in `src/lib/site.ts` and the runsheet in `src/lib/runsheet.ts`. None of it should be acted on.

There is also a structural limit independent of the figures. The model stores **one** restriction per route: the lowest structure on the planned line. A route with a 4.4m bridge at the start and a 4.2m bridge near the end is described only by the 4.2m, and the warning names only that one structure. That is a reasonable simplification for a flag, and it is not a substitute for a proper route survey. Until the route data is replaced with the site's real planned-route data, verified against current Network Rail and local authority bridge lists, the whole model is a demonstration that the mechanism works, not a safety control.

The same caution applies to `src/lib/contacts.ts`, which is invented and needs every entry replaced before it is shown to a driver.

## What this can claim

- **It can say a specific input was recorded.** A departure has a declared height, a route, a basis, an acknowledgement, a delay and a prior-incident count, and each of them is a column or an input to one.
- **It can identify a stated conflict.** When the declared height is greater than the restriction on the selected route, the numbers disagree and the record says so. This is arithmetic, not inference.
- **It can produce a consistent, explainable flag.** The same inputs always produce the same score, the reasons are returned with it, and any manager can reconstruct the total by hand. That is the property that makes it arguable, which is the point.
- **It can produce a rate.** The share of departures in amber or red, tracked over time, is a usable leading indicator — and the only measure in this project that looks like one. See `docs/POWERBI.md`.
- **It can be used to start a conversation.** "This departure scored 12; here is why" is a workable basis for a debrief with a driver or a training conversation with an agency.

## What this cannot claim

- **It cannot predict a bridge strike.** There is no probability attached to any score, and none could be computed without incident data.
- **It cannot be validated yet.** This is the central limitation. Validation needs outcomes — bridge strikes and near misses recorded against the departures that preceded them. The workbook records no incidents. `SiteRecord` has `defectFlagged` and `defectNote`, which cover vehicle defects, and neither is a bridge strike or a near miss. Until incident rows exist in the same workbook, with the same keys, there is nothing to check the weights against, and the honest position is that they are a hypothesis.
- **It cannot claim the weights are right, or even in the right order.** Agency status at 2 and unfamiliarity at 3 is a judgement about which matters more. It may be wrong. Skipping the post-migration statistics, no one has tested it.
- **It cannot claim the bands are right.** `amber: 3`, `red: 7` were chosen so a familiar employed driver stays green. That is a design target, not a finding. Moving either boundary changes what the headline indicator means, so both should be frozen for a period before anyone reads a trend from them.
- **It cannot stand behind two of its own inputs.** `routeTrips90d` comes from a single self-reported familiarity toggle and `priorIncidents` is always sent as 0. In the current build, the unfamiliarity weight is really a self-declaration, and the prior-incident weight never fires on a real submission. The dummy data generator *does* exercise both, so the model appears healthier in the sample data than it is in use.
- **It cannot withstand bad route data.** As set out above, this is the largest single risk in the model, and it has nothing to do with the weights.
- **It cannot verify the declared height.** The model's most important input is the one thing it cannot check.
- **It cannot account for conditions the record does not hold.** Weather, light, diversion due to an incident, roadworks that push a driver under an unplanned structure, fatigue, and mechanical failure are all absent. Some of them are more likely to cause a strike than the factors that are scored.
- **It cannot be treated as a control.** It is a flag on a form. The controls are the trailer height marker, the published bridge list, the route survey, driver training and the transport office's own procedures.
- **It cannot be used to judge an individual without care.** A driver with one prior incident and 2 unfamiliar runs scores 5 more than a colleague on identical work. That is the model working as designed, and it is also an employment-sensitive use of an unvalidated score. Any use beyond flagging a departure for review needs a conversation with whoever owns the driver relationship, not a dashboard.

## How it would be validated

A validation study needs three things the workbook does not currently provide.

1. **Outcomes.** Bridge strikes and near misses, recorded as rows in the same workbook, with the same `Operator Ref`, `Vehicle Reg`, `Route` and a date. `RecordKind` already includes `brief` and `debrief`; an incident type would need adding to the union and to the column mapping before it could be stored.
2. **Volume.** Strikes are rare. Near misses are the more useful signal, and they are only recorded if it is easy and blameless to record them. A rate of a few tens per thousand departures means months of data before any weight can be estimated with any confidence.
3. **A decision about what is being predicted.** Whether the outcome is a strike, a near miss, or a reported height conflict changes which weights should matter. The model currently behaves as if all three were the same thing.

With those, the analysis is straightforward: take the flagged departures, look at the outcome rate in green, amber and red, and see whether the bands separate. If they do not, the weights need re-fitting or the model needs fewer, better inputs. Until then, the correct description of this model in any document, slide or conversation is **an unvalidated risk flag**.

## Changing the model

Weights live in one place, `RISK_WEIGHTS`, and the bands in `RISK_BANDS`. The comment on the weights block states the intent: they live in one place so they can be adjusted without touching the UI.

Rules for anyone changing them:

1. **Change the file, then this document.** Every number in this document is a copy. A diverged copy is worse than no document.
2. **Do not change the bands while anyone is reading a trend.** The amber-or-red rate per 100 is the headline leading indicator. Moving a boundary redefines the number retroactively, and every week-on-week comparison in Power BI becomes invalid without anyone noticing.
3. **Keep the reasons.** A weight whose contribution cannot be explained will be removed by the first transport manager who sees an amber they disagree with — reasonably.
4. **Re-check the highest achievable score.** The maximum is 21 today, and any new weight changes what `red` means in practice.
5. **Do not add a weight that depends on a field the workbook does not hold.** `assessRisk` takes a `RiskInput` built from record fields; a weight on something untracked would be unexplainable when the record is read back.
