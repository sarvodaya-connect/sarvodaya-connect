# V4 platform foundation (SC-63)

This change implements the local identity/access foundation and its mobile/HQ entry screens. AWS deployment and production provider wiring are the next integration step. No AWS resources or production credentials are created here.

## Screen ownership

| SC-63 responsibility | Screen / implementation |
|---|---|
| Shared splash, language, username sign-in | M01–M03; existing brand/language screens and updated sign-in |
| SO, SPC, assigned DDM, temporary DDM, DM, HQ homes | M05, M05s, M05d, M05t, M05m, M05h |
| HQ sign-in and accounts | D01 `/`, D16/D16i/D16t `/accounts` (V5, see below) |
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
3. Create the first local HQ account from `apps/api`. Type the password without echoing it, then run the bootstrap: `read -rs BOOTSTRAP_HQ_PASSWORD && export BOOTSTRAP_HQ_PASSWORD`, then `BOOTSTRAP_HQ_USERNAME=local.hq npm run identity:bootstrap`. This works only in development/test and only while no HQ account exists. The password is stored as a scrypt hash and never printed.
4. Start the API (`npm run start:dev`). In `apps/dashboard`, run `npm ci` and `npm run dev`. Set `API_BASE_URL=http://localhost:3001/api/v1` for the dashboard server.
5. Sign in at `/`. From `/accounts` (V5 D16), HQ creates each staff account with a username and permanent password, selecting the role and its scope (D16i). HQ gives both to the person. Accounts are active straight away; there is no activation step. If someone forgets their password, HQ sets a new one (D16t).
6. Run the mobile app with `flutter run --dart-define=SC_DEMO_MODE=false --dart-define=API_BASE_URL=http://10.0.2.2:3001/api/v1` for an Android emulator. iOS simulator uses `http://127.0.0.1:3001/api/v1`. Physical devices need a reachable development API host; use HTTPS for hosted environments. Sign in with an activated staff account.

For a fictional UI demonstration, mobile `SC_DEMO_MODE=true` retains the demo account/role previews. Dashboard `PLATFORM_DEMO_MODE=true` explicitly enables HQ demo viewing only outside production. Demo identities are never accepted in production. API-backed accounts remain authoritative for real requests.

## Account rules (V5)

HQ alone creates accounts, usernames and permanent passwords, and changes assignments. HQ can set a replacement password for any active account when the assigned person changes; doing so invalidates existing sessions. Passwords are stored only as salted scrypt hashes, so HQ can set a new password but cannot retrieve the old one. Passwords require 10–128 characters and a number and must differ from the username. SO scope is exactly one society. SPC/DDM scopes contain one or more societies in their district; DM has a district and no explicit society list; HQ has national scope. Unknown roles and invalid district/society combinations are rejected.

HQ sets every permanent password, at creation and when replacing one. Passwords are stored as salted scrypt hashes and are never returned, displayed or logged; the accounts list shows only when HQ last set the password. Replacing a password invalidates existing sessions and clears any sign-in lockout. Disabling an account invalidates its sessions. Local sessions expire after eight hours; clients hold mobile tokens in memory and the dashboard uses an HttpOnly SameSite cookie.

Every failed sign-in returns the same message, whether or not the username exists. After five wrong passwords an account is locked for 15 minutes. The count and lock time are stored on the account row (`failed_login_count`, `locked_until`), so the lock holds across API instances such as separate Lambda invocations. Production rate limiting also belongs to the production identity provider and API Gateway.

Accounts created before V5 that never completed activation show as "Needs a password"; HQ setting a password activates them. The V4 invitation and activation endpoints, the dashboard `/activate` page and the phone activation and first-run screens have been removed. The `account_invitations` table is kept so no data is dropped; nothing writes to it.

Local credentials, activation and sessions deliberately fail closed outside development/test. `SessionAuthenticationProvider` and `AuthenticationProvider` are the replacement points for AWS Cognito verification. Cognito challenge handling, SMS delivery and deployment are AWS integration work, not claimed as deployed here. Avoid putting any real personal data into a development instance with demo authentication enabled.

## API surface

All paths are under `/api/v1`. DTO validation rejects unsupported body fields.

| Endpoint | Authorization / behavior |
|---|---|
| `POST /identity/login` | Local username/password; returns token and verified principal |
| `GET /identity/me`, `POST /identity/logout` | Current principal / revoke current local session |
| `GET /identity/scope-options` | HQ district/society choices, including every society beyond the first list page |
| `GET/POST /identity/accounts` | HQ list (with when the password was set and any active temporary DDM view) / create an active account with an HQ-set password |
| `PUT /identity/accounts/:id` | HQ role/assignment update; sessions/grants revoked |
| `POST /identity/accounts/:id/password` | HQ sets a replacement password; old sessions revoked, lockout cleared |
| `POST /identity/accounts/:id/disable` | HQ disable; self-disable rejected |
| `GET /identity/district-deputies` | DM's active district DDM choices |
| `GET/POST /identity/district-access` | Scoped history / DM grants view-only access to own district DDM |
| `POST /identity/district-access/:id/revoke` | District DM or HQ; immediate early revoke |
| `GET /identity/audit` | V5 D24: up to 500 entries in the viewer's society/district scope (HQ national), filtered by `q`, `districtId`, `type`, `role` and `days`; names people, societies and accounts; never NICs or credentials |
| `GET /grade-requests`, `GET /grade-requests/:id` | V5 D22/D22r, HQ only: the national grade queue with counts, and one request with the society at a glance and its grade history |
| `POST /societies` | V5 D05n, HQ only: a society with its basic details and starting grade. No Exco is needed: HQ then assigns a Society Officer (D05a), who enters the Exco. An optional `council` (0–25 seats, same rules as `PUT .../council`) is still accepted; NICs go through the NIC vault |
| `PUT /societies/:id/council` | Assigned Society Officer, SPC or DDM, or HQ: the filled Exco seats (0–25), saved together so the Exco can be entered gradually. Each seat group stays within its number (3 children, 3 youth, 3 mothers, 9 ordinary, 7 elders' council), children's and youth ages match, and each office has at most one holder. With all 25 seats, every group is full. The dashboard asks for the President, Secretary and Treasurer once the 25 seats are filled; the API does not require them, so existing full Excos keep saving |
| `GET /societies/:id/staff-options`, `PUT /societies/:id/assignments` | V5 D05a, HQ only: one DDM, SPC and Society Officer from the district; accounts whose access changes are signed out |
| `GET /societies`, `GET /societies/:id` | Authenticated scoped reads; inaccessible details return 404 |
| `PUT /societies/:id/council/:memberId/nic` | Assigned editors or HQ; encrypted at rest |
| `POST /societies/:id/council/:memberId/nic/reveal` | Anyone with current society read scope; no-store response, logged reveal |

NIC storage uses AES-256-GCM with a unique random IV and society/member IDs as authenticated associated data. The ordinary registry response includes only the final four characters. Mobile hides reveals after 30 seconds and when backgrounded. Audit records contain the actor, action and record IDs, never the full NIC or credentials. Profile/council/membership edits write their audit event in the same transaction. Council updates preserve encrypted NIC data only when the seat and member identity remain unchanged; replacing a member requires recording the new NIC.

**Exco completion.** A society can exist with no Exco or a partly entered one. `GET /societies/:id` returns `excoStatus` (`filledSeats`, `totalSeats: 25`, `complete`), and the society directory (`GET /society-directory`) and phone society summary (`GET /societies/:id/summary`) return `excoSeatsFilled`. The dashboard marks the record, its Exco tab and the Societies list as "Exco not entered yet" or "Exco incomplete · N of 25" until all 25 seats are filled; the phone lists the empty seats with "Add" for those who may edit. Nothing fills seats automatically.

**HQ on the phone** follows the same steps as the dashboard: Societies tab → **Create society** (basic details, `POST /societies`) → **Assign responsible staff** (`GET /societies/:id/staff-options`, `PUT /societies/:id/assignments`) → the new record. The society summary (M67) shows the Exco state and has **Assign staff** / **Change assigned staff**. With demonstration data there is no server to keep a new society, so these two steps say so instead of pretending to save.

## AWS integration handoff

- Singapore PostgreSQL uses the existing Prisma migration history. Apply migrations with a dedicated migration role before starting the new API. Back up the database before deployment; do not reset shared databases.
- Set the production `DATABASE_URL` with TLS and a private RDS address. Supply database credentials and `NIC_ENCRYPTION_KEY` from the secret store, not Git or a browser environment variable. Keep database backups and the NIC key recoverable separately. Key rotation requires decrypt/re-encrypt migration; replacing the key alone makes old ciphertext unreadable.
- The PostgreSQL pool defaults to two connections per API instance with a five-second acquisition timeout. Set Lambda reserved concurrency based on the RDS connection budget and measured load before launch; 300 MAU does not establish peak concurrency. No RDS Proxy is enabled here.
- Use the existing S3 storage adapter with a private bucket and signed URLs. The API needs outbound HTTPS for Cognito/FCM and any external services; confirm the NAT-instance route/security groups in the initial cost architecture.
- Connect Cognito account provisioning/verification through the identity boundary and map subjects to the persisted account. Roles and assignments are loaded server-side; never accept client role claims or enable demo headers in production. Preserve the login and session-principal contract consumed by the UIs; with Cognito, HQ-set passwords map to admin-created users with permanent passwords.
- Amplify hosts the Next.js 15 HQ dashboard. Configure its server-side API URL and session/identity integration. Cloudflare continues hosting the separate public landing page.
- Use production HTTPS, restricted API origins, log redaction, account recovery, backups, alarms and AWS Budgets. Exercise reissue, disable, session expiry, delegation revocation and NIC audit before real staff access.

No production deployment, AWS spend, store publication, production secrets or new offline behavior are introduced by SC-63.
