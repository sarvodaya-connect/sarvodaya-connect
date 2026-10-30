# V4 platform foundation (SC-63)

This change implements the local identity/access foundation and its mobile/HQ entry screens. AWS deployment and production provider wiring are the next integration step. No AWS resources or production credentials are created here.

## Screen ownership

| SC-63 responsibility | Screen / implementation |
|---|---|
| Shared splash, language, username sign-in | M01–M03; existing brand/language screens and updated sign-in |
| Account details, password setup, expired credential, account ready | M04, M04t, M04b, M04x, M04c; mobile activation and browser `/activate` (initial local HQ / legacy pending accounts) |
| SO, SPC, assigned DDM, temporary DDM, DM, HQ homes | M05, M05s, M05d, M05t, M05m, M05h |
| HQ sign-in and accounts/invitations | D01 `/`, D16/D16i/D16t `/accounts` |
| Access/audit and standard loading/error/empty states | D24 `/audit`, D21 shared page states |
| Server authority for temporary DDM access | DM mobile entry and `/identity/district-access` |

SC-65 owns the complete society/annual-summary/document UI; SC-66 owns the detailed ExCo/work-plan and final M30–M33 access-screen presentation; SC-67 owns the national overview/directory/grade UI; SC-68 owns disaster-response workflows. Their screens can call the APIs below. The mobile society directory/detail in this change is an authenticated integration entry point for those features. Existing document/activity UI demos remain demonstration flows until their corresponding integration work is complete. Offline-only screens, queued submissions and sync changes are excluded from SC-63.

## Roles and scopes

| Role | Society read | Society update |
|---|---|---|
| Society Officer | One assigned society | That society |
| SPC | Assigned societies | Assigned societies |
| DDM | Assigned societies plus currently delegated district | Assigned societies only |
| DM | Own district | None |
| HQ | National | National |

`PROGRAMME_COORDINATOR` is retained as the wire value for SPC, to preserve the existing API contract. It does not introduce a sixth business role. The five-role contract is in `packages/api-contracts/src/identity.ts`; additional account/session/delegation types are in `platform.ts`, mirrored by the Dart user model. A district affiliation on SPC/DDM accounts never grants whole-district read permission. DDM grants are checked against server time and refreshed from PostgreSQL for every authenticated request. Start times, expiry and revocation affect access without needing a new login. Role/scope changes revoke sessions and temporary grants.

Anyone who can view a society can request its members' full NICs, including a DM or a DDM with active temporary view. Revealing a NIC never grants edit permission.

## Local setup

Use Node 24, Flutter stable compatible with `pubspec.yaml`, and local PostgreSQL. Copy `.env.example` to an ignored `.env` and set `DATABASE_URL`. Use fictional records during development.

1. In `apps/api`, run `npm ci`, `npm run prisma:generate` and `npm run prisma:deploy`. The new migration is `20261029140000_v4_identity_access`.
2. Set `NODE_ENV=development`, `DATABASE_CONNECTION_LIMIT=2`, and a local `NIC_ENCRYPTION_KEY`. Generate the latter with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`; save it only in the ignored environment file. Never commit or log NICs, permanent passwords or access tokens.
3. Create the initial local HQ invitation with `BOOTSTRAP_HQ_USERNAME=local.hq npm run identity:bootstrap` from `apps/api`. This works only in development/test and only while no HQ account exists. It prints a one-time credential once; it never creates or displays a permanent password.
4. Start the API (`npm run start:dev`). In `apps/dashboard`, run `npm ci` and `npm run dev`. Set `API_BASE_URL=http://localhost:3001/api/v1` for the dashboard server and `DASHBOARD_PUBLIC_URL=http://localhost:3000` for invitation links.
5. Open `/activate`, enter the initial local HQ credential, check the account details and choose a password. Sign in at `/`. From `/accounts`, HQ creates each staff account with a username and permanent password, selecting the role, district and societies. HQ hands both credentials to the assigned person using a secure method. Ordinary new accounts are active immediately and do not need to complete an activation flow.
6. Run the mobile app with `flutter run --dart-define=SC_DEMO_MODE=false --dart-define=API_BASE_URL=http://10.0.2.2:3001/api/v1` for an Android emulator. iOS simulator uses `http://127.0.0.1:3001/api/v1`. Physical devices need a reachable development API host; use HTTPS for hosted environments. Sign in with an activated staff account.

For a fictional UI demonstration, mobile `SC_DEMO_MODE=true` retains the demo account/role previews. Dashboard `PLATFORM_DEMO_MODE=true` explicitly enables HQ demo viewing only outside production. Demo identities are never accepted in production. API-backed accounts remain authoritative for real requests.

## Account and activation rules

HQ alone creates accounts, usernames and permanent passwords, and changes assignments. HQ can set a replacement password for any active account when the assigned person changes; doing so invalidates existing sessions. Passwords are stored only as salted scrypt hashes, so HQ can set a new password but cannot retrieve the old one. Passwords require 10–128 characters and a number and must differ from the username. SO scope is exactly one society. SPC/DDM scopes contain one or more societies in their district; DM has a district and no explicit society list; HQ has national scope. Unknown roles and invalid district/society combinations are rejected.

The initial local HQ bootstrap and any legacy pending accounts use single-use invitation credentials, stored only as SHA-256 hashes and expiring after 72 hours. For regular staff accounts, HQ sets the permanent password during creation. Passwords are stored as salted scrypt hashes. Replacing a password invalidates existing sessions. Disabling an account invalidates its sessions. Local sessions expire after eight hours; clients hold mobile tokens in memory and the dashboard uses an HttpOnly SameSite cookie. Local sign-in has a five-attempt/15-minute username throttle; production rate limiting belongs to the production identity provider and API entry.

Local credentials, activation and sessions deliberately fail closed outside development/test. `SessionAuthenticationProvider` and `AuthenticationProvider` are the replacement points for AWS Cognito verification. Cognito challenge handling, SMS delivery and deployment are AWS integration work, not claimed as deployed here. Avoid putting any real personal data into a development instance with demo authentication enabled.

## API surface

All paths are under `/api/v1`. DTO validation rejects unsupported body fields.

| Endpoint | Authorization / behavior |
|---|---|
| `POST /identity/login` | Local username/password; returns token and verified principal |
| `POST /identity/activation/check` | Validate one-time credential and show HQ-assigned details |
| `POST /identity/activation/complete` | Consume credential and choose permanent password |
| `GET /identity/me`, `POST /identity/logout` | Current principal / revoke current local session |
| `GET /identity/scope-options` | HQ district/society choices, including every society beyond the first list page |
| `GET/POST /identity/accounts` | HQ list / create active account with an HQ-set password |
| `PUT /identity/accounts/:id` | HQ role/assignment update; sessions/grants revoked |
| `POST /identity/accounts/:id/password` | HQ sets a replacement password; old sessions revoked |
| `POST /identity/accounts/:id/invitation` | HQ recovery/reissue; no permanent password visibility |
| `POST /identity/accounts/:id/disable` | HQ disable; self-disable rejected |
| `GET /identity/district-deputies` | DM's active district DDM choices |
| `GET/POST /identity/district-access` | Scoped history / DM grants view-only access to own district DDM |
| `POST /identity/district-access/:id/revoke` | District DM or HQ; immediate early revoke |
| `GET /identity/audit` | Latest 200 events in current society/district scope; HQ national |
| `GET /societies`, `GET /societies/:id` | Authenticated scoped reads; inaccessible details return 404 |
| `PUT /societies/:id/council/:memberId/nic` | Assigned editors or HQ; encrypted at rest |
| `POST /societies/:id/council/:memberId/nic/reveal` | Anyone with current society read scope; no-store response, logged reveal |

NIC storage uses AES-256-GCM with a unique random IV and society/member IDs as authenticated associated data. The ordinary registry response includes only the final four characters. Mobile hides reveals after 30 seconds and when backgrounded. Audit records contain the actor, action and record IDs, never the full NIC or credentials. Profile/council/membership edits write their audit event in the same transaction. Council updates preserve encrypted NIC data only when the seat and member identity remain unchanged; replacing a member requires recording the new NIC.

## AWS integration handoff

- Singapore PostgreSQL uses the existing Prisma migration history. Apply migrations with a dedicated migration role before starting the new API. Back up the database before deployment; do not reset shared databases.
- Set the production `DATABASE_URL` with TLS and a private RDS address. Supply database credentials and `NIC_ENCRYPTION_KEY` from the secret store, not Git or a browser environment variable. Keep database backups and the NIC key recoverable separately. Key rotation requires decrypt/re-encrypt migration; replacing the key alone makes old ciphertext unreadable.
- The PostgreSQL pool defaults to two connections per API instance with a five-second acquisition timeout. Set Lambda reserved concurrency based on the RDS connection budget and measured load before launch; 300 MAU does not establish peak concurrency. No RDS Proxy is enabled here.
- Use the existing S3 storage adapter with a private bucket and signed URLs. The API needs outbound HTTPS for Cognito/FCM and any external services; confirm the NAT-instance route/security groups in the initial cost architecture.
- Connect Cognito account provisioning/verification through the identity boundary and map subjects to the persisted account. Roles and assignments are loaded server-side; never accept client role claims or enable demo headers in production. Preserve the activation/check/complete and session-principal contract consumed by the UIs.
- Amplify hosts the Next.js 15 HQ dashboard. Configure its server-side API URL and session/identity integration. Cloudflare continues hosting the separate public landing page.
- Use production HTTPS, restricted API origins, log redaction, account recovery, backups, alarms and AWS Budgets. Exercise reissue, disable, session expiry, delegation revocation and NIC audit before real staff access.

No production deployment, AWS spend, store publication, production secrets or new offline behavior are introduced by SC-63.
