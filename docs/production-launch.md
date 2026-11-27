# Sarvodaya Connect production launch

The current application uses a Next.js dashboard and a Flutter app for Android
and iOS. Both call the NestJS API on AWS Lambda through API Gateway. Cognito
authenticates users, Prisma connects the API to private PostgreSQL on RDS, and
S3 stores private documents. SarvoAI uses the API's HQ access checks, read-only
tools and Bedrock spending ledger, with LangGraph orchestration in AgentCore
Runtime. The runtime receives operation metadata over a signed WebSocket. The
API handles the question, model calls, tool data and answer.

## Deployment and verification

1. Identify the approved AWS production account and existing stacks in Singapore.
   Check for a production VPC and private subnets, RDS and backup settings, a
   documents bucket, Cognito and an Amplify app. The API template consumes these
   as inputs. If they do not exist, provision the agreed production foundation
   before creating the API stack. Confirm ownership of the domain and which
   records, if any, Sarvodaya has approved for import.
2. Use a production Cognito pool with separate dashboard and mobile public
   clients, production Secrets Manager entries, and an isolated documents bucket.
   Apply the release commit's Prisma migrations with the production migration
   role after checking recoverability. Use a separate restricted database role
   for Lambda. Follow [AWS configuration](aws-configuration.md) for inputs,
   and confirm HTTPS access, private S3 permissions and dashboard-origin CORS.
3. Deploy the API with `Stage=production` and use its `ApiBaseUrl` output across
   Amplify and mobile release settings. Keep the existing TEST clients and
   their build destinations available for internal checks.
4. For production SarvoAI, use a separate stack with
   `infrastructure/aws/agentcore-test.yaml` and `Stage=production`. Follow the
   two-step ECR and runtime sequence in [AgentCore deployment](sarvoai-agentcore-test.md)
   with a production stack name and production tags. Use the `RuntimeArn` output
   as `SarvoAiProductionRuntimeArn` on the API stack. Before enabling it,
   obtain Sarvodaya's approval for the data and model-processing geography,
   verify Bedrock access in the production account, and set the approved model,
   current pricing approval and monthly limit. The TEST pilot approval covered
   fictional data. Review consent and privacy disclosures for any data sent
   to third-party AI under [Apple's App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
   Keep `SarvoAiEnabled=false` until that work is approved and verified.
5. Smoke-test web and signed Android and iOS builds against the same API.
   Verify sign-in with assigned roles, rejection of a TEST token, a representative
   society record, a private document upload and download, and a permission denial
   outside the user's scope. When SarvoAI is enabled, verify an HQ answer against
   a known record, non-HQ denial, the configured runtime invocation, and cost
   reservations settling. Record the release commit, deployment stack outputs,
   and the tested store build identifiers.

## Store builds

Create two GitHub release environments, `play-production` and
`app-store-production`, restricted to `main`. Reuse the existing approved
signing identities for the existing app records. In each production environment
set these variables from the approved deployment and metadata:

| Variable | Value |
| --- | --- |
| `PRODUCTION_API_BASE_URL` | HTTPS production API stack output ending in `/api/v1` |
| `PRODUCTION_COGNITO_USER_POOL_ID` | Production pool ID |
| `PRODUCTION_COGNITO_CLIENT_ID` | Production public mobile client ID |
| `PRIVACY_POLICY_URL` | Public HTTPS Sarvodaya Connect privacy policy, also linked from sign-in |

Configure the corresponding signing secrets and certificate/team variables from
[Google Play releases](google-play-releases.md) and
[TestFlight releases](testflight-releases.md). The production build jobs only
create signed artifacts, so they need no Play publishing role or App Store
Connect upload key. An operator uses the existing store accounts for submission.

From `main`, dispatch **Android internal release** and **iOS internal release**
with **Target = production**, **Publish off**, and **Translation review off**.
Choose version numbers after checking each console's upload history. Download
the signed AAB and IPA and record their SHA-256 checksums. The iOS production
export is eligible for App Store submission after Apple processes it. The
default target remains TEST for both workflows.

## Store review and release

| Google Play Console | App Store Connect |
| --- | --- |
| Use the existing Android app record and upload the signed AAB to the eligible release track. Check whether the account has Production access. For a new personal account, check the [closed-testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465). | Upload the production IPA with Transporter or Xcode. Select the build on the existing app record's release version and complete export-compliance and age-rating questions. |
| Complete the store listing and [App content](https://support.google.com/googleplay/android-developer/answer/9859455) declarations, including Data safety, App access, content rating, target audience and privacy policy. | Complete the listing and [App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), enter support and privacy URLs, and fill in App Review information. |
| Enter access instructions in App access. Submit the release for review after verifying the country selection. | Provide review credentials in App Review information and follow [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app). Select manual release so the launch date can be coordinated. |

Use screenshots with fictional records. Reviewers need a working account and
access to the features being reviewed. Scope reviewer accounts to fictional
records. If HQ-only SarvoAI is included, use an isolated reviewer environment
with fictional data and arrange review access with Sarvodaya before submission.
Provide review credentials in the store consoles.

### Listing copy for owner review

**Short description**

Manage Sarvodaya society records, activities and reports.

**Description**

Sarvodaya Connect helps authorized Sarvodaya staff and society officers manage
society information, annual figures, Registrar documents, activities and
disaster assessments. Signed-in users see the societies and tools assigned to
their role. To request an account, contact your Sarvodaya administrator.

**Inputs from Sarvodaya**

Approved privacy and support URLs, support contact, privacy declarations and
retention/deletion terms, distribution countries, and permission to use the
chosen store imagery. Confirm whether the App Store listing should be public
or [unlisted](https://developer.apple.com/support/unlisted-app-distribution/)
for an invited audience. Check the installation link on both platforms after
approval and release.
