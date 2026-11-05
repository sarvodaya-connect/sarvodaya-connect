# SarvoAI: AWS setup

SarvoAI is the HQ-only question assistant (`POST /api/v1/assistant/questions`). It calls Claude Haiku 5.5 on Amazon Bedrock. These steps are done once per AWS account by someone with administrator access. The code needs no AWS keys: it signs requests with the API task's IAM role.

## How it connects

| Setting | Value |
|---|---|
| Endpoint | `bedrock-runtime` in `ap-southeast-1` (Singapore), InvokeModel |
| Model ID | `global.anthropic.claude-haiku-5-5` (global inference profile) |
| IAM action | `bedrock:InvokeModel` only |

In Singapore, Claude Haiku 5.5 is available only through the **global** inference profile on `bedrock-runtime`. There is no Singapore-only option and no `bedrock-mantle` option for this model. A global profile means **requests can be processed in any supported AWS commercial Region**, not only in Singapore. Sarvodaya should approve this before SarvoAI is switched on, because questions and the tool results sent to the model include society names, Exco names and yearly totals. NICs, phone numbers, emails and passwords are never sent.

## 1. Turn on the model

1. Sign in to the AWS console as an administrator and switch the Region to **Asia Pacific (Singapore)**.
2. Open **Amazon Bedrock → Model catalog** and choose **Claude Haiku 5.5**.
3. If asked, submit Anthropic's first-time use form. Claude models are sold through AWS Marketplace, so the account subscribes on first use. The person doing this needs `aws-marketplace:Subscribe` and `aws-marketplace:ViewSubscriptions`; the API role does not.
4. Try a prompt in the console playground to confirm access.

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
```

While `SARVOAI_ENABLED` is not `true`, the endpoint answers 503 and nothing is sent to AWS. Keep it `false` for local development.

## 4. Set a budget alert

In **AWS Budgets**, create a monthly cost budget of **USD 20** filtered to the Claude Haiku 5.5 Marketplace charges (they appear under the model provider, not under Amazon Bedrock), with alerts at 80% and 100%. At about 1,000 questions a month the model costs about USD 2.

AWS Budgets only sends alerts. It does not stop model calls. The application's own limit, below, is what stops them.

## Monthly spending limit

SarvoAI refuses to call the model once its estimated spending would pass `SARVOAI_MONTHLY_LIMIT_USD`. The USD 20 default is a ceiling. It is not money set aside, and it is not an amount to add to the monthly forecast: expected spending should reflect actual anticipated use.

**This is not an AWS billing cap.** It covers only SarvoAI calls made through this API, and it uses the application's own estimate. It does not limit anything else in the AWS account, and AWS's bill can differ from it. Keep the AWS Budgets alert.

### How it works

| Step | What happens |
|---|---|
| Month | A UTC calendar month. The limit resets at 00:00 UTC on the 1st, which is 5:30 a.m. in Sri Lanka |
| Before each model call | One atomic PostgreSQL statement adds a high estimate to the month's total, only if the total stays within the limit. It holds across simultaneous requests and API instances. A question can make up to 6 model calls, and each one reserves separately |
| At the limit | No model call is made. The API answers 429 (`LIMIT_REACHED`) with the date SarvoAI returns, and the dashboard and phone show that message. A refusal part-way through a question stops that question |
| After a successful call | The estimate is replaced by the cost of the tokens the provider reported |
| Provider refused the call (400, 401, 403, 404, 413, 422, 429) | Nothing was billed, so the reservation is released |
| Timeout, dropped connection, 5xx, or a response without usable token counts | The call may have been billed, so the full reservation stays counted until the month ends |
| API instance stops mid-call, or the ledger update fails | The reservation stays open and stays counted until the month ends |

The SDK's automatic retries are off (`maxRetries: 0`), because a retry after a timeout could be billed twice under one reservation. Asking again makes a new request with its own reservation, so repeated or duplicate questions each count. Model calls time out after 25 seconds, inside the API's 29-second Lambda timeout.

The records are in `assistant_monthly_spend` and `assistant_spend_reservations`. They hold the month, model ID, amounts, token counts and status: no prompts, answers or who asked. The existing `SARVOAI_QUESTION` audit event is separate and records `SPENDING_LIMIT` when a question is refused.

To check the current month (amounts are in millionths of a US dollar):

```sql
SELECT month, committed_micro_usd / 1000000.0 AS usd FROM assistant_monthly_spend ORDER BY month DESC LIMIT 3;
```

### Pricing assumptions

| Claude Haiku 5.5 | USD per million tokens |
|---|---|
| Input | 0.10 |
| Cache write (5-minute, 1.25 × input) | 0.125 |
| Cache read (0.1 × input) | 0.01 |
| Output | 0.50 |
| Prompts over 100,000 tokens | 5 × all of the above, for the whole request |

These are Anthropic's published list prices, checked on 5 November 2026 at <https://platform.claude.com/docs/en/about-claude/pricing>. **Amazon Bedrock sets its own prices, and the AWS pricing page did not show a figure for this model when checked.** Before switching SarvoAI on, compare them with the AWS price list or a real invoice, and set `SARVOAI_INPUT_USD_PER_MTOK` and `SARVOAI_OUTPUT_USD_PER_MTOK` if they differ. The cache and long-prompt multiples are fixed in `apps/api/src/assistant/assistant-cost.ts`. Changing `SARVOAI_MODEL_ID` to any other model requires both prices; without them SarvoAI refuses every call.

### Token and output bounds

| Bound | Value |
|---|---|
| Output per model call | 8,000 tokens (`max_tokens`) |
| Model calls per question | 6 |
| Question | 500 characters |
| Earlier turns sent | 10, at most 2,000 characters each |

Each reservation counts every UTF-8 byte of the request as a whole token, plus 1,000 tokens of overhead, all at the cache-write price, plus the full 8,000 output tokens. At the prices above that is about USD 0.005 for a first call (USD 0.004 of it output), so about USD 0.03 for a question that uses all 6 calls, a little more as tool results grow the request, and five times that for any request over 100,000 tokens. Most calls settle far lower.

### Limitations

- It is an estimate from token counts and the configured prices, not AWS's bill. Taxes, price changes, discounts and rounding are not reflected.
- The limit can refuse slightly early: open reservations count at their high estimate, so a question can be refused while others are in progress even though those will settle lower. Trying again shortly afterwards may succeed.
- Uncertain calls stay counted at the full reservation, so many timeouts use up the limit faster than real spending.
- Reported usage can, in principle, cost more than its reservation. The actual figure is recorded and a warning logged, so a month can end slightly above the limit by at most that difference.
- Changing the limit takes effect on the next call. Lowering it below the amount already committed refuses further calls; it does not undo anything.
- Calls made outside this API, such as in the Bedrock console, are not counted.

SarvoAI stays off in the AWS TEST environment (`SarvoAiEnabled` is `false`) until this has been reviewed and validated. While it is off, no reservations are made.

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
| 503 "not available right now", with `SpendingConfigError` in the logs | `SARVOAI_MONTHLY_LIMIT_USD` or the model prices are invalid, so every call is refused |

Each question is recorded as a `SARVOAI_QUESTION` audit event (who asked, the question, and which tools ran). Answers are not stored.
