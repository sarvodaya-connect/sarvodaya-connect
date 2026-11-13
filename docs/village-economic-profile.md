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
| `GET /economic-profile/production-records` | Records across the caller's societies, filtered and paginated, with no total |

Errors use the usual `{ error: { code, message, requestId } }` body:

| Status | Code |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT`, for an overlap, a stale version or a reused request id |

Timestamps are ISO 8601 UTC, and periods are `YYYY-MM-DD`.

## Production summary

`GET /economic-profile/production?basis=MONTHLY&startsOn=2026-10-01&endsOn=2026-10-31` takes optional `measurement`, `product`, `districtId` and `societyId`. It returns:

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

## Phone app (#146)

The society record has a **Village Economic Profile** tab, third after Overview and Members & Exco. The code is in `apps/mobile/lib/src/economy/`.

| Screen | What it shows |
|---|---|
| The tab | A short note that these are businesses the society runs itself and that the figures are self-reported, a summary, and one card per business with its status and the latest actual and estimated figure of each product, each with its period. **Add business** appears for the assigned Society Officer only. |
| Add/Edit Business | Name, industry (or Other with a description), short description, status and products/services. Standard products show their fixed unit; Other takes a description and a unit. The profile's free-text business description is not touched. |
| Business details | Each product's latest figures and production history, with Record, Archive or Bring back, Edit, and Close or Reopen. Each figure opens on its own screen with every version of it and **Correct figure**. |
| Record Production | Product, actual or estimated, weekly, monthly or seasonal (with a season name), the exact period, the quantity in the product's unit, an optional note and source, and a preview such as "Milk: 3,200 litres · October 2026 · Actual". |

How the phone keeps the rules:

- **A figure is never shown as a total of actual and estimated.** Cards show the latest of each as separate lines. A product with no figure says "Not reported"; a reported 0 shows as 0.
- **Latest figures** come from one `GET /economic-profile/production-records?societyId=…` list (newest period first, up to five pages of 100) instead of one request per product, to stay within the TEST API's request limits.
- **No duplicates.** Save is disabled while saving. A new figure carries a `clientRequestId` that stays the same while the figure stays the same, so a retry after a lost answer returns the record already saved. If the period already has a figure, the form offers to correct it instead.
- **Corrections** send the version the form opened. A 409 shows "Changed by someone else" and keeps the typed value; **Reload latest** shows the saved figure and moves to its version, and nothing is overwritten without a second save.
- **Failures keep what was typed** and are never shown as saved. Nothing is stored on the phone for later.
- **Adding a business has no request id on the API.** After a lost answer, the phone checks the profile for the business before creating it again, and skips products that are already there.
- **Read-only roles** see the same figures with no add or edit controls. A 403 or 404 from the API is shown as such, and access that has ended (for example an expired DDM grant) clears the tab.
- The phone's copy of the catalogue is checked against `packages/api-contracts/src/economy.ts` by `test/economy_catalogue_test.dart`. In demo mode, `DemoEconomyApi` applies the same rules with fictional data.

## Deployment and migration notes

- The PR only adds code, the migration and contracts. **No infrastructure is deployed and no live migration is applied** as part of it.
- When the TEST or production database is migrated, `20261113090000_village_economic_profile` runs with the others (`prisma migrate deploy`). It creates empty tables, and existing rows are unchanged.
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
