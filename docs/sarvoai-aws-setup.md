# SarvoAI: controlled TEST pilot

SarvoAI is HQ-only (`POST /api/v1/assistant/questions`). It is **disabled by
default**. This change prepares a fictional-data pilot; merging it does not
apply migrations, enable Bedrock, accept Marketplace terms or deploy anything.

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

The tools return honest empty results if no fictional societies exist yet. They
must not substitute demonstration rows into a production-mode answer. Dedicated
behavioral/database verification for these additions is still outstanding; build
and lint results alone do not establish authorization or query correctness.

## Shared monthly admission allowance

Migration `20261107090000_sarvoai_monthly_allowance` adds an isolated ledger and a
security-definer function. It changes no existing society/member rows. The runtime
`sc_test_app` receives only EXECUTE on that function, with direct ledger access
revoked, including grants inherited from the migration owner's default privileges.
The migration owner remains able to inspect the ledger. Other runtime roles need
separately reviewed grants; they fail closed until those are supplied.

Before **each** provider request, a single PostgreSQL INSERT/conditional UPSERT
reserves **USD 2 (200 cents)** from a **USD 20 (2,000 cents) UTC-month allowance**.
The shared row lock serializes concurrent Lambda admissions, including first use
of the month. A denied reservation makes no provider call. No caller-supplied
month, cap or amount is accepted. There is no runtime reset or refund API.

At most **10 provider attempts per UTC month** are admitted in this initial pilot.
A question can need several attempts/rounds (up to six), so this is not ten
questions. Every retry from the browser needs fresh reservations. SDK automatic
retries are disabled. Errors, timeouts, aborts, process crashes and ambiguous
outcomes keep their full reservation; no unsafe refund occurs after a possibly
billable request. Database errors or missing migration/grants block inference.
A new month creates a fresh row rather than clearing historical accounting.

This is deliberately conservative admission accounting, **not the actual bill**,
and reserving USD 2 does not charge USD 2. Before enabling, the owner must confirm
that the standard on-demand global-profile price is no higher than **USD 1 per
million input tokens and USD 5 per million output tokens**, including long-context
rates, and that no fixed commitment or extra paid feature is enabled. These are
review ceilings, not a claim about today's account-specific rate. The reviewed
model has a maximum 1M-token context; even charging a full 1M input at the ceiling
plus 2,048 output tokens costs at most USD 1.01024, below the USD 2 reservation.
The application also limits request JSON to 64 KiB, disables explicit prompt
caching and extended thinking, bounds tool calls to four per round, uses a
22-second question deadline and limits output to 2,048 tokens per model call.

`SARVOAI_PRICE_REVIEW_UNTIL` must contain a valid, future UTC date at most 31 days
away. It expires at midnight **starting** that date. Empty, expired or excessively
future values block calls. Recheck prices and model limits before renewing it.
A changed model ID is refused; enabling a different model needs a new cost review.
The original USD 70 AWS budget remains an alert, not an enforcement mechanism.
The gate covers attempts admitted through this application, not console/other
Bedrock callers, taxes, infrastructure charges or AWS invoice posting dates.

## Model, endpoint and processing location

- Model/profile: `global.anthropic.claude-haiku-5-5`.
- Endpoint: `bedrock-runtime`, invoked from Singapore (`ap-southeast-1`).
- Credentials: Lambda execution role, no embedded keys or bearer token.
- IAM: `bedrock:InvokeModel` on only the reviewed inference profile/model ARNs,
  conditional on `SarvoAiEnabled=true`; no permission for new tools or services.
- The **global** profile can process requests outside Singapore. Obtain owner
  approval for this fictional-data pilot before enabling. Real society/Exco data
  needs a separate processing-location and privacy decision.

## Owner-led rollout (after PR review)

1. Keep `SARVOAI_ENABLED=false`. Apply the reviewed migration through the secure
   private migration session as the migration owner, not `sc_test_app`.
2. Verify concurrently, with a disposable local database and fictional data, that
   exactly ten reservations are admitted and that an eleventh is refused; verify
   runtime direct SELECT/INSERT/UPDATE/DELETE and reset attempts are denied.
   Verify month rollover and DB/provider failure paths. No automated tests were
   added or run as part of this change; this verification is outstanding.
3. In Bedrock's model catalog, inspect this account's actual model offer/prices
   and current model limits. Complete Anthropic's first-time-use form if needed.
   Do not invoke the playground as a shortcut: it bypasses the application cap.
   Marketplace prerequisites/terms are an owner action; do not add Marketplace
   subscription permissions to the Lambda runtime role.
4. Approve fictional-data global routing and the price ceilings above. Set a short
   `SarvoAiPriceReviewUntil` expiry and `SarvoAiEnabled=true` in a reviewed API
   change set. TEST forces fictional-only tools. Preview IAM/environment changes
   before execution; do not replace the foundation or database.
5. Package/deploy the API, then ask **one** HQ question: `What districts are
   available?` The answer should contain only the fictional test district. Start
   with one question; inspect the allowance row as the migration owner afterward.
   Do not fill the monthly ledger just to test exhaustion on the live database.
6. Inspect logs for safe failure reporting and confirm non-HQ access is denied.
   A 503 allowance message means a missing/expired review, missing permissions,
   ledger failure or exhaustion; operator inspection must distinguish these.
7. Roll back enablement with `SarvoAiEnabled=false`. Keep the ledger/history;
   never reset the allowance to work around failures or redeployments.

## Sources reviewed 5 November 2026

- [AWS model card (context/output limits, global profile and tiers)](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html)
- [AWS Bedrock pricing (verify account offer before enabling)](https://aws.amazon.com/bedrock/pricing/)
- [AWS model access and Marketplace prerequisites](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)
- [AWS token counting limitations for CRIS models](https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html)

More efficient exact-token reservation/reconciliation can follow after the pilot.
It must preserve pessimistic accounting for failed/ambiguous attempts and atomic
admission; average historical costs or Budget alerts are not safe substitutes.
