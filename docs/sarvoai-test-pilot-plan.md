# SarvoAI TEST pilot: deployment plan

A plan for review. **Nothing here has been run.** The pull request that adds this plan
does not enable SarvoAI, deploy anything, change the database or call a model.
Every step below is done by the project owner (or someone they authorise) after
the plan is approved.

## What the pilot is

| | |
| --- | --- |
| Environment | AWS TEST only: stack with `Stage=test`, function `sarvodaya-api-test`, `ap-southeast-1` |
| Model | Claude Haiku 5.5 through the global inference profile `global.anthropic.claude-haiku-5-5`. Bedrock reports `agreementAvailability=AVAILABLE` in `ap-southeast-1` |
| Processing | Global: requests can be processed in any supported AWS commercial Region. The owner approved this for fictional TEST data only |
| Who can ask | `HQ_ADMIN` only. The route and the service both refuse every other role with 403 before any data or model is touched |
| What it can see | `SARVOAI_FICTIONAL_ONLY=true`, which the template forces for `Stage=test`: only societies whose S number starts `TEST-` **and** whose district code is `TEST-ONLY`. Personal Exco lookups are off |
| Not in scope | The existing `99999TEST` society: its S number does not start `TEST-`, so SarvoAI cannot see it. Do not rename or move it into the pilot; create new fictional `TEST-` societies instead |
| Spending | The application monthly limit (`SarvoAiMonthlyLimitUsd`) and a 31-day pricing approval. Neither is an AWS billing cap; keep the AWS Budgets alert |

## Gates before deploying

Each gate needs recorded evidence (in the private operational record, not in Git).
If any gate fails, stop: SarvoAI stays off.

| # | Gate | Evidence |
| --- | --- | --- |
| 1 | **Owner approvals.** Global processing for fictional TEST data (given), the monthly limit to use, and this plan | Written approval with date |
| 2 | **Current pricing approval.** `reviewedOn` is today or earlier, `expiresOn` at most 31 days later and still in the future on the day of deployment. Prices re-checked against the AWS Price List on the day the approval is written | The approval line below, filled in, and the Price List `publicationDate` checked |
| 3 | **Runtime database privileges.** The runtime role (`sc_test_app`) has SELECT, INSERT and UPDATE on `assistant_monthly_spend`, `assistant_spend_reservations` and `assistant_spend_holds`, and USAGE on the `assistant_spend_status` type. Both ledger migrations are applied | Output of checks 1–2 in [`sarvoai-pilot-checks.sql`](../infrastructure/aws/test/sarvoai-pilot-checks.sql), every value `true` |
| 4 | **Ledger is clean.** No holds; no unexpected reservations | Check 3 of the same script |
| 5 | **Fictional-only scope.** District `TEST-ONLY` exists; every society SarvoAI can see is fictional; nothing real is in that district | Checks 4–6 of the same script, reviewed row by row |
| 6 | **Lambda capacity validated** for issue #104. PR #105's settings are deployed; the full two-tester and phone check has **not** been reported yet. See "Capacity" below | The reported two-tester and phone results, and the agreed limit on concurrent SarvoAI questions |
| 7 | **Bedrock access.** Anthropic's first-use form and the Marketplace subscription are done by an administrator in the console (no model call needed to check) | Console screenshot or note |
| 8 | **AWS Budgets** alert covers the Claude Haiku 5.5 Marketplace charges, as in `sarvoai-aws-setup.md` step 4 | Budget name and thresholds |

If check 2 shows a missing privilege, the owner grants exactly the missing ones as
the database owner, for example:

```sql
GRANT SELECT, INSERT, UPDATE ON assistant_monthly_spend, assistant_spend_reservations, assistant_spend_holds TO sc_test_app;
```

Then run the checks again. Grant nothing broader (no DELETE, TRUNCATE or ownership).

## Capacity

A SarvoAI question keeps one Lambda execution environment busy for up to about
22 seconds (the question's cancellation signal; the function timeout is 29 seconds)
and can make up to 6 model calls.

PR #105 (issue #104) is merged and deployed to AWS TEST:

| Setting | TEST value |
| --- | --- |
| Lambda reserved concurrency | 4 |
| API Gateway (HTTP API) | 10 requests/second, burst 20 |
| `sc_test_app` database role | 10-connection limit |

While a question runs, the dashboard and phone have one environment fewer (3 of
4), so a question during navigation can still cause the 503 throttling described
in #104.

**Validation so far.** After the deployment, the Assign Responsible Staff panel
loaded once, and the API Gateway log window that was checked had no 503 or 429
responses. The full check from #104 has **not** been reported: two testers
navigating at the same time, plus the phone app. Until it is reported, gate 6 is
open and SarvoAI stays off.

Before deploying:

- Report the two-tester and phone check from #104: the workload, its duration,
  request and error counts, API Gateway 503s and 429s, Lambda throttles, and
  database connections. If it shows throttling or connection errors, record the
  constraint and do not enable SarvoAI.
- Deploy the pilot from a `main` that contains PR #105, so the change set keeps
  these values. Deploying from an older commit would silently undo them.
- Agree how many questions may run at once (suggested: **one at a time**, by
  arrangement between the testers) and include that in the #104 workload.
- Do not raise Lambda concurrency for SarvoAI without raising the `sc_test_app`
  connection limit with it (see `infrastructure/aws/test/runtime-database-role.sql`
  and the capacity budget in `aws-test-environment.md`).

## Pricing approval

Prices verified against the AWS Price List, AmazonBedrockFoundationModels,
publication `2026-10-12T08:40:08Z`, Global standard-tier SKUs, US dollars per
million tokens:

| Price | Standard | Prompts over 100,000 tokens |
| --- | ---: | ---: |
| Input | 0.10 | 0.50 |
| Output | 0.50 | 2.50 |
| 5-minute cache write | 0.125 | 0.625 |
| Cache read | 0.01 | 0.05 |

The us-east-1 file (the source below) and the ap-southeast-1 file show the same
Global prices. The Price List does not state the 100,000-token threshold; it is
Anthropic's published long-context rule for this model.

The deployment value, one line. Write it on the day of deployment, with that day as
`reviewedOn` and an `expiresOn` at most 31 days later. These dates are an example:

```json
{"modelId":"global.anthropic.claude-haiku-5-5","region":"ap-southeast-1","reviewedOn":"2026-11-05","expiresOn":"2026-12-05","source":"https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrockFoundationModels/current/us-east-1/index.json","standard":{"inputUsdPerMTok":"0.10","outputUsdPerMTok":"0.50","cacheWriteUsdPerMTok":"0.125","cacheReadUsdPerMTok":"0.01"},"longPrompt":{"aboveTokens":100000,"inputUsdPerMTok":"0.50","outputUsdPerMTok":"2.50","cacheWriteUsdPerMTok":"0.625","cacheReadUsdPerMTok":"0.05"}}
```

This exact line was checked locally with the application's own parser
(`pricingApproval` in `assistant-cost.ts`): accepted the day after `reviewedOn`,
refused before it and from `expiresOn`.

**Worst-case cost, from the application's reservation rule with these prices.** One
model call reserves at most USD 0.009345 (the largest allowed request, 66,536 tokens
at the cache-write price, plus 2,048 output tokens). A question can make 6 calls, so
it reserves at most about USD 0.056. A USD 20 monthly limit therefore allows at
least about 356 questions in the worst case, and a USD 5 limit about 89. Real
questions are usually far smaller, and successful calls settle at their actual
token cost. A smaller pilot limit than the USD 20 default is the owner's choice.

## Deployment steps (owner)

1. On the day: confirm gates 1–8, the account and `ap-southeast-1`, and that the
   pricing approval is current.
2. From a clean checkout of the reviewed `main` commit:

   ```bash
   cd apps/api && npm ci && npm run package:lambda && cd ../..
   sam validate --lint -t infrastructure/aws/template.yaml
   ```

3. Create a change set **without executing it**. Keep every other parameter at
   its current stack value, changing only:

   ```text
   SarvoAiEnabled=true
   SarvoAiPricingApproval=<the one-line approval>
   SarvoAiMonthlyLimitUsd=<the approved limit>
   ```

   Use `sam deploy --no-execute-changeset` (or the console's "Use existing value"
   for the other parameters).
4. Review the change set. Expected: the API function's environment
   (`SARVOAI_ENABLED`, `SARVOAI_PRICING_APPROVAL`, `SARVOAI_MONTHLY_LIMIT_USD`), its
   role gaining the one Bedrock `InvokeModel` policy, and a new function version. No
   change to API Gateway, concurrency, the database, Cognito or S3 unless the
   reviewed `main` intentionally changed them. Anything else: stop.
5. Execute the change set.

## Smoke test (fictional data only)

The first questions are paid model calls; each is counted by the ledger.

1. Sign in as a fictional HQ test account. Ask one question about a `TEST-`
   society, for example "Give me an overview of society TEST-A01 for FY 2025/26".
   Expect 200 with an answer drawn only from fictional records.
2. Ask about `99999TEST`. Expect SarvoAI to report that it cannot find that society.
3. Send a question as a non-HQ test account. Expect the API to refuse it with 403,
   with no reservation added.
4. As the owner, run check 3 of `sarvoai-pilot-checks.sql` again: one `SETTLED`
   reservation per model call, no holds, the month total equal to their cost.
5. In the API logs: no `sarvoai_calls_blocked` or `sarvoai_calls_held_for_review`;
   one `SARVOAI_QUESTION` audit event per question (actor, outcome and tool names
   only). API Gateway: no throttling 503s during the test.

## While the pilot runs

- Fictional questions and records only. No real names, NICs, phone numbers or
  society details in questions.
- Check the ledger month total and holds, Lambda throttles and API 503s after each
  test session.
- The approval stops every model call on its `expiresOn` date. Renew it by repeating
  the price check and redeploying with a new approval line.

## Rollback

Create and review a change set with `SarvoAiEnabled=false`, all other parameters
unchanged, then execute it. This removes the Bedrock permission and makes the
endpoint answer 503 without calling AWS. Do not edit the function's environment in
the console: the next stack deployment would overwrite it. The ledger rows stay as
the record of what was spent; do not edit or delete them.
