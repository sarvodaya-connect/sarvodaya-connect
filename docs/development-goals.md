# Development Goals (issue #169)

Issue #169 is the database, API and shared contract for the V6 **Development Goals** design. When the assigned SPC approves an activity, they choose:

- one or more **Sarvodaya dimensions**;
- one or more of the ten **Sarvodaya categories**;
- one or more **UN SDGs**, as before.

These are stored together with the approval. The dashboard approval (#170), mobile approval (#171), read-only details (#172) and reporting and filters (#173) are built on it. This change adds no screens.

Until now, the activity stored only the Society Officer's single `sector` and `dimension`, typed when planning. SPC approval accepted UN SDGs only. Those two fields stay exactly as they are, as the Society Officer's planning fields. They are never read as, copied into or used in place of the SPC's classification.

## Catalogue

`packages/api-contracts/src/activities.ts` is the one list for the API and the clients. The API keeps the same codes in `apps/api/src/activities/activities.dto.ts`. `activity.catalogue.spec.ts` fails if the API list, the contracts or the database enum ever differ. Codes are stored and sent, and each client translates them (#108).

| Dimension code | Title |
|---|---|
| `SOCIAL` | Social |
| `ECONOMIC` | Economic |
| `GOVERNANCE` | Governance |

| # | Category code | Title |
|---|---|---|
| 1 | `COMMUNITY_EDUCATION` | Community education |
| 2 | `CHILD_WELLBEING` | Child wellbeing |
| 3 | `CULTURE` | Culture |
| 4 | `ECONOMY` | Economy |
| 5 | `GOVERNANCE` | Governance |
| 6 | `HEALTH_NUTRITION` | Health and nutrition |
| 7 | `HOUSING_INFRASTRUCTURE` | Housing and infrastructure |
| 8 | `SPIRITUAL_DEVELOPMENT` | Spiritual development |
| 9 | `AGRICULTURE` | Agriculture |
| 10 | `ENVIRONMENT` | Environment |

- **Independent lists.** Categories are chosen independently of dimensions. No category-to-dimension mapping is inferred or enforced.
- **Stable codes.** A code never changes once released. A new category is a reviewed change to both lists, the `activity_category` enum (a migration) and each client's translations.
- **Order.** Responses always list dimensions and categories in catalogue order, whatever order they were sent in.

## Data model

| | |
|---|---|
| `work_plan_activities.classified_at` | Set in the same transaction as the approval, only when the SPC records Development Goals. Null otherwise. A CHECK (`work_plan_activities_classified_when_approved`) allows it only on an approved activity. |
| `work_plan_activity_dimensions` | `(activity_id, dimension)`: the SPC's dimensions. The primary key refuses duplicates. |
| `work_plan_activity_categories` | `(activity_id, category)`: the SPC's categories, using the new `activity_category` enum. The primary key refuses duplicates. |
| `work_plan_activity_sdgs` | Unchanged: the UN SDGs (1–17). |

The migration is `20261117090000_development_goals`. It is **additive only**:
- It adds one enum, one nullable column, one CHECK and two tables.
- No existing column, row or constraint changes, and **nothing is backfilled**.
- Every existing activity keeps `classified_at` null.

This was checked by applying the migration over older-style rows (approved before review, approved with UN SDGs only, and waiting). Every existing value and UN SDG was identical afterwards, and nothing was classified.

The new tables use `ON DELETE CASCADE` from the activity, like the UN SDGs. The reviewer and approval time are the existing `reviewed_by_*` and `reviewed_at` columns, written in the same statement. `classified_at` always equals `reviewed_at`.

## Classification states

Every activity read includes `classification` (`ActivityClassification`):

| `state` | Meaning | Dimensions and categories |
|---|---|---|
| `PENDING` | Waiting for the SPC or sent back: nothing is decided yet | Empty |
| `CLASSIFIED` | Approved with Development Goals, recorded with the approval. `classifiedAt` and `classifiedBy` are set | At least one of each, in catalogue order |
| `NOT_CLASSIFIED` | Approved without Development Goals. Either it was approved before #169 (including activities planned before SPC review existed, which the V5 migration marked approved), or an older app approved it with UN SDGs only | Empty. Its UN SDGs, if any, are kept in `sdgs` |

`NOT_CLASSIFIED` is a recorded fact, not a guess:
- Clients should show it as "not classified", never as a default selection.
- Reports never place it in a dimension or category.

## Approval API

`POST /api/v1/activities/:activityId/approve` (SPC only):

```json
{
  "sdgs": [4, 5],
  "dimensions": ["SOCIAL", "GOVERNANCE"],
  "categories": ["COMMUNITY_EDUCATION", "CULTURE", "ENVIRONMENT"]
}
```

| Request | Result |
|---|---|
| `sdgs` plus non-empty `dimensions` and `categories`, valid codes, each once | 200, `classification.state = CLASSIFIED` |
| `sdgs` only (an older app) | 200, `NOT_CLASSIFIED`. Nothing is invented |
| `dimensions` without `categories`, or the reverse | 400. A half classification is never saved |
| An empty list, an unknown code, a title instead of a code (`"Culture"`), a duplicate, or no UN SDG | 400 |
| Any other field (for example `sector`) | 400, as before (`forbidNonWhitelisted`) |
| Society Officer, DDM, DM or HQ | 403 |
| An SPC not assigned to the society | 404 |
| The activity is no longer waiting (already approved or sent back) | 409. Nothing changes. An approved activity can't be classified afterwards, and nothing is reapproved |

**Atomicity.** These are written in one database transaction, after every check above has passed:
- the status change, reviewer, approval time and `classified_at`;
- the UN SDGs, dimensions and categories;
- the audit event.

They are written together or not at all. A refusal partway through, even by the database, rolls everything back; this is tested by forcing an invalid enum past the API. Two approvals arriving together are decided by the status guard: one wins and the other gets 409.

**History.** The existing `WORK_PLAN_UPDATED` audit event now also lists the dimensions and categories, or "no Development Goals (older app)". Notifications are unchanged.

No permission changed:
- Only the assigned SPC decides, through the same checks as before.
- Other roles read the same values.
- No one gains the right to edit an approved activity.

## Reads

`classification` is added to:
- the activity detail (`GET /activities/:id`);
- the society work plan (`GET /societies/:id/work-plan`);
- the SPC queue (`GET /activity-reviews`, waiting and recently approved);
- the programmes report's recent activities.

Every existing field is unchanged.

## Reporting and counting

The programmes report (D07, M63 and M64: `GET /national/programmes` for HQ and `GET /programmes` for DM, DDM and SPC) has a new `developmentGoals` block (`DevelopmentGoalTotals`). It covers the same approved activities, financial year and scope as the rest of the report.

- **Approved only.** Only approved activities count. `completed` counts those whose month has ended, as elsewhere.
- **Multiple selections.** An activity with several dimensions or categories counts once in each, so the `byDimension` and `byCategory` rows can add up to more than the number of activities. Never add those rows up to get an activity count.
- **Totals.** `classified` + `notClassified` = the report's approved activities (`planned`, and the same for `completed`).
- **Every row listed.** All three dimensions and all ten categories are always listed, with 0 when none have them.
- **Older counts unchanged.** The existing `sectors` and `byDimension` (the Society Officer's planning fields) and the `sdgs` counts are unchanged. Moving dashboards and filters to the new counts is #173.

The HQ National Dashboard overview is unchanged.

## Compatibility with installed apps

- **Older apps keep working.**
  - Today's phone and dashboard approve with `{ "sdgs": [...] }`. That is still accepted and recorded as `NOT_CLASSIFIED`: it isn't rejected and isn't given invented selections.
  - Adding activities (Society Officer) is unchanged, including `sector` and `dimension`.
  - Responses only gain the `classification` field and the `developmentGoals` block. Older clients ignore fields they don't know.
- **Requiring Development Goals later** is a separate, deliberate change. Once #170 and #171 are released and older phone versions are retired, the API can refuse approvals without dimensions and categories. Before that, check how many approvals arrive without them: the audit entries say "no Development Goals (older app)".
- **Until then**, clients should treat `NOT_CLASSIFIED` as "classification not recorded", including for activities approved after this release by older apps.

## Release

1. **Migrate the database first** (`prisma migrate deploy`): `20261117090000_development_goals`.
2. **Check the runtime role.** As the database owner, run the read-only checks:

   ```bash
   psql "$OWNER_URL" -v ON_ERROR_STOP=1 -v runtime_role=sc_test_app \
     -f infrastructure/aws/test/development-goals-checks.sql
   ```

   Every privilege value must be `true`, and "classified" must be 0 straight after the migration. If a privilege is missing, grant exactly the missing ones as the owner, then run the checks again:

   ```sql
   GRANT SELECT, INSERT ON work_plan_activity_dimensions, work_plan_activity_categories TO sc_test_app;
   ```

   Grant nothing broader: no DELETE, TRUNCATE or ownership. `classified_at` is covered by the role's existing privileges on `work_plan_activities`. PostgreSQL gives every role USAGE on a new enum type by default.
3. **Deploy the API.**
4. **Release the clients** (#170–#173). They need this API. Older clients keep working against it.

**Rollback:**
- The API can be rolled back on its own. The previous API ignores the new tables and column, and records approvals as it did before.
- The migration doesn't need to be reverted. If it ever is, the classifications recorded since are lost. Revert it only after exporting `work_plan_activity_dimensions`, `work_plan_activity_categories` and `classified_at`.

This PR deploys nothing and applies no migration to any shared database.

## What the clients still need

- **#170 (dashboard approval):** done. See [Dashboard approval](#dashboard-approval-170) below.
- **#171 (mobile approval):**
  - send `dimensions` and `categories` with `sdgs`;
  - show 400 messages from the API;
  - reuse the approved dimension artwork from the V6 prototype (the same three files as `apps/dashboard/public/dimensions/`).
- **#172 (read-only details):** show `classification`, including `NOT_CLASSIFIED` as not recorded.
- **#173 (reporting and filters):** use `developmentGoals` and its counting rules, and add filters.
- **Translations** of the dimension and category titles in each client (#108 policy).

## Dashboard approval (#170)

The SPC's desktop journey follows the V6 prototype flows 20, 32 and 40 (SP07g → SP07r → SP07s → SP08g, with SP07g "v" for a blocked approval and SP07x for a failed one).

- **SP07g, choose.** The three dimension pictures are selectable cards and the ten categories are chips, in catalogue order, followed by the official UN SDG tiles. Each card and chip is a real checkbox, so pointer, keyboard (Tab, Space) and screen readers all get the selected state. Dimensions and categories are independent.
- **Blocked.** "Review and approve" with a missing choice names each missing list, keeps every other choice and opens nothing.
- **SP07r, check.** A dialog shows the chosen dimensions, categories and UN SDGs. Nothing is saved until "Approve activity". "Back to edit" and Escape close it without changing the activity.
- **SP07s, approving.** Both buttons are off and a second click is ignored, so an approval is never sent twice.
- **SP07x, failed.** The API could not be reached or failed: the dialog says so, keeps the choices and offers "Try again". A 400 shows the API's message.
- **Stale.** The activity was already approved or sent back (409), or is no longer the SPC's (403, 404): nothing is changed, and only "Back to Activities to Approve" is offered.
- **SP08g, approved.** The list opens with the confirmation and the Development Goals chosen.
- **Send back** is unchanged.

While the SPC decides, the Society Officer's planning sector and dimension are not shown as a classification ("You choose them below"). They are still stored, still entered in the Society Officer's form and still shown once the activity is decided. Removing them from the Society Officer's form waits for the API transition.

The dimension pictures in `apps/dashboard/public/dimensions/` are the prototype's original image fills, exported unchanged (492 × 492 PNG). The dashboard repeats the catalogue codes, since it imports only types from the contracts at run time. `development-goals-catalogue.test.ts` fails if they differ.

New text is in English, Sinhala and Tamil (`dg.*`). The dimension and category titles reuse `dimension.*` and `sector.1`–`sector.10`. The Society Officer's read-only details on this page are still English, like other screens not yet converted (#108).

## Tests

- **`apps/api/src/activities/activities.service.spec.ts`:**
  - classified approval, in catalogue order;
  - half classifications refused before anything is saved;
  - roles and scope checked first;
  - DTO refusals (empty, duplicate, unknown, wrong type);
  - all ten categories accepted;
  - the three states;
  - the Society Officer's sector never used.
- **`activity.catalogue.spec.ts`:** API, contracts and database enum match, in the confirmed order.
- **`apps/api/src/national/programme-scope.spec.ts`:** `developmentGoals` totals, every row listed, classified + not classified = approved.
- **`apps/api/test/db/development-goals.db-spec.ts`** (PostgreSQL, fictional data):
  - approve and read back through every read and role;
  - every refusal writes nothing;
  - out-of-scope and unauthorised decisions;
  - older-app approval;
  - older rows readable as `NOT_CLASSIFIED`;
  - rollback when the database refuses part of an approval;
  - the CHECK and duplicate keys;
  - two simultaneous approvals;
  - report counts.
