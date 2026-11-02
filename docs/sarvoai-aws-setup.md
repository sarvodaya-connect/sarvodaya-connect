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
```

While `SARVOAI_ENABLED` is not `true`, the endpoint answers 503 and nothing is sent to AWS. Keep it `false` for local development.

## 4. Set a budget alert

In **AWS Budgets**, create a monthly cost budget of **USD 20** filtered to the Claude Haiku 5.5 Marketplace charges (they appear under the model provider, not under Amazon Bedrock), with alerts at 80% and 100%. At about 1,000 questions a month the model costs about USD 2.

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

Each question is recorded as a `SARVOAI_QUESTION` audit event (who asked, the question, and which tools ran). Answers are not stored.
