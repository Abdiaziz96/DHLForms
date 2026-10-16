# Power BI build guide

How to turn `site-records.xlsx` into the four report pages the transport office actually uses.

This guide covers loading the workbook, the transformations it needs, a star schema to model it on, the complete DAX measure set, and the layout of each page. Every measure is written out as DAX rather than described, so the whole thing can be built by copying in order.

The workbook is the integration layer. Nothing here requires the app to change, and nothing here requires a database. See `docs/ARCHITECTURE.md` for why that matters, and `docs/ROADMAP.md` for how SharePoint hosting of the file is intended to work.

## Contents

- [Before you start](#before-you-start)
- [Data protection](#data-protection)
- [Loading the workbook](#loading-the-workbook)
- [Required transformations](#required-transformations)
- [The star schema](#the-star-schema)
- [Relationships](#relationships)
- [The Date table](#the-date-table)
- [Other dimension tables](#other-dimension-tables)
- [The measure table](#the-measure-table)
- [Core measures](#core-measures)
- [The headline leading indicator](#the-headline-leading-indicator)
- [Cohort measures](#cohort-measures)
- [Vehicle and height measures](#vehicle-and-height-measures)
- [Breakdown measures](#breakdown-measures)
- [A driver ranking table](#a-driver-ranking-table)
- [Report page 1: exposure overview](#report-page-1-exposure-overview)
- [Report page 2: bridge-strike leading indicator](#report-page-2-bridge-strike-leading-indicator)
- [Report page 3: contract and route breakdown](#report-page-3-contract-and-route-breakdown)
- [Report page 4: driver cohort](#report-page-4-driver-cohort)
- [Scheduled refresh](#scheduled-refresh)
- [What the reports cannot tell you](#what-the-reports-cannot-tell-you)

## Before you start

Three things to settle before building anything.

**Freeze the workbook shape.** The report is built on the 25 columns in `COLUMNS` from `src/lib/types.ts`. If a column is renamed, reordered or removed, every query in this guide breaks. Agree the shape first, then build.

**Decide whether sample data or live data is being modelled.** They must never be mixed in one file. If you are building against sample data, use a copy of the workbook that contains only sample rows, and label the report pages as such. A dashboard built on invented names that later gets its data source swapped is a dashboard nobody trusts.

**Install Power BI Desktop, and a gateway later.** Desktop is enough to build. Publishing to a workspace with a scheduled refresh over a file source needs either the file in SharePoint or OneDrive, or an on-premises data gateway. See [Scheduled refresh](#scheduled-refresh).

## Data protection

The workbook holds driver names, payroll or agency references, vehicle registrations and visitor names. The report is a second copy of that data with a wider audience, so decide the following before publishing anything.

- **Sample data only, until sign-off.** The app ships with invented records. Build the report against those, agree the pages and the measures, and only connect real data once the operation has signed off retention and access. Nothing about building the report is urgent enough to skip this.
- **Minimise what the report shows.** Driver references do not need to be on a page a site manager opens. Vehicle registrations do not need to be on an overview. Show the minimum that answers the page's question.
- **Row-level security if the report is shared.** Power BI can restrict rows by role. On a small site the cheaper control is separate reports with separate datasets, or not showing the driver-level page outside the transport manager's report.
- **The dataset imports the whole workbook.** Depending on your refresh mode, Power BI stores a copy of every row. That copy lives in the Power BI workspace, with its own access list and its own retention. It is a second location for the same personal data, and it should be named in whatever retention decision the operation makes.
- **Retention.** The workbook grows without limit because nothing in the app archives or deletes a record. Power BI will happily report on five years of rows. Set a retention period, and if the app cannot enforce it, apply it in the load query with a filter on `Date`.

## Loading the workbook

**Get Data → Excel workbook**, then pick the file and select the `Records` table from the Navigator. Do not select the sheet by name only: naming the table means Power Query still resolves if someone adds a worksheet.

If the workbook lives on SharePoint or OneDrive and is synced locally, use the file path form instead — **Get Data → SharePoint folder** or **Get Data → Web** — because the local path on your machine will not exist on the refresh machine. See [Scheduled refresh](#scheduled-refresh).

The workbook on disk has no named table. If Power BI offers only the worksheet, select it and promote the headers in Power Query, which the next section covers.

## Required transformations

Name the query `Records`. Select **Transform Data** and apply these steps in order. Do not skip the type steps — the report measures depend on them, and Power BI's automatic type detection will guess `Text` for most of these columns.

### 1. Promote and clean the header

The file is written with a styled header row in row 1 and a frozen pane. Power Query usually detects it; if not:

```m
= Table.PromoteHeaders(Source, [PromoteAllScalars = true])
```

Then remove any fully blank rows, which Excel writes for stray formatting:

```m
= Table.SelectRows(#"Promoted Headers", each [Record ID] <> null and [Record ID] <> "")
```

### 2. Set the column types

Text types are `type text`. The three numeric types matter most.

| Column | Type | M code |
| --- | --- | --- |
| Record ID | Text | `Table.TransformColumnTypes(#"…", {{"Record ID", type text}})` |
| Type | Text | `…, {"Type", type text}` |
| Date | Date | `…, {"Date", type date}` |
| Time | Text, then converted | see step 3 |
| Operator | Text | |
| Operator Ref | Text | |
| Basis | Text | |
| Company | Text | |
| Vehicle Reg | Text | |
| Trailer No | Text | |
| Contract | Text | |
| Height (m) | Decimal number | `…, {"Height (m)", type number}` |
| Direction | Text | |
| Route | Text | |
| Delay (min) | Whole number | `…, {"Delay (min)", type number}` |
| Defect | Text | |
| Defect Note | Text | |
| Height Ack | Text | |
| Risk Score | Whole number | `…, {"Risk Score", type number}` |
| Risk Band | Text | |
| Bridge Warning | Text | |
| Security | Text | |
| Security Sign | Text | |
| Notes | Text | |
| Submitted At | Text | |

Two type rules worth stating explicitly:

- **`Vehicle Reg` and `Operator Ref` stay text.** Power BI will infer a number for a reference made only of digits. `GH-` IDs and registrations with letters are safe, but `Operator Ref` can be numeric-looking and truncated leading zeros are unrecoverable.
- **`Date` becomes a real `date`, not text.** Every time-based measure in this guide depends on it. As text, `TODAY() - 6` comparisons fail silently and return blank.

### 3. Split and type the time columns

`Time` is written by the app as `HH:MM`. It is cleaner to convert it to a real duration than to leave it as text, because a text column sorts `"9:05"` after `"10:30"`.

Add a step:

```m
= Table.AddColumn(#"Changed Type", "TimeValue", each
    let
        parts = Text.Split([Time], ":"),
        h = if List.Count(parts) >= 1 then Number.FromText(parts{0}) else 0,
        m = if List.Count(parts) >= 2 then Number.FromText(parts{1}) else 0
    in
        #duration(0, h, m, 0), type duration)
```

Then set the type and remove the original:

```m
= Table.TransformColumnTypes(#"Added TimeValue", {{"TimeValue", type duration}})
```

Rename `TimeValue` to `Time` and delete the text column of the same name first, so there is exactly one. `Security Sign` is `HH:MM` or blank; leave it as text — an unparseable blank in a duration column becomes an error.

### 4. Calculated columns for the analysis

Add these three in Power Query rather than in DAX, so they are typed before the model sees them.

```m
// 1. Delay as a number with no errors
= Table.AddColumn(#"Time typed", "DelayMinutes", each
    if [Delay (min)] = null then 0 else Number.From([Delay (min)]), Int64.Type)

// 2. A sortable flag for the leading indicator
= Table.AddColumn(#"DelayMinutes", "IsFlagged", each
    if [Risk Band] = "amber" or [Risk Band] = "red" then 1 else 0, Int64.Type)

// 3. A missing-height flag, because a blank height cannot be scored
= Table.AddColumn(#"IsFlagged", "HeightMissing", each
    if [Height (m)] = null or [Height (m)] = 0 then 1 else 0, Int64.Type)
```

Name the column `DelayMinutes`, not `Delay (min)`. Parentheses and spaces in a column name force every DAX reference to be wrapped in brackets and quotes, and they make a measure harder to read. Every measure in this guide refers to `Records[DelayMinutes]`; the raw workbook column is `Delay (min)`, and `DelayMinutes` is the typed copy of it.

`IsFlagged` duplicates what a DAX measure can compute from `Risk Band`, and it is still worth having: a physical column is faster than a measure on every visual, and it makes the filter in a DAX query obvious to whoever reads it later.### 5. Filter to movements

If the workbook is ever seeded with a mixture of record types, decide now whether the reports cover all of them. The bridge-strike measures only make sense for records that have a route and a height. Either:

- filter the query to `Type` in `{"debrief","brief"}`, or
- keep every row and accept that the height measures need a filter.

The measure set below assumes the query holds **every** row and states explicitly which measures filter by type. That is the safer default, because a report that silently drops rows is harder to debug than one that states its filters.

## The star schema

The workbook is a single flat table. Model it as a star:

```
                        Date
                         │
                         │
  Route ────────────  Records  ──────────── Contract
  (R1..R5)              (fact)              (8 names)
                         │
                         │
                    Operator ──── Vehicle
                    (DriverKey)   (RegKey)

                    RiskBand  (bridge/leaf table)
```

| Table | Kind | Grain | Source |
| --- | --- | --- | --- |
| `Records` | Fact | One row per movement | The workbook, unchanged |
| `Date` | Dimension | One row per calendar day | Calculated, below |
| `Route` | Dimension | One row per route | Entered by hand or derived from `Records` |
| `Contract` | Dimension | One row per contract | Derived from `Records` |
| `Operator` | Dimension | One row per `Operator Ref` | Derived from `Records` |
| `Vehicle` | Dimension | One row per registration | Derived from `Records` |
| `RiskBand` | Dimension | Three rows | Entered by hand |

### Why dimensions and not just the flat table

Three reasons that apply here and not generally.

- **The route attributes are not in the workbook.** `restrictionMetres` and `restrictionName` live in `src/lib/routes.ts` and are not exported as columns. A `Route` dimension is where they go, so a report can show which routes carry a restriction without parsing `Bridge Warning` text.
- **The risk band needs a sort order.** `green`, `amber` and `red` sort alphabetically as `amber`, `green`, `red`. A `RiskBand` dimension supplies a `BandOrder` column.
- **A driver dimension is where the real history belongs.** `Operator Ref` is the only field that cannot be prefilled, and it is the join key to any future driver record. Keeping it as a dimension makes the eventual move to a real driver table a change to one table rather than to every measure.

### Creating the dimension tables

Each of these is a DAX calculated table. They all need `Records` loaded first.

```dax
Route =
VAR RouteRows =
    SUMMARIZE ( Records, Records[Route] )
RETURN
    SELECTCOLUMNS (
        FILTER ( RouteRows, Records[Route] <> "" ),
        "Route", Records[Route]
    )
```

Then add the restriction attributes by hand in the table editor, because they are not in the workbook:

| Route | Route name | Restriction (m) | Restriction name |
| --- | --- | --- | --- |
| R1 | Severn Beach — Avonmouth loop | (blank) | (blank) |
| R2 | Severn Beach — Pilning & Easter Compton | 4.4 | Pilning station bridge |
| R3 | Severn Beach — Hallen & Lawrence Weston | 4.9 | Hallen lane aqueduct |
| R4 | Severn Beach — Aust & Olveston | 4.2 | Olveston village bridge |
| R5 | Severn Beach — Avonmouth docks shuttle | 5.1 | Dock estate gantry |

**These figures are placeholder data from `src/lib/routes.ts`.** They are invented for the prototype. If the report shows a route as clear, or a vehicle as under a restriction, that statement is only as good as this table. Replace it with the site's verified planned-route data before anyone acts on it, and say so on the page while it is placeholder.

```dax
Contract = SUMMARIZECOLUMNS ( Records[Contract] )
```

```dax
Operator =
VAR Ops =
    SUMMARIZE ( Records, Records[Operator Ref], Records[Operator], Records[Basis] )
RETURN
    SELECTCOLUMNS (
        FILTER ( Ops, Records[Operator Ref] <> "" ),
        "Operator Ref", Records[Operator Ref],
        "Operator", Records[Operator],
        "Basis", Records[Basis]
    )
```

`SUMMARIZE` here groups by three columns, so a driver who changed name or basis over the period appears more than once. On sample data that does not happen. On real data, decide whether `Operator Ref` or the name is the identity, and adjust.

```dax
Vehicle =
SELECTCOLUMNS (
    FILTER ( SUMMARIZE ( Records, Records[Vehicle Reg] ), Records[Vehicle Reg] <> "" ),
    "Vehicle Reg", Records[Vehicle Reg]
)
```

```dax
RiskBand =
DATATABLE (
    "Risk Band", STRING,
    "BandOrder", INTEGER,
    "Band label", STRING,
    {
        { "green", 1, "Clear" },
        { "amber", 2, "Check" },
        { "red",   3, "Stop"  }
    }
)
```

Then sort `RiskBand[Risk Band]` by `RiskBand[BandOrder]`. The labels are the same wording the app shows the driver, from `BAND_LABEL` in `src/lib/risk.ts`, so the report and the phone agree.

## Relationships

In Model view, create these. All are one-to-many, single-direction, from dimension to fact.

| From | To | Key | Cardinality | Notes |
| --- | --- | --- | --- | --- |
| `Date[Date]` | `Records[Date]` | Date | 1 to many | Active. The only date column in the workbook |
| `Route[Route]` | `Records[Route]` | Route | 1 to many | Make the relationship active on `Route`, and keep `Route name` in the same table |
| `Contract[Contract]` | `Records[Contract]` | Contract | 1 to many | |
| `Operator[Operator Ref]` | `Records[Operator Ref]` | Text | 1 to many | |
| `Vehicle[Vehicle Reg]` | `Records[Vehicle Reg]` | Text | 1 to many | |
| `RiskBand[Risk Band]` | `Records[Risk Band]` | Text | 1 to many | |

Three modelling notes:

- **Turn off Auto date/time.** **File → Options → Data load → Time intelligence → Auto date/time**, untick it, then refresh. Otherwise Power BI creates a hidden date table per date column and the model becomes confusing.
- **There is only one date.** The workbook holds `Date` and `Submitted At`, and `Submitted At` is an ISO timestamp of the same moment. A second date column would create an ambiguous relationship with `Date`. If you need time-of-day analysis, use the `Time` column, not a second date table.
- **`Direction` is a filter, not a dimension.** Two values, no attributes, no reason for a table. Put it in a slicer and let it filter the fact.

## The Date table

Create it with DAX so it always covers the data present:

```dax
Date =
VAR FirstDate = MIN ( Records[Date] )
VAR LastDate  = MAX ( Records[Date] )
RETURN
    ADDCOLUMNS (
        CALENDAR ( FirstDate, LastDate ),
        "Year",           YEAR ( [Date] ),
        "Month number",   MONTH ( [Date] ),
        "Month",          FORMAT ( [Date], "mmm yyyy" ),
        "Month sort",     YEAR ( [Date] ) * 100 + MONTH ( [Date] ),
        "Weekday number", WEEKDAY ( [Date], 2 ),
        "Weekday",        FORMAT ( [Date], "ddd" ),
        "Week start",     [Date] - WEEKDAY ( [Date], 2 ) + 1,
        "Week label",     "w/c " & FORMAT ( [Date] - WEEKDAY ( [Date], 2 ) + 1, "dd mmm" ),
        "Quarter",        "Q" & QUARTER ( [Date] ) & " " & YEAR ( [Date] ),
        "Is weekend",     IF ( WEEKDAY ( [Date], 2 ) >= 6, TRUE, FALSE )
    )
```

Then:

- Mark it as the date table: **Table tools → Mark as date table → `Date`**.
- Sort `Month` by `Month sort`, and `Weekday` by `Weekday number`.
- Add a `Is in last 7 days` column if you prefer a slicer to a measure:

```dax
= IF ( [Date] >= TODAY () - 6 && [Date] <= TODAY (), TRUE, FALSE )
```

The `Week start` column is what makes week-on-week comparisons stable. Using `Date[Date]` directly in a `DATESINPERIOD` gives a rolling window, which is fine for a trend and wrong for "this week versus last week". The measures below use both, and each states which it is.

## The measure table

Create an empty table to hold the measures, so they do not clutter the fact table. **Home → Enter Data**, name it `_Measures`, load it with a single dummy column, then hide that column.

Do not put these measures on `Records`. A measure lives where it is found, and in six months nobody will look for `Flagged per 100` under a data table.

## Core measures

### Total departures

```dax
Total departures =
COUNTROWS ( Records )
```

*Decision it supports:* the denominator. Every rate on every page is this number, and a rate built on a thin denominator should not be read.

If you want to exclude visitor records from the bridge-strike pages, use the filtered variant instead:

```dax
Driver departures =
CALCULATE (
    COUNTROWS ( Records ),
    FILTER ( Records, Records[Type] = "debrief" || Records[Type] = "brief" )
)
```

### Departures in the last 7 days

```dax
Departures last 7 days =
CALCULATE (
    COUNTROWS ( Records ),
    FILTER ( ALL ( Date[Date] ), Date[Date] >= TODAY () - 6 && Date[Date] <= TODAY () )
)
```

*Decision it supports:* tells the reader whether anything is actually happening before they judge the rate below it.

### Amber-or-red departures

```dax
Amber or red departures =
CALCULATE (
    COUNTROWS ( Records ),
    FILTER ( Records, Records[Risk Band] = "amber" || Records[Risk Band] = "red" )
)
```

*Decision it supports:* the numerator of the headline indicator. On its own it is a volume; it only means something next to the total.

### Amber-or-red departures per 100

This is the headline leading indicator for the whole project.

```dax
Amber or red per 100 =
VAR Flagged   = [Amber or red departures]
VAR Total     = [Total departures]
RETURN
    DIVIDE ( Flagged * 100, Total )
```

*Decision it supports:* the one number that answers "is our bridge-strike exposure going up or down". `DIVIDE` handles the zero-denominator case and returns blank rather than an error, which is the correct behaviour for a day with no movements.

Format as a decimal with one place.

### Week-on-week change in that figure

This compares the current calendar week (Monday start) with the previous one. It is a step change, not a rolling window, so it can be read as "this week versus last week" without qualification.

```dax
Flagged per 100, this week =
VAR WeekStart = TODAY () - WEEKDAY ( TODAY (), 2 ) + 1
VAR WeekEnd   = WeekStart + 6
VAR Flagged =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( Records, Records[Risk Band] = "amber" || Records[Risk Band] = "red" ),
        FILTER ( ALL ( Date[Date] ), Date[Date] >= WeekStart && Date[Date] <= WeekEnd )
    )
VAR Total =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( ALL ( Date[Date] ), Date[Date] >= WeekStart && Date[Date] <= WeekEnd )
    )
RETURN
    DIVIDE ( Flagged * 100, Total )

Flagged per 100, last week =
VAR WeekStart = TODAY () - WEEKDAY ( TODAY (), 2 ) + 1 - 7
VAR WeekEnd   = WeekStart + 6
VAR Flagged =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( Records, Records[Risk Band] = "amber" || Records[Risk Band] = "red" ),
        FILTER ( ALL ( Date[Date] ), Date[Date] >= WeekStart && Date[Date] <= WeekEnd )
    )
VAR Total =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( ALL ( Date[Date] ), Date[Date] >= WeekStart && Date[Date] <= WeekEnd )
    )
RETURN
    DIVIDE ( Flagged * 100, Total )

Week on week change =
VAR ThisWeek = [Flagged per 100, this week]
VAR LastWeek = [Flagged per 100, last week]
RETURN
    IF (
        ISBLANK ( ThisWeek ) || ISBLANK ( LastWeek ),
        BLANK (),
        ThisWeek - LastWeek
    )
```

*Decision it supports:* the transport manager's weekly question — did the change we made last week do anything? A blank result means one of the two weeks has no movements, which is different from no change, so the measure returns blank rather than zero.

For a rolling rather than calendar view, replace the week boundaries in `Flagged per 100, this week` with:

```dax
VAR StartThis = TODAY () - 6
VAR EndThis   = TODAY ()
VAR StartLast = TODAY () - 13
VAR EndLast   = TODAY () - 7
```

Keep the two forms in separate measures. A report that mixes a calendar week and a rolling week without labelling them is how people stop trusting a dashboard.

### A 90-day baseline

The trend is easier to read against a longer baseline, and it costs one measure.

```dax
Flagged per 100, last 90 days =
VAR Flagged =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( Records, Records[Risk Band] = "amber" || Records[Risk Band] = "red" ),
        FILTER ( ALL ( Date[Date] ), Date[Date] >= TODAY () - 89 && Date[Date] <= TODAY () )
    )
VAR Total =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( ALL ( Date[Date] ), Date[Date] >= TODAY () - 89 && Date[Date] <= TODAY () )
    )
RETURN
    DIVIDE ( Flagged * 100, Total )
```

*Decision it supports:* the comparison that stops a single bad week being read as a trend.

### Flagged departures by 90-day window

```dax
Flagged per 100, previous 90 days =
VAR Flagged =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( Records, Records[Risk Band] = "amber" || Records[Risk Band] = "red" ),
        FILTER ( ALL ( Date[Date] ), Date[Date] >= TODAY () - 179 && Date[Date] <= TODAY () - 90 )
    )
VAR Total =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( ALL ( Date[Date] ), Date[Date] >= TODAY () - 179 && Date[Date] <= TODAY () - 90 )
    )
RETURN
    DIVIDE ( Flagged * 100, Total )
```

*Decision it supports:* a quarter-on-quarter reading that is not dominated by one week's weather or one contract starting.

## Cohort measures

### Agency share of departures

```dax
Agency departures =
CALCULATE ( COUNTROWS ( Records ), Records[Basis] = "agency" )

Agency share of departures =
DIVIDE ( [Agency departures], [Total departures] )
```

*Decision it supports:* how much of the site's traffic is in the cohort the risk model weights most heavily. If agency share is rising, the flagged rate is expected to rise with it, and that is a resourcing conversation, not a driver-performance one.

### Agency share of flagged departures

```dax
Agency flagged departures =
CALCULATE (
    COUNTROWS ( Records ),
    Records[Basis] = "agency",
    FILTER ( Records, Records[Risk Band] = "amber" || Records[Risk Band] = "red" )
)

Agency share of flagged departures =
DIVIDE ( [Agency flagged departures], [Amber or red departures] )
```

*Decision it supports:* the comparison that matters. If agency drivers are 40% of departures and 70% of flags, the exposure is concentrated, and the intervention is an induction or a route briefing rather than a site-wide reminder.

### A share-versus-share ratio

```dax
Agency flag index =
DIVIDE ( [Agency share of flagged departures], [Agency share of departures] )
```

*Decision it supports:* reads as a single number. Above 1 means agency drivers are over-represented in the flagged set relative to their share of traffic. Below 1 means under-represented. 1 means exactly proportional.

Format as a decimal with two places and add a conditional rule at 1.0 as the midpoint. State on the page that this is an association in the site's own data, not a statement that agency drivers are less safe — the model weights agency status at 2 points, so some of the over-representation is built into the score. See `docs/RISK-MODEL.md`.

### Agency and subcontractor, side by side

```dax
Departures by basis =
CALCULATE ( COUNTROWS ( Records ), VALUES ( Records[Basis] ) )

Flagged per 100 by basis =
VAR Flagged =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( Records, Records[Risk Band] = "amber" || Records[Risk Band] = "red" )
    )
VAR Total = CALCULATE ( COUNTROWS ( Records ) )
RETURN
    DIVIDE ( Flagged * 100, Total )
```

Used as a value in a matrix with `Basis` on rows, both measures respect the row context, so no extra filtering is needed.

## Vehicle and height measures

### Average and maximum declared running height

```dax
Average declared height =
AVERAGE ( Records[Height (m)] )

Maximum declared height =
MAX ( Records[Height (m)] )
```

*Decision it supports:* the fleet profile. A rising average height is a rising exposure, and the maximum is the number to check against the lowest structure on the site's routes.

Add a percentile version, because the maximum is often one outlier:

```dax
95th percentile height =
PERCENTILE.INC ( Records[Height (m)], 0.95 )
```

*Decision it supports:* the height that 95% of departures stay below. That is the figure to compare against a bridge clearance when deciding whether a route is safe for the fleet.

### Empties and blanks

```dax
Departures with no height recorded =
CALCULATE (
    COUNTROWS ( Records ),
    FILTER ( Records, ISBLANK ( Records[Height (m)] ) || Records[Height (m)] = 0 )
)
```

*Decision it supports:* height is the model's most important input. Every blank is a departure the risk flag could not assess properly. This number should be near zero, and if it is not, the form is not doing its job.

### Departures where the declared height exceeded a restriction on the planned route

This is the count of the case the model treats as a known conflict. There are two ways to compute it and they are not the same, so use both and reconcile them.

**From the record as scored:**

```dax
Height exceeded a route restriction =
CALCULATE (
    COUNTROWS ( Records ),
    FILTER ( Records, Records[Bridge Warning] <> "" )
)
```

*Decision it supports:* how often the app itself wrote a warning. This is the number to quote, because it is what the driver was told.

**Recomputed against the route dimension:**

```dax
Height exceeded a restriction (recomputed) =
VAR WithRoute =
    FILTER (
        Records,
        Records[Height (m)] > RELATED ( Route[Restriction (m)] )
            && NOT ISBLANK ( RELATED ( Route[Restriction (m)] ) )
    )
RETURN
    COUNTROWS ( WithRoute )
```

*Decision it supports:* a cross-check. If the two measures disagree, either the route dimension's clearances do not match `src/lib/routes.ts`, or the app wrote a warning for a route it no longer recognises. Both are errors worth finding.

Keep `[Height exceeded a route restriction]` on the report and `[Height exceeded a restriction (recomputed)]` on a tooltip or a hidden page as a control.

### Count of departure types

```dax
Debriefs =
CALCULATE ( COUNTROWS ( Records ), Records[Type] = "debrief" )

Briefs =
CALCULATE ( COUNTROWS ( Records ), Records[Type] = "brief" )
```

*Decision it supports:* the balance between outbound and inbound movements. A site with twice as many debriefs as briefs is missing half its return records, and that is a data-quality problem, not an operational one.

### Defects and delays

```dax
Departures with a defect =
CALCULATE ( COUNTROWS ( Records ), Records[Defect] = "Yes" )

Delayed departures =
CALCULATE ( COUNTROWS ( Records ), Records[DelayMinutes] > 30 )

Average delay (min) =
AVERAGE ( Records[DelayMinutes] )

Maximum delay (min) =
MAX ( Records[DelayMinutes] )
```

*Decision it supports:* delay is a 1-point weight in the model because lateness correlates with route deviation. The average is the operational number; the count over 30 minutes is the one that lines up with how the score is computed.

Note that `Delay (min)` can be negative in the workbook. `delayAgainst` in `src/lib/runsheet.ts` floors at zero, while the sample generator produces values from -20 upwards. Negative values mean an early departure. Decide whether to keep them and state the convention on the page.

## Breakdown measures

### Departures by contract

```dax
Departures =
COUNTROWS ( Records )

Flagged per 100 by contract =
VAR Flagged =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( Records, Records[Risk Band] = "amber" || Records[Risk Band] = "red" )
    )
RETURN
    DIVIDE ( Flagged * 100, CALCULATE ( COUNTROWS ( Records ) ) )
```

*Decision it supports:* which customers' work generates the most flagged departures. That is a conversation with a contract manager about route planning, not about drivers.

### Departures by route

```dax
Departures by route =
CALCULATE ( COUNTROWS ( Records ), VALUES ( Route[Route] ) )

Flagged per 100 by route =
VAR Flagged =
    CALCULATE (
        COUNTROWS ( Records ),
        FILTER ( Records, Records[Risk Band] = "amber" || Records[Risk Band] = "red" )
    )
RETURN
    DIVIDE ( Flagged * 100, CALCULATE ( COUNTROWS ( Records ) ) )

Route carries a restriction =
VAR Restriction = MAX ( Route[Restriction (m)] )
RETURN
    IF ( ISBLANK ( Restriction ), "No", "Yes, " & FORMAT ( Restriction, "0.0" ) & "m" )
```

*Decision it supports:* whether a route's flagged rate is high because of the drivers using it or because the route itself carries a restriction worth 2 points on every departure. The third measure makes that visible in the same table, which is the whole point.

### Departures by direction

```dax
Departures out =
CALCULATE ( COUNTROWS ( Records ), Records[Direction] = "Out" )

Departures in =
CALCULATE ( COUNTROWS ( Records ), Records[Direction] = "In" )
```

*Decision it supports:* outbound movements are the ones with bridge-strike exposure, because the vehicle is loaded and leaving. Inbound records are the return leg. If the flagged rate is computed over both, state it; the more meaningful denominator for the safety page is outbound only.

### Departures by risk band

```dax
Departures by band =
CALCULATE ( COUNTROWS ( Records ), VALUES ( RiskBand[Risk Band] ) )

Share of departures by band =
DIVIDE ( [Departures by band], CALCULATE ( COUNTROWS ( Records ) ) )
```

With `RiskBand[Risk Band]` sorted by `BandOrder`, the matrix reads Clear, Check, Stop in that order.

### Average delay by risk band

```dax
Average delay by band =
VAR RowsToAverage =
    FILTER (
        Records,
        NOT ISBLANK ( Records[DelayMinutes] )
    )
RETURN
    AVERAGEX ( RowsToAverage, Records[DelayMinutes] )
```

Used in a matrix with `RiskBand[Risk Band]` on rows, this returns the average delay within each band.

*Decision it supports:* confirms that the delay weight is doing what it was meant to. If the average delay in red is barely higher than in green, the 1-point delay weight is adding noise rather than signal, and that is a reason to revisit it in `src/lib/risk.ts`.

A clearer version, showing the delay distribution per band rather than its mean:

```dax
Median delay by band =
MEDIANX (
    FILTER ( Records, NOT ISBLANK ( Records[DelayMinutes] ) ),
    Records[DelayMinutes]
)
```

## A driver ranking table

Ranking drivers by flagged departures is a table, not a measure, because a measure cannot sort rows it has not been given. Create it as a calculated table:

```dax
Drivers by flagged departures =
VAR Summary =
    ADDCOLUMNS (
        SUMMARIZE ( Records, Records[Operator Ref], Records[Operator], Records[Basis] ),
        "Departures", CALCULATE ( COUNTROWS ( Records ) ),
        "Flagged",
            CALCULATE (
                COUNTROWS ( Records ),
                FILTER ( Records, Records[Risk Band] = "amber" || Records[Risk Band] = "red" )
            ),
        "Avg score", CALCULATE ( AVERAGE ( Records[Risk Score] ) ),
        "Max score", CALCULATE ( MAX ( Records[Risk Score] ) ),
        "Max height", CALCULATE ( MAX ( Records[Height (m)] ) )
    )
RETURN
    ADDCOLUMNS (
        Summary,
        "Flagged per 100", DIVIDE ( [Flagged] * 100, [Departures] )
    )
```

Then, in the report, add a visual-level filter `[Departures] >= 5` so a driver with one movement does not top the table at 100 per 100.

*Decision it supports:* which drivers need a route briefing. Read it with two cautions, both of which belong on the page:

- The model weights agency status at 2 points and unfamiliarity at 3, so an agency driver new to the site starts at 5 before anything about their driving is considered. A high position in this table is partly a statement about their contract, not their conduct.
- This is personal data about named individuals, used to shape how they are managed. Keep the page in the transport manager's report, do not put it on a wall, and decide in writing who is allowed to see it.

## Report page 1: exposure overview

| | |
| --- | --- |
| **Audience** | Transport manager, with the site manager as a secondary reader |
| **Question it answers** | How much vehicle movement are we managing, and how tall is the fleet doing it? |
| **Refresh** | Daily |

Layout, top to bottom:

1. **Header strip.** Site name, a date-range slicer on `Date[Date]`, and a text box stating whether the data is sample or live. Do not omit the sample/live label.
2. **Card row.** `[Total departures]`, `[Departures last 7 days]`, `[Average declared height]`, `[Maximum declared height]`. Four cards, no more.
3. **Line chart: departures per day.** `Date[Date]` on the axis, `[Total departures]` as the value. This is the denominator, and it belongs at the top because everything below it is a rate.
4. **Column chart: fleet height distribution.** `Height (m)` on the axis, `[Total departures]` as the value. Sorted by height. Add a constant line at the lowest restriction on the site's routes (4.2m from `src/lib/routes.ts`, placeholder) and label it as such. This one line turns a histogram into a decision.
5. **Donut or stacked bar: departures by risk band.** `RiskBand[Risk Band]`, with `[Share of departures by band]` as the label. Sorted by `BandOrder`.
6. **Table: route exposure.** One row per route: `Route`, `Route carries a restriction`, `[Departures by route]`, `[Flagged per 100 by route]`.
7. **Footer text box.** One sentence: the risk figure is an unvalidated flag, not a prediction.

Filter this page to outbound movements if the operation thinks in those terms, and say so in the header. Do not leave the reader guessing which denominator they are looking at.

## Report page 2: bridge-strike leading indicator

| | |
| --- | --- |
| **Audience** | Transport manager and site manager. This is the page the site manager opens |
| **Question it answers** | Is our bridge-strike exposure going up or down, and is it getting worse this week? |
| **Refresh** | Daily |

Layout:

1. **Header strip.** Same date slicer, same sample/live label, plus a text box naming the headline measure: "Amber-or-red departures per 100".
2. **One large card.** `[Amber or red per 100]`, formatted to one decimal place. This is the number the page exists to show. Give it the most space on the page.
3. **Two comparison cards beside it.** `[Flagged per 100, last 90 days]` and `[Week on week change]`. The change card gets conditional formatting: red when positive, green when negative, with an arrow icon. State in the card subtitle that up is worse.
4. **Line chart: the indicator over time.** `Date[Week label]` on the axis, `[Amber or red per 100]` as the value, with two reference lines from `[Flagged per 100, last 90 days]` and `[Flagged per 100, previous 90 days]`. This is the trend, and it is the reason the page exists.
5. **Column chart: flagged departures per week.** `Date[Week label]` on the axis, `[Amber or red departures]` and `[Total departures]` as two series. A rising rate on a falling volume is not the same problem as a rising rate on a rising volume, and this chart is what separates them.
6. **Card: height conflicts.** `[Height exceeded a route restriction]` with the subtitle "departures where the declared height was over a restriction on the planned route". This is the case the model treats as a known conflict.
7. **Table: the flagged departures themselves.** `Date`, `Time`, `Operator`, `Vehicle Reg`, `Route`, `Height (m)`, `Risk Score`, `Bridge Warning`. Filtered to amber or red, sorted by date descending, showing the last 20. The page is a management view, and this table is what turns it into an action — someone has to be able to see the actual departure and go and ask about it.
8. **Footer text box.** This is the page where the honesty matters most. Two sentences: the score is a transparent additive flag, not a prediction; and until bridge strikes and near misses are recorded in the same workbook, the weights are an unvalidated hypothesis. See `docs/RISK-MODEL.md`.

Do not add a driver ranking to this page. It is a site-level page, and the moment it names individuals it stops being read honestly.

## Report page 3: contract and route breakdown

| | |
| --- | --- |
| **Audience** | Transport manager, with the site manager reading the contract view |
| **Question it answers** | Where is the flagged exposure concentrated — in particular work, on particular routes, or with particular parts of the workforce? |
| **Refresh** | Weekly |

Layout:

1. **Slicers.** `Contract`, `Route`, `Basis`, `Direction`. Put them in a bar across the top, left to right in that order.
2. **Matrix: contract by risk band.** `Contract` on rows, `RiskBand[Risk Band]` on columns, `[Departures by band]` as the value, with `[Flagged per 100 by contract]` as a secondary value. Conditional background colour on the per-100 column, nothing on the counts.
3. **Matrix: route by risk band.** `Route` on rows, with `Route name`, `Route carries a restriction`, `[Departures by route]` and `[Flagged per 100 by route]`. This is where the reader sees that a high route rate may be the restriction rather than the drivers.
4. **Scatter or bar: flagged rate versus volume by contract.** `[Total departures]` on the x-axis, `[Flagged per 100 by contract]` on the y-axis, one point per contract. The top-right quadrant is high volume and high rate — that is where the intervention pays. This chart is why the page earns its place.
5. **Column chart: departures by basis.** `Basis` on the axis, `[Departures by basis]` and `[Flagged per 100 by basis]` as two series on the same axis, or one on the secondary axis with that stated in the title.
6. **Table: contracts with no flag but high volume.** A low rate on a large base is a success worth being able to point at.
7. **Footer note.** Restate that the route clearances on this page come from `src/lib/routes.ts`, that they are placeholder data, and that a wrong clearance is worse than no figure. If that has not changed by the time this page is in use, the page should say so on its face.

## Report page 4: driver cohort

| | |
| --- | --- |
| **Audience** | Transport manager only. Not for the site manager, not for a wall display |
| **Question it answers** | Is the flagged exposure concentrated in the agency and subcontractor cohort, and which individuals need a route briefing? |
| **Refresh** | Weekly |

Layout:

1. **Header.** A prominent text box: "Individual-level view. Unvalidated score. See docs/RISK-MODEL.md before acting on it." This is not a legal disclaimer, it is a working note, and it should be read before the numbers.
2. **Cards.** `[Agency share of departures]`, `[Agency share of flagged departures]`, `[Agency flag index]`. The third card is the point of the page.
3. **Bar chart: flagged rate by basis.** `Basis` on the axis, `[Flagged per 100 by basis]`. Three bars. Simple, and it does the work the page was built for.
4. **Column chart: departures by basis over time.** `Date[Week label]` on the axis, `[Departures by basis]` stacked by `Basis`. Rising agency volume next to a rising flagged rate is a resourcing story; falling volume next to a rising rate is a different one.
5. **Table: the driver ranking.** From the `Drivers by flagged departures` table: `Operator Ref`, `Operator`, `Basis`, `Departures`, `Flagged`, `Flagged per 100`, `Avg score`, `Max score`, `Max height`. Filtered to five or more departures, sorted by `Flagged per 100` descending.
6. **Card: departures with no height recorded.** `[Departures with no height recorded]`. On this page it belongs, because a driver whose height is never captured cannot be scored at all.
7. **Footer note.** Two sentences on what the table does and does not say: the model adds 2 points for agency status and 3 for fewer than three previous runs, so a new agency driver starts at 5 before their driving is considered; and this table is a prompt for a conversation, not a performance measure.

## Scheduled refresh

Three options, in increasing order of how much someone else has to approve.

**Manual refresh.** Open Desktop, click Refresh, publish. Fine for a prototype and for building the pages. Not a way to run a live report.

**SharePoint or OneDrive hosting of the workbook.** Put `site-records.xlsx` in a document library, and point the query at it with **Get Data → SharePoint folder** or by pasting the file URL. Cloud-to-cloud refresh then works without a gateway. This is the intended arrangement — see `docs/ROADMAP.md` for why the workbook is deliberately kept as the integration layer. Note that the app does not write to SharePoint directly; something has to copy the file, or the app's `DATA_DIR` has to point at a synced folder.

**On-premises data gateway.** Needed if the workbook stays on a machine inside the site. That means a gateway install, a service account, and a network path — which is precisely the kind of approval the workbook approach was chosen to avoid. Do not reach for it unless the SharePoint route is refused.

Whichever route is chosen, set the refresh to run after the file lands, not before. A refresh that reads a half-written file is a refresh that shows a wrong row count.

## What the reports cannot tell you

Repeating these in the report itself, not only in this guide, is what keeps the numbers honest.

- **The risk score is an unvalidated flag.** It is a transparent additive score with weights that have never been tested against outcomes. `docs/RISK-MODEL.md` is the reference.
- **There are no outcomes in the workbook.** No bridge strikes and no near misses are recorded. The reports measure the flag rate, not the incident rate, and the two are not the same thing. Until incident rows exist, nobody can say whether a rising flag rate means rising risk or just a stricter form.
- **The route clearances are placeholder data.** They come from `src/lib/routes.ts` and are invented. Any route-level conclusion is only as reliable as that table.
- **Two risk inputs are weak.** `routeTrips90d` comes from a self-reported familiarity toggle in the form, and `priorIncidents` is always sent as zero. The unfamiliarity weight is effectively a self-declaration and the prior-incident weight never fires. See `docs/ARCHITECTURE.md`.
- **A blank height makes a row unscoreable.** Rows with no height recorded cannot be assessed and should be counted and surfaced rather than averaged away.
- **Sample data must not be mixed with live data.** If the two ever share a file, the reports are unusable and there is no way to tell the rows apart afterwards.
