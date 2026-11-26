# SPC activity approval

Deploy the additive Prisma migration first, then the compatible API, then the dashboard and mobile clients. The migration adds enum-array columns to the existing work_plan_activities table. Existing table-level runtime SELECT and UPDATE grants apply to the new columns. Verify the application role can read and update them in staging before rolling out the API. No new tables or sequences require grants.

New clients POST to /activities/{id}/approve with all three arrays, e.g. `{"sdgs":[4,8],"dimensions":["SOCIAL","ECONOMIC"],"categories":["COMMUNITY_EDUCATION","ECONOMY"]}`. Codes are in the activities contract. Categories and dimensions are independent. Both lists must contain unique supported values and at least one selection each. Only the assigned SPC can decide a waiting activity. Approval, reviewer, time, classification, SDGs and audit entry commit in one transaction.

Installed clients may continue sending only sdgs. These approvals and older records return classification: null, meaning no SPC classification was recorded. A classified activity returns classification with dimensions and categories. Before the API rollout clients may also encounter a missing classification property. Historical officer sector and dimension fields keep their original meaning.

For V6 reporting count only approved activities. Count each activity once in the overall total and once for each selected bucket. Bucket sums may exceed the overall total. Keep unclassified approvals visible separately and never substitute an officer's sector or dimension. Dashboard/mobile approval, display and reporting rollout are tracked in #170–#173.

## Programmes reporting (issue #173)

`GET national/programmes` (HQ) and `GET programmes` (DM, DDM and SPC, over their own societies, including a DDM's valid temporary district access) accept optional classification filters:

- `dimension`: `SOCIAL`, `ECONOMIC` or `GOVERNANCE`.
- `category`: one of the ten category codes in the activities contract.

Repeat a parameter, or separate values with commas, for more than one (`?dimension=SOCIAL&dimension=ECONOMIC`, `?category=ECONOMY,CULTURE`). Within a parameter any value matches; when both are given an activity must match both. Unknown values are refused with 400.

- **Only approved activities count.** Waiting and sent-back activities never enter the figures.
- **`planned`** is approved activities scheduled in the financial year; **`completed`** is those whose month has ended. Both come from the SPC's decisions at approval, so no planned classification value is ever inferred.
- **`classification.byDimension` and `classification.byCategory`** list every dimension and category in contract order, with zero where there are none. An activity counts once in each bucket it has, so the buckets overlap and can add up to more than `classification.classified`. They are not additive.
- **`classification.unclassified`** counts approved activities in the year and scope with no classification recorded (approved before V6). They stay in the overall `planned` and `completed` when no filter is set, but never appear in a breakdown or a filtered result. This count does not change with the filters, so clients can say how many older activities a filter leaves out.
- **With a filter**, every figure in the answer (overall totals, sectors, the officer's dimension, UN SDGs and recent activities) counts only the matching classified activities. `classification.filters` echoes the filters used, each value once in contract order.
- `sectors` and `byDimension` keep their original meaning: the officer's own sector and dimension. They are never replaced by the SPC's classification.
