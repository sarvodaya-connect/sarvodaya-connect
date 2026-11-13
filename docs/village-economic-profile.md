# Village Economic Profile

Issue #145 is the database, API and shared contract for the businesses a Sarvodaya society **operates itself**, what each produces, and how much it reported producing. The phone app (#146) and the dashboard (#147) are built on it.

It is not a survey of every business or household in the village. It holds no prices, revenue, costs, profit, household income, employment, buyers, weather, maps or SarvoAI. All figures are typed by the Society Officer and are **self-reported**. Nothing is reviewed or approved, and nothing is marked Verified.

## Data model

```
Society -> Business -> Output (product or service) -> Production record
                                                       -> Revisions (every saved version)
```

| Table | What it holds |
|---|---|
| `society_businesses` | Name, industry, short description, status (Operating, Seasonal, Temporarily stopped, Closed), who made it and when |
| `business_outputs` | One product or service of a business, with its unit. A business can have several. |
| `production_records` | One quantity for one output, one exact covered period and one measurement (actual or estimated), with an optional note and source |
| `production_record_revisions` | Every saved version of a record: the first save and each correction, with who made it and when |

The migration is `20261113090000_village_economic_profile`. It only adds these four tables and three enums. No existing table changes. The society profile's free-text `business_description` stays exactly as typed: no businesses or quantities are worked out from it, and existing data is not touched. Existing clients are unaffected because every endpoint is new.

Nothing is deleted. A business is set to Closed, and an output is archived. Their records stay and keep counting in the periods they cover. The foreign keys are `ON DELETE RESTRICT`.

## The shared catalogue

`packages/api-contracts/src/economy.ts` is the one list of industries, products and units for the API, the dashboard and the phone app. The API keeps a copy in `apps/api/src/economy/economy.catalogue.ts`, and `economy.catalogue.spec.ts` fails if the two ever differ. Codes are stored and sent. Each client translates them through the existing localization catalogs (#108), so translations follow the usual review policy.

- **One unit per standard product.** Milk is always litres, coconuts always nuts and tailoring always jobs. Outputs of the same product can therefore always be added, and no conversion is ever needed or guessed.
- **Services are outputs too.** For example, Tailoring jobs and Repair jobs are counted in jobs.
- **Other** needs a description, such as "Fictional jaggery", and a unit chosen from the list. An Other industry also needs a description. Other outputs are **never added together**: summaries list each one on its own row.

| Unit | Accepts |
|---|---|
| Litre, Metre | up to 2 decimal places |
| Kilogram | up to 3 decimal places |
| Item, Nut, Egg, Packet, Job | whole numbers only |

A new product or unit is a reviewed change to both catalogue files, plus a translation in each client.

## Rules

### Quantities
- Must be finite, from 0 to 100,000,000, with the decimal places the unit allows.
- **0 is a reported zero.** It is not the same as no record, and summaries count the two separately.

### Periods
Dates are Sri Lanka calendar days, and both ends are included.

| Basis | Covers |
|---|---|
| Weekly | Monday to the following Sunday |
| Monthly | The first to the last day of one calendar month |
| Seasonal | Any range of at most 366 days, with a name such as "Maha 2026/27" |

- Nothing is prorated: a season is never split into months, and a week across a month end belongs to no month.
- An **actual** figure can only cover days that have passed.
- An **estimate** can look up to a year ahead.

### Actual and estimated
- These are different measurements.
- Every summary is for one measurement and defaults to actual, so an estimate and an actual figure for the same output and period are never added together.

### One figure per output and period
- A record's identity is output, measurement and exact period. There is one record per identity.
- Periods of one output and measurement **never overlap**, so a weekly and a monthly actual figure for the same days cannot both exist. Weekly, monthly or seasonal reporting can be chosen per period without anything being counted twice.
- The API checks this while holding a lock on the output row, so two saves arriving together are checked one after the other.

### Retries and corrections
- **A retry adds nothing.**
  - A save can carry a `clientRequestId` (a UUID). Sending the same request again returns the record already saved, with status 200 and `created: false`.
  - Saving the same figure for the same period without an id does the same.
  - A *different* figure for an existing period is refused with 409, because it must be a correction.
- **A correction replaces the current figure.**
  - Correcting 3,200 to 3,400 changes every total by +200. Lower figures work the same way.
  - Each correction adds a revision, so the full history stays.
  - The period, measurement and output never change. A figure saved in the wrong period is corrected to 0, and the right period gets its own record.
- **Stale changes are refused.**
  - Businesses, outputs and records carry a `version`.
  - A change sent from an older version than the saved one gets 409, with "Someone else changed this since you opened it", instead of overwriting the newer figure.
  - Re-sending values that are already saved is accepted and changes nothing.

### Closing and archiving
- Closing a business or archiving an output keeps its records.
- Figures for days *before* the close or archive date can still be added late. Later periods are refused, and so are new outputs on a closed business.
- Reopening clears the close date.

## Who can do what

| Role | Read | Write |
|---|---|---|
| Society Officer | Their assigned society | Their assigned society only |
| SPC | Assigned societies | None |
| DDM | Assigned societies, plus a district only while a temporary grant is valid | None, even during a grant |
| DM | Their own district | None |
| HQ | Every society | None |

- The API works out the scope again on every request from the signed-in account. A grant that has not started, has expired or has been revoked gives nothing.
- A `societyId` or `districtId` in a request can only narrow the caller's scope, never widen it.
- A society, business, output or record outside the caller's scope is reported as **404**, so ids from other districts reveal nothing.
- Any role other than Society Officer gets **403** on every write, whichever society it names. Another society's officer gets 404.

## Endpoints

All endpoints are under `/api/v1` and need sign-in.

| Endpoint | What it does |
|---|---|
| `GET /societies/:id/economic-profile` | The society, its free-text business description, businesses with outputs, and `permissions.canManage` |
| `POST /societies/:id/businesses` | Add a business (at most 50 per society) |
| `PATCH /businesses/:id` | Change a business; send `version` |
| `POST /businesses/:id/outputs` | Add a product or service (`unit` only for Other) |
| `PATCH /business-outputs/:id` | Archive or bring back an output; send `version` and `archived` |
| `GET /business-outputs/:id/production-records` | That output's records, paginated (`page`, `pageSize` up to 100) |
| `POST /business-outputs/:id/production-records` | Save a figure: 201 when new, 200 when the save had already been made |
| `PATCH /production-records/:id` | Correct a figure; send `version` |
| `GET /production-records/:id/history` | The record and all its revisions, newest first |
| `GET /economic-profile/production` | Reported production for one exact period ([below](#production-summary)) |
| `GET /economic-profile/production-records` | Records across the caller's societies, filtered and paginated, with no total. With `basis`, `startsOn` and `endsOn`, exactly the records the same summary counts |
| `GET /economic-profile/scope` | Who the figures cover (`kind`, society count, when a DDM's temporary access ends) and the districts and societies the caller may filter by (issue #147) |

Errors use the usual `{ error: { code, message, requestId } }` body:

| Status | Code |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT`, for an overlap, a stale version or a reused request id |

Timestamps are ISO 8601 UTC, and periods are `YYYY-MM-DD`.

## Production summary

`GET /economic-profile/production?basis=MONTHLY&startsOn=2026-10-01&endsOn=2026-10-31` takes optional `measurement`, `product`, `industry` (the business's industry), `districtId` and `societyId`. Product and industry narrow both the totals and the eligible societies. It returns:

- `label: "REPORTED_PRODUCTION"`: the totals are what societies reported, never a village's or district's capacity;
- one row per standard product and unit, with:
  - `reportedQuantity`: the sum, or `null` when no society reported;
  - `contributingBusinesses`;
  - `coverage`;
- `otherOutputs`: Other figures one by one, never added together;
- `lastUpdatedAt`: the latest change to any record counted.

The rules behind the totals:
- **Only exactly this period counts.** Records for other periods, the other measurement and Other outputs are never added in.
- **A mix of periods is listed, never totalled.** Use `GET /economic-profile/production-records` with `from` and `to` to list records whose periods touch a range.
- **Seasons.** Seasons with different dates are different periods, so they are listed rather than added together.

### Coverage

The coverage denominator is **societies, not businesses**: two dairy businesses in one society count as one society.

**Eligible societies.** A society counts as eligible for a product in a period if either:
- it is Active and in scope, and has an output of that product that:
  - was registered on or before the period's last day;
  - was not archived before the period's first day;
  - belongs to a business not closed before the first day;
- or it reported that product for the period anyway.

From the eligible societies:

| Count | Meaning |
|---|---|
| `reportedSocieties` | Have a record for the period |
| `zeroSocieties` | Reported, and their figures add up to 0 |
| `missingSocieties` | Eligible and have not reported |

This keeps past results understandable:
- A society that registers milk in November is not "missing" for October.
- Closing or archiving later does not remove past figures.

The one exception is reopening a closed business: it clears the close date, so periods while it was closed count it as eligible again.

## Dashboard (issue #147)

The dashboard only shows what the API returns. It adds nothing up itself, and nothing on it can be edited: Society Officers enter everything on the phone (#146).

- **Village Economic Profile** (`/economic-profile`) is in the sidebar for HQ, DM, DDM and SPC. It's one design for every role, with a "Counted over" line saying whose societies are counted.
  - **Filters:** district (only when there is more than one to choose), society, industry, product, reporting period (month, week or season dates) and measurement (actual by default).
  - The filters live in the address, so Back, refresh and shared links show the same figures.
  - The cards and the table use the same query, and the table is paged by the API (25 per page).
- **Each product is its own card, in its own unit,** with:
  - the reported quantity, or "No reports yet" (never 0);
  - contributing societies and businesses;
  - "x of y eligible societies reported", how many reported zero, and how many have not reported;
  - when the figures were last updated.
- **No single total across products.** When several products are shown, a note explains why. Other outputs are listed separately.
- **Exact periods only.** Weekly, monthly and seasonal figures are never added together, and estimates appear only when Estimated is chosen. A season needs both dates before anything is asked for.
- **Drill-down:** the table links to the society's **Economic Profile** tab, which shows:
  - its businesses, industries, statuses, and products or services (archived ones marked);
  - the untouched profile description;
  - its records, each with a **History** page listing every saved version.
  - A "Back to Village Economic Profile" link returns to the same filters. It only ever goes back to `/economic-profile`.
- **Scope:** a society or record outside the viewer's scope is a 404 from the API, shown as the usual not-found page, so direct addresses fail safely. The record history page also checks that the record belongs to the society in its address.
- **Labels:**
  - Every label is in `apps/dashboard/src/i18n/messages` (`eco.*`) in English, Sinhala and Tamil. The Sinhala and Tamil are unreviewed drafts.
  - Business, society and Other names stay as typed.
  - The dashboard repeats the catalogue codes in `src/lib/economy-catalogue.ts`, and a test keeps them equal to the contract.

## Deployment and migration notes

- The PR only adds code, the migration and contracts. **No infrastructure is deployed and no live migration is applied** as part of it.
- When the TEST or production database is migrated, `20261113090000_village_economic_profile` runs with the others (`prisma migrate deploy`). It creates empty tables, and existing rows are unchanged.
- **Release order:** migrate the database first, then deploy the API, then release the dashboard and phone builds that use it. A merged PR doesn't mean its migration or release has reached TEST. #147 adds no migration; it needs the #145 migration and an API with the #147 endpoint changes, which are backwards-compatible additions.
- **Rolling back:** drop the four tables and three enums. Nothing else depends on them.
- The database also enforces the core rules:
  - quantities from 0 to 100,000,000;
  - weekly, monthly and seasonal period shapes;
  - a season name only on seasonal records;
  - descriptions for Other;
  - `closed_at` exactly while Closed;
  - one current output per standard product per business.

## Tests

Every record in these tests is fictional.

- **`apps/api/src/economy/*.spec.ts`:**
  - the catalogue matches the shared contract;
  - units and quantity limits;
  - period shapes, including leap years, and the Sri Lanka "today";
  - overlaps;
  - permissions and the DDM grant timeline.
- **`apps/api/test/db/village-economic-profile.db-spec.ts`** (real PostgreSQL, two fictional districts):
  - **Acceptance criteria:** 3,200 litres saved once; retries; correction to 3,400 and a decrease; stale conflicts; actual and estimated kept apart; overlap refusal; several businesses, services and Other; zero against missing; coverage per society.
  - **Scope:** refusals across districts on detail, list, history and summary; the DDM before, during, after revocation and after expiry of a grant.
  - **Closing and archiving:** closing and archiving without losing history.
  - **Database rules:** the CHECK constraints.
- **`packages/api-contracts/test/contracts.test.mjs`:** catalogue consistency.
