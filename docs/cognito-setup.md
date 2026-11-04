# Amazon Cognito sign-in: setup and local development

How staff sign in to the dashboard and the phone app with Amazon Cognito, how HQ manages accounts, and how to run each mode locally. The test foundation in `infrastructure/aws/test/` can create an admin-only test pool after review and manual deployment; see `docs/aws-test-environment.md`. No workflow deploys it or stores AWS credentials.

## How it works

1. **Sign-in.** The dashboard (on its server, in a server action) or the phone app sends the username and password to the Sarvodaya user pool (`InitiateAuth`, `USER_PASSWORD_AUTH`) using a **public app client**. There is no client secret, and no AWS credentials are used. Cognito returns an access token, an ID token and a refresh token.
2. **API calls.** The client sends the **access token** as `Authorization: Bearer …`. The API checks it with `aws-jwt-verify` against the pool's public keys (JWKS): the signature, the issuer (`https://cognito-idp.<region>.amazonaws.com/<pool id>`), the expiry, `token_use = access`, and that `client_id` is one of `COGNITO_CLIENT_ID`. Anything else is refused with 401.
3. **Who it is.** The token's `sub` is looked up in `platform_accounts.provider_subject`. The account must be `ACTIVE`. Its role, district, societies and any temporary DDM grant are read from the database on every request. Nothing about role or scope is taken from the token or the client, and every existing rule (Society Officer, SPC, DM, DDM, HQ) applies unchanged.
4. **Ended sign-ins.** When HQ sets a new password, changes a role or disables an account, the API stores `sessions_revoked_at`. Tokens from a sign-in before that time are refused, even if they have not expired (checked with the token's `auth_time`). The API also asks Cognito to sign the user out everywhere (`AdminUserGlobalSignOut`), which revokes their refresh tokens.
5. **Sign-out.** The client revokes its refresh token (`RevokeToken`) and forgets the tokens.

| Client | Where the tokens are kept | Refresh |
|---|---|---|
| Dashboard | `httpOnly` cookies: `sc_session` (access token, expires a minute before the token), `sc_refresh` (8 hours), `sc_role` (screen routing only) | `middleware.ts` gets a new access token when `sc_session` has gone; if Cognito refuses, the cookies are removed and the person signs in again |
| Phone app | In memory only (as before); signing in again after the app is closed | `IdentityApi` refreshes a minute before expiry; if Cognito refuses, the app signs out |

## HQ account management (V5 D16)

HQ keeps the agreed workflow: it creates a staff account with a username and a **permanent** password, and can set a replacement password later. The API does the Cognito work with **its own IAM role**. The dashboard and phone app never have admin rights.

- **Create** (`POST /identity/accounts`): the API saves the account as `PENDING` (it cannot sign in), finds or creates the Cognito user (`AdminCreateUser`, no invitation message), sets HQ's password as permanent (`AdminSetUserPassword`, `Permanent: true`), enables it, then links the user's `sub` and marks the account `ACTIVE` in one transaction.
  - If a step fails, the account stays `PENDING` ("Needs a password" on D16). Submitting the same form again, or **Set new password**, resumes it, and never creates a second Cognito user.
  - If the Cognito user is already linked to a different account, the API refuses and leaves that user's password alone.
- **Set new password** (`POST /identity/accounts/:id/password`): sets the permanent password in Cognito, enables the user, ends all their sign-ins (in the API and in Cognito), and records it in the change log. HQ is told to pass the password on in person or by phone, not by email or chat.
- **Change role** and **Disable**: end all sign-ins the same way. Disable also disables the Cognito user. If Cognito cannot be reached for this follow-up, the API still refuses the old sign-in. Only the account id and the reason are logged.
- Passwords go straight to Cognito. They are never stored in the database (`password_hash` stays empty in Cognito mode), logged, written to the change log or returned by the API. The dashboard form clears them after a successful submission.

## Configuration

None of these values is a secret.

| Variable | Used by | Purpose |
|---|---|---|
| `AUTH_PROVIDER` | API, dashboard, phone (`--dart-define`) | `cognito` or `local`. The default is `cognito` in production and release builds, and `local` in development, tests and debug builds. `local` is **refused** in production and in phone release builds. |
| `COGNITO_USER_POOL_ID` | API, dashboard, phone | e.g. `ap-southeast-1_AbC123xyZ`. The region and token issuer come from it. |
| `COGNITO_CLIENT_ID` | API, dashboard, phone | The public app client id. The API accepts a comma-separated list (dashboard and phone clients). |
| `COGNITO_REGION` | API, dashboard, phone | Optional. If set, it must match the pool id, which catches a pool id from the wrong region. |
| `COGNITO_TOKEN_USE` | API | `access` (default). Leave as is: the clients send access tokens. |

**Fail closed.** With `AUTH_PROVIDER=cognito`:
- the API will not start if the pool id or client id is missing or malformed;
- the dashboard shows "Sign-in is not available right now" and logs the reason on the server;
- a phone release build shows "This app is not set up yet".

The API's AWS credentials for account administration come from its Lambda role (default credential chain). Never put AWS keys or a client secret in `.env` files, Amplify variables or `--dart-define` values.

## User pool and app client settings (for the AWS administrator)

These match the app's own rules. Set them when the pool is created; this repository does not create it.

- **Sign-in:** username, **case-insensitive**. Self sign-up **off** (only administrators create users). No required attributes and no email or phone verification, because HQ hands passwords over in person.
- **Password policy:** minimum length 10 and require numbers, with no uppercase, lowercase or symbol requirement. This matches the API's own check (at least 10 characters, a number, different from the username). A stricter pool policy also works: HQ then sees "The sign-in service did not accept this password".
- **Prevent user existence errors:** on.
- **MFA:** off for now (To Confirm with Sarvodaya).
- **App client (one, or one each for the dashboard and phone):**
  - public client, **no client secret**;
  - auth flows `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH`;
  - token revocation on (the default);
  - access token 60 minutes, ID token 60 minutes, refresh token **8 hours**, matching the previous 8-hour sessions and the dashboard's refresh cookie.
- **Lockout:** Cognito applies its own temporary lockout after repeated wrong passwords. Both clients then show "Too many attempts…". Its timing is Cognito's, not the API's 15 minutes.
- **IAM:** the API function needs only the six actions in `infrastructure/aws/template.yaml` (`CognitoAccountAdmin`), on this one pool: `AdminGetUser`, `AdminCreateUser`, `AdminSetUserPassword`, `AdminEnableUser`, `AdminDisableUser`, `AdminUserGlobalSignOut`. It does not need delete, user listing or pool changes.
- **Network:** the API Lambda runs in the VPC, so it needs outbound HTTPS to `cognito-idp.<region>.amazonaws.com` (for JWKS and the admin calls) through the approved NAT instance or gateway, or an interface VPC endpoint for Cognito user pools where it supports these calls.

### First HQ account

HQ cannot create itself from the dashboard, so link the first HQ account once:

1. An AWS administrator creates the user in the pool with a permanent password, then reads its `sub`:
   - `aws cognito-idp admin-create-user --user-pool-id <pool> --username <hq username> --message-action SUPPRESS`
   - `aws cognito-idp admin-set-user-password --user-pool-id <pool> --username <hq username> --password <typed, not saved> --permanent`
   - `aws cognito-idp admin-get-user --user-pool-id <pool> --username <hq username>`, and read the `sub` attribute.
2. From the one-off migration task in the VPC (never a developer machine against production), in `apps/api` run:

   ```
   BOOTSTRAP_HQ_USERNAME=<hq username> BOOTSTRAP_HQ_COGNITO_SUB=<sub> BOOTSTRAP_HQ_NAME="<name>" BOOTSTRAP_HQ_PHONE=<phone> npm run identity:link-cognito-hq
   ```

   It refuses if an HQ account already exists.
3. That HQ signs in on the dashboard and creates every other account from **Accounts**.

## Local development

**Default (no AWS):** `AUTH_PROVIDER=local` in the root `.env`, which is the development default. The API keeps its own scrypt passwords and 8-hour sessions, and `npm run identity:bootstrap` creates the first local HQ (see the README). The dashboard and a debug phone build use `POST /identity/login` as before. Cognito is never contacted.

**Trying Cognito locally** against a **test** user pool (never the production pool):

1. API, in the root `.env`:
   - `AUTH_PROVIDER=cognito`, `COGNITO_USER_POOL_ID=<test pool>`, `COGNITO_CLIENT_ID=<test client>`;
   - AWS credentials for the admin calls from your own named profile (`AWS_PROFILE=<profile>` in your shell, not in `.env`), limited to the six actions above on the test pool.
2. Dashboard: the same three `AUTH_PROVIDER` / `COGNITO_*` values in `apps/dashboard/.env.local` (git-ignored).
3. Phone (debug build):

   ```
   flutter run --dart-define=AUTH_PROVIDER=cognito --dart-define=COGNITO_USER_POOL_ID=<test pool> --dart-define=COGNITO_CLIENT_ID=<test client>
   ```

4. Link a test HQ as in "First HQ account" (with `npm run identity:link-cognito-hq` against your local database). Then create the other test accounts from the dashboard.

## Tests (no AWS needed)

- **API:**
  - `src/auth/cognito-authentication.provider.spec.ts`: real signature and claim checks with a key pair made in the test. It covers valid, expired, wrongly signed, wrong pool, wrong client and ID-instead-of-access tokens, and that configuration fails closed.
  - `src/auth/cognito-account-admin.spec.ts`: the admin commands and their error handling.
  - `test/db/cognito-accounts.db-spec.ts` (PostgreSQL, with Cognito replaced by an in-memory pool):
    - create, link and sign in;
    - a failed step, then a retry with no duplicate;
    - a refused password;
    - a user linked to another account;
    - HQ-only access;
    - a password reset that ends earlier sign-ins;
    - disable;
    - local sign-in refused.
  - `test/db/release-readiness.db-spec.ts`: DDM temporary access and refused users in Cognito mode.
- **Dashboard:**
  - `src/lib/cognito.test.ts` and `src/app/identity-actions.test.ts`: sign-in, error messages, unlinked users, Society Officers, missing configuration, sign-out;
  - `src/middleware.test.ts`: token refresh, and refusal after a revoke.
- **Phone:** `test/cognito_auth_test.dart`: settings, sign-in, errors, refresh, sign-out and the sign-in screen message.

## Not yet verified against a real user pool

Everything above is tested with Cognito replaced or its keys generated locally. Before relying on it, someone with access to a **test** pool should check:

1. Dashboard sign-in, a page load, waiting past the access token's life (or deleting `sc_session`) to see a refresh, and sign-out (the refresh token is then refused).
2. Phone sign-in (debug build with the `--dart-define` values), and sign-out.
3. HQ creates an SPC account, the SPC signs in on the dashboard, and the user appears in the pool as `CONFIRMED` with no invitation email sent.
4. HQ sets a new password. The SPC's open dashboard session ends at its next page load, and the new password works.
5. HQ disables the account. The SPC is refused at once, and the user shows as disabled in the pool.
6. A refreshed access token keeps the original `auth_time`. Step 4 relies on this, and it is Cognito's documented behaviour.
7. The Lambda reaches Cognito from inside the VPC (JWKS and admin calls) through the chosen NAT instance, gateway or endpoint.
