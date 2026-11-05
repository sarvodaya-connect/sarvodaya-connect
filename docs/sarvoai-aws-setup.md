# SarvoAI: AWS setup

SarvoAI is the HQ-only question assistant (`POST /api/v1/assistant/questions`). It calls Claude Haiku 5.5 on Amazon Bedrock. These steps are done once per AWS account by someone with administrator access. The code needs no AWS keys: it signs requests with the API task's IAM role.

## Reviewed scope

- The route and service both require `HQ_ADMIN` before tools/model access.
- Tools select explicit fields and have no arbitrary SQL, write, document-reader,
  NIC, contact, password or account-secret tool. Financial tools expose only total
  profit and total expenses; arithmetic and displayed tables come from code.
- TEST sets `SARVOAI_FICTIONAL_ONLY=true`: only district code `TEST-ONLY` and
  societies whose code starts `TEST-` are accessible to model tools. Exco lookups
  are unavailable. Only synthetic values belong in these records.
- Questions/history, tool text and model summaries get best-effort scrubbing of
  obvious NICs, phone numbers, emails, credential-bearing URLs, JWTs, AWS key IDs
  and labelled secrets. This is **not** a general personal-data classifier:
  unlabelled passwords and personal names cannot reliably be recognized.
  Enter fictional questions only; real-data use needs a separate privacy review.
- Audit events retain actor, outcome kind and allowed tool names, not raw prompts
  or answers. Provider/database errors are not copied into logs or responses.
  This change does not delete historical audit events.

## Operational tools added for HQ

Three additional read-only tools use explicit selected fields and the same TEST
fictional scope. They create no tasks, send no messages and make no decisions.

| Tool | Inputs | Evidence and limits |
| --- | --- | --- |
| `get_society_overview` | Exact S number and completed financial year | Profile/status/grade, active named Exco row count (no identities), annual profit/expenses with missing values preserved, Registrar upload gaps, five most recently updated approved activities, pending grades and overdue unanswered requests. Profiles in any status may be viewed. |
| `find_compliance_gaps` | Completed financial year and optional district name | All-scope counts for active societies missing any of the four Registrar upload types. Up to 20 matching societies ordered by S number; explicitly reports truncation. Matches the existing Registrar screen's `uploadedAt` rule; it does not certify approval or legal compliance. |
| `list_outstanding_work` | Optional district name | Four queues for active societies: overdue unanswered society-request pairs, pending HQ grade decisions, activities awaiting SPC review (HQ follow-up only), and profiles older than 90 days. Up to five oldest examples per queue. Due dates use Sri Lanka local today; due today is not overdue. |

Database transactions use repeatable-read snapshots so counts and examples for a
tool agree during concurrent updates. Queue order is fixed and explained, not an
AI-generated risk score. Counts can overlap and must not be summed as unique
societies. No legal deadline is invented for a missing upload. A profile update
timestamp does not describe every related record. Missing yearly totals remain
null, never zero. An Exco row count does not validate committee composition.

Optional `details.sources` contains backend-generated dashboard paths and record
update timestamps where the schema provides them. The model cannot supply these
links. The dashboard displays them in **How was this answered?** and restricts
navigation to the known internal record routes. Evidence from multiple tool
calls is retained (up to 50 links); the displayed table remains the latest tool's
table. Existing mobile readers can ignore the optional field; a mobile evidence
links panel can follow separately. Nothing reads or signs document contents.

Example questions after enablement with synthetic records:

- Give me an overview of society TEST-UPLOAD-001 for FY 2025/26.
- Which societies are missing Registrar uploads for FY 2025/26?
- What outstanding work should HQ follow up on today?

The tools return honest empty results if no fictional societies exist yet. They never substitute demonstration rows into a production-mode answer.

## How it connects

| Setting | Value |
|---|---|
| Endpoint | `bedrock-runtime` in `ap-southeast-1` (Singapore), InvokeModel |
| Model ID | `global.anthropic.claude-haiku-5-5` (global inference profile) |
| IAM action | `bedrock:InvokeModel` only |

In Singapore, Claude Haiku 5.5 is available only through the **global** inference profile on `bedrock-runtime`. There is no Singapore-only option and no `bedrock-mantle` option for this model. A global profile means **requests can be processed in any supported AWS commercial Region**, not only in Singapore. Sarvodaya should approve this before SarvoAI is switched on, because questions and the tool results sent to the model include society names, Exco names and yearly totals. Explicit tool fields exclude NICs, phone numbers, emails and passwords; best-effort request scrubbing is an additional layer, not a guarantee for arbitrary user text. TEST disables personal Exco lookups and requires synthetic records/questions.

## 1. Turn on the model

1. Sign in to the AWS console as an administrator and switch the Region to **Asia Pacific (Singapore)**.
2. Open **Amazon Bedrock → Model catalog** and choose **Claude Haiku 5.5**.
3. If asked, submit Anthropic's first-time use form. Claude models are sold through AWS Marketplace, so the account subscribes on first use. The person doing this needs `aws-marketplace:Subscribe` and `aws-marketplace:ViewSubscriptions`; the API role does not.
4. Before any live prompt, obtain owner approval for access, reviewed pricing and global processing. Console playground calls are billed outside the application ledger; they are not part of local regression checks.

## 2. Give the API role permission

Attach [`infrastructure/aws/sarvoai-bedrock-policy.json`](../infrastructure/aws/sarvoai-bedrock-policy.json) to the IAM role the API code runs as (for example an ECS task role or an App Runner instance role; not a role used only to pull images or start the service). Replace `ACCOUNT_ID` with the 12-digit account ID first.

The policy has the three parts AWS requires for a global inference profile and allows only this one model:

1. the inference profile in Singapore
2. the model in Singapore, only when called through that profile
3. the Region-less model ARN that lets the global profile route to other Regions, again only through that profile

If the organisation uses a Service Control Policy that blocks unused Regions, it must allow `"aws:RequestedRegion": "unspecified"` for Bedrock, or global routing is denied.

## 3. Configure the API

Set these on the API service (see `.env.example`):

```
SARVOAI_ENABLED=true
SARVOAI_MODEL_ID=global.anthropic.claude-haiku-5-5
SARVOAI_AWS_REGION=ap-southeast-1
SARVOAI_MONTHLY_LIMIT_USD=20
SARVOAI_PRICING_APPROVAL=<one line of JSON, see "Pricing approval" below>
```

While `SARVOAI_ENABLED` is not `true`, the endpoint answers 503 and nothing is sent to AWS. Keep it `false` for local development. Enabling it without a current pricing approval still makes no model calls.

## 4. Set a budget alert

In **AWS Budgets**, create a monthly cost budget of **USD 20** filtered to the Claude Haiku 5.5 Marketplace charges (they appear under the model provider, not under Amazon Bedrock), with alerts at 80% and 100%. Forecast usage only after Bedrock pricing and expected calls per question have been reviewed; there is no fixed cost per question.

AWS Budgets only sends alerts. It does not stop model calls. The application's own limit, below, is what stops them.

## Monthly spending limit

SarvoAI refuses to call the model once its estimated spending would pass `SARVOAI_MONTHLY_LIMIT_USD`. The USD 20 default is a ceiling. It is not money set aside, and it is not an amount to add to the monthly forecast: expected spending should reflect actual anticipated use.

**This is not an AWS billing cap.** It covers only SarvoAI calls made through this API, and it uses the application's own estimate. It does not limit anything else in the AWS account, and AWS's bill can differ from it. Keep the AWS Budgets alert.

### How it works

| Step | What happens |
|---|---|
| Month | A UTC calendar month. The limit resets at 00:00 UTC on the 1st, which is 5:30 a.m. in Sri Lanka |
| Before anything else | The pricing approval and the request are checked, and any hold waiting for review stops the call. If a safe limit cannot be set, no model call is made, and the API answers 503 with "SarvoAI is paused" |
| Before each model call | One atomic PostgreSQL statement adds a high estimate to the month's total, only if the total stays within the limit. It holds across simultaneous requests and API instances. A question can make up to 6 model calls, and each one reserves separately |
| At the limit | No model call is made. The API answers 429 (`LIMIT_REACHED`) with the date SarvoAI returns, and the dashboard and phone show that message. A refusal part-way through a question stops that question |
| After a successful call | The estimate is replaced by the cost of the tokens the provider reported |
| A call breaks the reservation's assumptions | The full estimated cost is recorded, a warning is logged and a hold stops all further calls until it is reviewed (see below) |
| Provider refused the call (400, 401, 403, 404, 413, 422, 429) | Nothing was billed, so the reservation is released |
| Timeout, dropped connection, 5xx, or a response without usable token counts | The call may have been billed, so the full reservation stays counted until the month ends |
| API instance stops mid-call, or the ledger update fails | The reservation stays open and stays counted until the month ends |

The SDK's automatic retries are off (`maxRetries: 0`), because a retry after a timeout could be billed twice under one reservation. Asking again makes a new request with its own reservation, so repeated or duplicate questions each count. The SDK timeout is 25 seconds; this pilot also applies one 22-second cancellation signal across the question, including subsequent tool rounds. An aborted model call retains its reservation as uncertain. The API Lambda timeout is 29 seconds.

The records are in `assistant_monthly_spend`, `assistant_spend_reservations` and `assistant_spend_holds`. They hold the month, model ID, amounts, token counts and status: no prompts, answers or who asked. The separate `SARVOAI_QUESTION` audit retains actor, outcome and tool names only, including `SPENDING_LIMIT` or `SPENDING_REVIEW` on refusals. Raw questions and answers are not stored; historical audit records are not deleted by this change.

To check the current month (amounts are in millionths of a US dollar):

```sql
SELECT month, committed_micro_usd / 1000000.0 AS usd FROM assistant_monthly_spend ORDER BY month DESC LIMIT 3;
```

### Pricing approval

SarvoAI has no default prices. `SARVOAI_PRICING_APPROVAL` holds the reviewed prices, and every model call is refused if it is missing, invalid or expired, or covers a different model, inference profile or Region.

**Verified Bedrock prices.** No approval is deployed yet. The prices below were confirmed on 5 November 2026 in the [AWS Price List for Amazon Bedrock foundation models](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrockFoundationModels/current/us-east-1/index.json) (publication `2026-10-12T08:40:08Z`). They are Claude Haiku 5.5's **Global, standard-tier** prices in US dollars per million tokens, and the ap-southeast-1 Price List shows the same figures:

| Price | Standard | Prompts over 100,000 tokens |
|---|---:|---:|
| Input | 0.10 | 0.50 |
| Output | 0.50 | 2.50 |
| 5-minute cache write | 0.125 | 0.625 |
| Cache read | 0.01 | 0.05 |

The Price List does not state the 100,000-token threshold; it is Anthropic's published long-context rule for this model. The 1-hour cache and the non-global (in-Region) prices are different, and SarvoAI uses neither. Prices change: check them again on the day each approval is written. The [TEST pilot plan](sarvoai-test-pilot-plan.md) has a ready approval line with these prices.

To review the prices:

1. Find the prices for this model and inference profile in the official AWS sources: the [Amazon Bedrock pricing page](https://aws.amazon.com/bedrock/pricing/), the AWS Price List, or the AWS Marketplace listing for the model. Check the input, output, 5-minute cache write and cache read prices, and the long-prompt prices and threshold. Claude charges appear under the model provider's Marketplace charges, so compare with an invoice once one exists.
2. If any figure cannot be confirmed, stop and leave SarvoAI off.
3. Set the approval, on one line, using the prices you confirmed:

```json
{
  "modelId": "global.anthropic.claude-haiku-5-5",
  "region": "ap-southeast-1",
  "reviewedOn": "YYYY-MM-DD",
  "expiresOn": "YYYY-MM-DD",
  "source": "https://aws.amazon.com/bedrock/pricing/",
  "standard": {
    "inputUsdPerMTok": "<confirmed>",
    "outputUsdPerMTok": "<confirmed>",
    "cacheWriteUsdPerMTok": "<confirmed>",
    "cacheReadUsdPerMTok": "<confirmed>"
  },
  "longPrompt": {
    "aboveTokens": 100000,
    "inputUsdPerMTok": "<confirmed>",
    "outputUsdPerMTok": "<confirmed>",
    "cacheWriteUsdPerMTok": "<confirmed>",
    "cacheReadUsdPerMTok": "<confirmed>"
  }
}
```

| Rule | Effect |
|---|---|
| `expiresOn` | Calls stop at 00:00 UTC on this date. It may be at most 31 days after `reviewedOn`, so the prices are checked again each month |
| `modelId`, `region` | Must match `SARVOAI_MODEL_ID` and `SARVOAI_AWS_REGION`, so changing either needs a fresh review |
| Supported models | Only `global.anthropic.claude-haiku-5-5`. Another model or profile also needs a code review of `assistant-cost.ts`, because its thinking and billing rules can differ |
| `source` | Must be an https address on an AWS domain |
| Prices | Written as text, all above zero. Long-prompt prices may not be below the standard ones. Unknown fields are refused, so a misspelt field cannot be ignored |

The review date and source live in the approval, so the deployment's parameter history is the record of each review.

**Assumptions the approval relies on:** standard service tier; per-token charges only; a 5-minute prompt cache; the global inference profile; US dollars before tax. Discounts and private pricing are not modelled.

### The reservation's upper bound

| Bound | Value |
|---|---|
| Output per model call | 2,048 tokens (`max_tokens`). With thinking off, this limits all billed output |
| Model calls per question | 6 |
| Question | 500 characters |
| Earlier turns sent | 10, at most 2,000 characters each |

The exact request is scrubbed before it is measured and reserved. Requests above 65,536 UTF-8 bytes are refused before a reservation or provider call. No model-layer rewriting or second spending gate follows the reservation.

Each reservation counts every UTF-8 byte of the whole request (system prompt, tools, messages and answer format) as one token, plus 1,000 tokens of overhead, all at the dearest input price (normally the cache write), plus the full 2,048 output tokens at the output price. If that estimate is over `aboveTokens`, the long-prompt prices apply to all of it. The upper bound relies on real tokens spanning at least one byte each, which is an assumption about the provider. It is checked against reported usage after every call, and a response above it places a hold.

**Thinking is off.** Thinking is on by default for Claude Haiku 5.5. When it runs, thinking blocks are sent back on later tool rounds, and they may bill more input tokens than the visible bytes, so no safe limit can be worked out in advance. SarvoAI therefore sends `thinking: {"type": "disabled"}`, and this is enforced for every call.

These requests are refused before any model call, because the reservation cannot limit them: thinking left on; effort above `high`; a service tier, fast mode or data-residency option; server tools; a cache lifetime other than 5 minutes; images, documents or any other content that is not text or tool calls; and any request field not on the list in `assertBillableRequest`.

### When a call breaks the assumptions

After each call, these place a hold: the estimated cost is above the reservation; prompt tokens are above the estimate; output tokens are above `max_tokens`; or the response reports a charge the approval does not price (long-lived cache, another service tier, fast mode, server tools, or thinking tokens).

- The full estimated cost is recorded. A charge the approval does not price counts at no less than the reservation, because its true cost is unknown. The month's total can therefore end above the limit.
- A warning, `sarvoai_calls_held_for_review`, is logged with the reservation ID, reasons, amounts and `detectedAt`. It contains no prompt content.
- All further model calls stop, on every API instance. The hold survives the month ending, a restart and a new approval.

To clear a hold, find out why the assumptions failed and correct the prices or code. Then add the `detectedAt` of the latest hold you reviewed to the approval as `"overageReviewedThrough": "2026-11-20T10:15:30.123Z"`. A later hold stops calls again. A future time is refused, so a hold cannot be approved in advance. The ledger rows are left unchanged, so do not edit them by hand.

To list holds:

```sql
SELECT detected_at, reasons, reserved_micro_usd, actual_micro_usd FROM assistant_spend_holds ORDER BY detected_at DESC;
```

### Limitations

- **This is not an AWS billing cap.** It is an estimate from token counts and the reviewed prices, and AWS's bill can differ. Taxes, price changes between reviews, discounts and rounding are not reflected.
- A call is only checked after it finishes, so one call can cost more than its reservation before the hold starts. Calls already in progress when a hold is placed, or reserving at the same moment, still finish.
- If the ledger update after a call fails, the reservation stays counted at its estimate, but that call's usage is not checked, so no hold is placed.
- The provider's usage figures are trusted. A wrong figure from the provider is not detected.
- The limit can refuse slightly early: open reservations count at their high estimate, so a question can be refused while others are in progress even though those will settle lower. Trying again shortly afterwards may succeed.
- Uncertain calls stay counted at the full reservation, so many timeouts use up the limit faster than real spending.
- Changing the limit takes effect on the next call. Lowering it below the amount already committed refuses further calls; it does not undo anything.
- Calls made outside this API, such as in the Bedrock console, are not counted.

SarvoAI is off in the AWS TEST environment (`SarvoAiEnabled` defaults to `false`). While it is off, no reservations are made. The template refuses `SarvoAiEnabled=true` without a pricing approval, and the application refuses every call if that approval is invalid or expired. A TEST pilot may be enabled only through the checks in [TEST pilot](#test-pilot) below.

## 5. Check it works

As an HQ user, ask a question through the API:

```
curl -X POST "$API_BASE_URL/assistant/questions" \
  -H "Authorization: Bearer $HQ_TOKEN" -H "Content-Type: application/json" \
  -d '{"question":"How many districts are there?"}'
```

| Response | Meaning |
|---|---|
| 200 with `kind` and `summary` | Working |
| 503 "not switched on" | `SARVOAI_ENABLED` is not `true` |
| 503 "not available right now" | The Bedrock call failed: check the API logs for `AccessDeniedException` (policy or model access) or `ValidationException` (model ID or Region) |
| 403 | The signed-in user is not HQ |
| 429 `LIMIT_REACHED` | The monthly spending limit is reached |
| 503 "paused", with `sarvoai_calls_blocked` in the logs | The pricing approval or `SARVOAI_MONTHLY_LIMIT_USD` is missing, invalid or expired, the model is unsupported, the request has no safe limit, or a hold is waiting for review. The log gives the reason |

Each question produces a `SARVOAI_QUESTION` audit event containing the actor, outcome kind and tool names. Questions and answers are not stored in that event.

## Consolidation and pilot readiness

PR #97's `AssistantSpendingService` is the only spending mechanism. This branch
removes the unmerged flat-USD-2 allowance, its SQL function/model and its separate
review-date setting. That obsolete migration was never deployed by this work;
if anyone applied it independently, review that environment before deploying.
The two spending migrations from main remain unchanged; this PR adds no migration.

The runtime role needs SELECT, INSERT and UPDATE on `assistant_monthly_spend`,
`assistant_spend_reservations` and `assistant_spend_holds` for #97's ledger.
This branch does not deploy grants or replace that ledger with a second mechanism.
Direct table writes and API-clock month/expiry boundaries remain #97 limitations;
review restricted SQL-function access and database clock handling separately.

## TEST pilot

The obsolete `TestAiDisabled` template rule is removed: the application spending
limit it waited for now exists. SarvoAI in TEST is still off by default, and turning
it on is a deliberate, reviewed deployment that follows the
[TEST pilot plan](sarvoai-test-pilot-plan.md).

**Pilot scope.** HQ users only, and only fictional societies whose S number starts
`TEST-` in the district with code `TEST-ONLY` (`SARVOAI_FICTIONAL_ONLY=true`, which
the template forces for `Stage=test`). The existing `99999TEST` society does not
match that scope and SarvoAI cannot see it; create new `TEST-` societies in the
`TEST-ONLY` district for the pilot rather than renaming it.
[`sarvoai-pilot-district.sql`](../infrastructure/aws/test/sarvoai-pilot-district.sql)
adds that district; HQ creates the societies through the normal Create society flow.

**Checks required before deploying.** All of them, recorded, on the day:

1. **Current pricing approval.** Prices re-checked against the AWS Price List; an
   approval line whose `reviewedOn` is not in the future and whose `expiresOn` is
   at most 31 days later and still ahead.
2. **Runtime database privileges.** The runtime role has SELECT, INSERT and UPDATE
   on all three tables above (and USAGE on the `assistant_spend_status` type), and
   both ledger migrations are applied. The migrations being deployed does not prove
   the grants: run
   [`sarvoai-pilot-checks.sql`](../infrastructure/aws/test/sarvoai-pilot-checks.sql)
   as the database owner. It is read-only.
3. **Fictional-only scope.** The same script lists every society SarvoAI could see
   in TEST; each must be fictional, and no real society may sit in `TEST-ONLY`.
4. **Lambda throttling and capacity.** A question keeps one Lambda environment
   busy for up to about 22 seconds, and TEST has very little reserved concurrency.
   Review this with issue #104 (PR #105) and deploy from a `main` that contains
   the agreed TEST capacity settings.

Local fake-model and disposable-database checks do not establish live model access,
answer quality or actual AWS billing.
