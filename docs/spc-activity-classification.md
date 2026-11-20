# SPC activity approval

Deploy the additive Prisma migration first, then the compatible API, then the dashboard and mobile clients. The migration adds enum-array columns to the existing work_plan_activities table. Existing table-level runtime SELECT and UPDATE grants apply to the new columns. Verify the application role can read and update them in staging before rolling out the API. No new tables or sequences require grants.

New clients POST to /activities/{id}/approve with all three arrays, e.g. `{"sdgs":[4,8],"dimensions":["SOCIAL","ECONOMIC"],"categories":["COMMUNITY_EDUCATION","ECONOMY"]}`. Codes are in the activities contract. Categories and dimensions are independent. Both lists must contain unique supported values and at least one selection each. Only the assigned SPC can decide a waiting activity. Approval, reviewer, time, classification, SDGs and audit entry commit in one transaction.

Installed clients may continue sending only sdgs. These approvals and older records return classification: null, meaning no SPC classification was recorded. A classified activity returns classification with dimensions and categories. Before the API rollout clients may also encounter a missing classification property. Historical officer sector and dimension fields keep their original meaning.

For V6 reporting count only approved activities. Count each activity once in the overall total and once for each selected bucket. Bucket sums may exceed the overall total. Keep unclassified approvals visible separately and never substitute an officer's sector or dimension. Dashboard/mobile approval, display and reporting rollout are tracked in #170–#173.
