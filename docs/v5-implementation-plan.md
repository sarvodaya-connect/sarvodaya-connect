# Prototype V5 implementation plan

This maps every frame in the V5 prototype (Figma file **Sarvodaya Prototype**, "Sarvodaya Connect Prototype v5") to the code that implements it today, and sets the order of the ten pull requests that replace the screens that do not match V5. Each PR builds on the previous one after it is merged.

The prototype is the source of truth for screens and wording. Where V5 and a confirmed rule disagree, the rule wins and the PR says so (see [Deviations from V5](#deviations-from-v5)).

## The ten PRs

| PR | Scope | Main V5 frames |
|---|---|---|
| 1 | Shared shells, navigation, design tokens, page states, access banners (this PR) | HQTop, HQSide, role sidebars, Nav, D21, ST01–ST04, M26 |
| 2 | Sign-in and HQ account administration | D01, D01e, D16, D16i, D16t, M01–M03, M03e |
| 3 | Society profile, ExCo (25 positions), NIC reveal, change history, grade requests and HQ decisions | D05, D05e, D05x, D05n, D05c, D05a, D22, D22r, D24, M06*, M07*, M06g, M06q, M06h, SP03–SP05, DD05, DD08, DD09 |
| 4 | Annual total profit and expenses, activities, work plans, business description, private audit documents | D05m, D05w, D11, D12, M06f, M06fx, M09*, M13, M13a, M50–M52, SP06–SP08 |
| 5 | HQ dashboard and national directory | D02, D03, D03b, D04, D07, D08, D13, D15, D18, D19, M05h, M61–M69d |
| 6 | SPC, DDM and DM desktop dashboards and phone homes | SP01, SP02, DD01, DD03, DM01, DM02, DM03, M05, M05s, M05d, M05m, M16*, M17*, M20 |
| 7 | Temporary DDM district access and no-access screens | DM04, DM05, DD02, DD04, DD06, DD07, M05t, M30–M33, ST04 |
| 8 | Disaster response | D30–D33, IR01–IR05 (SPC, DDM, DM), M40–M49, M48n |
| 9 | SarvoAI dashboard and phone screens on the merged PR #74 API | D40–D49f, M80–M89f |
| 10 | Cross-app integration and readiness review | All |

## What PR 1 changes

| Area | V5 frame | Before | Now |
|---|---|---|---|
| Dashboard header | HQTop | 120px wave header, page title, search, bell, initials | 112px header with the logo column, title, subtitle and motto, hills, 300px search, alerts bell with count, account button that signs out |
| Dashboard sidebar | HQSide, SP01, DD01, DM01 | One HQ list for every role with hard-coded badges and Notifications | Per-role V5 lists (`src/lib/navigation.ts`), V5 colours, an Administration group for HQ, and the user card ("HQ · National", "SPC · …") |
| Narrow screens | (none in V5) | Scrolling link row | Same pattern in V5 colours, with the user and scope under it |
| Design tokens | All | Screen Catalogue v3 values | V5 values in `globals.css` and `AppColors`, plus banner, state and sidebar tokens |
| Page states | D21, ST01–ST04 | v3 states, "No permission", "Access denied" and "Offline" | V5 loading, empty, no results, error · retry, success and no access (`data-states.tsx`); one `NoAccessState` replaces the two old access states; the offline state is removed |
| Access banners | SP01, DD02, DM03, M05t | Not present | `AccessBanner` (dashboard) and `AccessBanner` widget (phone) with edit, view-only, temporary and incident tones |
| Phone bottom bar | Nav | Labelled Material bar, two styles | One icon-only bar with a soft green pill and a hairline; labels remain as tooltips and screen-reader names |
| Phone no access | M26 No access | "No permission" error, "Society not found" | `NoAccessView`, used by the society record (403/404), the society list and role workspaces |
| Roles | — | Dashboard had no DDM role | `DEPUTY_DISTRICT_MANAGER` added to the dashboard role type (assigned societies only) |

## Screen-to-code map

Status: **match** = already matches V5; **rework** = exists but differs from V5 and will be replaced; **new** = no implementation yet.

### Shared parts

| V5 | Dashboard | Phone | Status | PR |
|---|---|---|---|---|
| HQTop, HQSide | `components/dashboard/dashboard-shell.tsx`, `lib/navigation.ts` | — | match (PR 1) | 1 |
| Role sidebars (SP01, DD01, DM01) | `lib/navigation.ts` | — | match (PR 1), shown once non-HQ sign-in is allowed | 1, 6 |
| Nav (bottom bar) | — | `lib/src/app.dart` `HomeShell` | style matches; tab sets differ | 1, then 6 |
| D21 / ST01–ST03 | `components/dashboard/data-states.tsx`, `/states` | `widgets/state_views.dart` | match (PR 1) | 1 |
| ST04 / M26 No access | `NoAccessState` | `NoAccessView` | match (PR 1) | 1, 7 |
| SocietyBody, NotifBody, MoreBody | society record, notification centre | `society_record_screen.dart`, `notifications_screen.dart`, `more_screen.dart` | rework | 3, 6 |

### Sign-in and accounts

| V5 | Dashboard | Phone | Status | PR |
|---|---|---|---|---|
| D01, D01e | `/` `app/page.tsx` | — | match (PR 2) | 2 |
| M01, M02, M03, M03e | — | `splash_screen.dart`, `language_screen.dart`, `sign_in_screen.dart` | match (PR 2) | 2 |
| D16, D16i, D16t | `/accounts` | — | match (PR 2) | 2 |
| D24 Change & access log | `/audit` | — | rework | 3 |

### Society record, ExCo and grades

| V5 | Dashboard | Phone | Status | PR |
|---|---|---|---|---|
| D05, D05e, SP03, SP04, DD05, DD08, DM03 | `/societies/[id]` | `society_record/society_record_screen.dart`, `edit_society_screen.dart` | rework | 3 |
| D05x, M07, M07s, M07e, M07o, M07v, M07r, M07x, M07d | `/societies/[id]/exco` | `society_record_screen.dart`, `nic_reveal_button.dart` | rework (25 required positions) | 3 |
| D05n, D05c, D05a | — | — | new | 3 |
| D22, D22r, SP05, DD09, M06g, M06q | `/reviews`, `/societies/[id]/grade` | `grade_change_request_screen.dart`, `grade_requests_screen.dart` | rework | 3 |
| M06, M06_SPC, M06_DDM, M06v, M06u | — | `society_record_screen.dart` | rework | 3 |
| M06h | `/societies/[id]/history` | `society_record_screen.dart` | rework | 3 |

### Annual summary, activities, work plans and documents

| V5 | Dashboard | Phone | Status | PR |
|---|---|---|---|---|
| D05m, M06f, M06fx | `annual-summary-cards.tsx` | `annual_summary_screen.dart` | rework | 4 |
| D05w, M09, M09c | `/societies/[id]/work-plan` | `society_record_screen.dart` | rework | 4 |
| M09a, M09b, M09d, M09r, M09s | — | `activity_form_screen.dart` | rework | 4 |
| M50, M51, M51b, M52, SP06, SP07, SP08 | — | — | new | 4 |
| D11 Audits and AGM | `/compliance` | `audit_screen.dart` | rework | 4 |
| D12, M13, M13a | `/documents`, `/societies/[id]/documents` | `documents_screen.dart`, `audit_report_upload_screen.dart` | rework | 4 |

### HQ dashboard and directory

| V5 | Dashboard | Phone | Status | PR |
|---|---|---|---|---|
| D02 National Dashboard | `/dashboard` | — | rework | 5 |
| D03 Map view | — | — | new | 5 |
| D03b District view | `/districts/[id]` | — | rework | 5 |
| D04 Societies list | `/societies` | — | rework | 5 |
| D07 Programmes | `/activities` | — | rework | 5 |
| D08 Membership | `/membership` | `membership_screen.dart` | rework | 5 |
| D13 Requests and tasks | — | — | new | 5 |
| D15 Reports | — | — | new | 5 |
| D18 Search | `/search` | — | rework | 5 |
| D19 Alerts | `/notifications` | — | rework | 5 |
| D17 Settings | — | — | not assigned (see open questions) | — |
| M05h, M61–M69d | — | `v4_role_home_screen.dart` (HQ) | rework / new | 5 |

### Role dashboards and phone homes

| V5 | Dashboard | Phone | Status | PR |
|---|---|---|---|---|
| SP01, SP02 | `/dashboard`, `/societies` (HQ-only sign-in today) | — | new | 6 |
| DD01, DD03 | as above | — | new | 6 |
| DM01, DM02 | as above | — | new | 6 |
| M05, M05s, M05d, M05m | — | `society_officer_home_screen.dart`, `v4_role_home_screen.dart` | rework | 6 |
| M16*, M17*, M20 | — | `notifications_screen.dart`, `more_screen.dart`, `my_societies_screen.dart` | rework | 6 |

### Temporary DDM access

| V5 | Dashboard | Phone | Status | PR |
|---|---|---|---|---|
| DM04, DM05 | — | — | new | 7 |
| DD02, DD04, DD06, DD07, M05t | — | `v4_role_home_screen.dart` (banner only) | new / rework | 7 |
| M30, M31, M32, M33 | — | `district_access_screen.dart` | rework | 7 |

### Disaster response

| V5 | Dashboard | Phone | Status | PR |
|---|---|---|---|---|
| D30, D31, D32, D33 | `/emergencies` | — | rework | 8 |
| IR01–IR05 (SPC, DDM, DM) | — | — | new | 8 |
| M40–M49, M48n | — | `emergency_response_screen.dart` | rework | 8 |

### SarvoAI

| V5 | Dashboard | Phone | Status | PR |
|---|---|---|---|---|
| D40–D49f | — | — | new, on `POST /api/v1/assistant/questions` | 9 |
| M80–M89f | — | — | new, on the same endpoint | 9 |

## Phone bottom-bar tabs

PR 1 applies the V5 bar style to the existing tabs. The V5 tab sets below change which screens each role reaches, so each set lands with the screens behind it (PR 6, plus PR 5 for HQ Districts, PR 7 for DM Access and PR 8 for the Incident button).

| Role | V5 tabs | Today |
|---|---|---|
| Society Officer | Home, Society, **Incident** (red), Exco, Work plan, More | Home, Society, Exco, Work plan, More (API mode); Home, Society, Submit, Requests, More (demo) |
| SPC | Home, Alerts, More | Home, Societies, Alerts, Disasters, More |
| DDM | Home, Alerts, More | Home, Societies, Alerts, Disasters, More |
| DM | Home, Societies, Access, Alerts, More | Home, Societies, Access, Disasters, More |
| HQ | Overview, Districts, Societies, Alerts, More | Home, Societies, Alerts, Disasters, More |

## Sidebar items that wait for their pages

The sidebar lists only pages that exist, so nobody lands on an empty page. These V5 items are added by the PR that builds them:

- HQ: Map View (PR 5), Requests & Tasks (PR 5), Reports (PR 5), Settings (not assigned), the **Ask SarvoAI** header button (PR 9), and the Review Queue count badge from real data (PR 3).
- SPC: Activities to approve (PR 4), Help (not assigned).
- DM: Temporary DDM access (PR 7).
- SPC, DDM and DM desktop sign-in: the dashboard still allows HQ only (`current-viewer.ts`, `identity-actions.ts`). PR 6 opens it with server-side scope on every request.

## Access rules

- The API decides every read and write. The dashboard filters and hides things only to avoid showing what the API would refuse; hiding a link is never the permission check.
- No-access screens never name the refused society, incident or person. V5 ST04 and M26 name the society; this is a deliberate deviation.
- DM is read-only. A DM can give a DDM temporary district-wide **view-only** access that expires or can be ended early, is audited, and never allows editing or grade changes. The API already checks the time on every request (`readableDistrictIds(principal, now)`).
- HQ alone decides grades.
- NICs never appear in lists, search, logs or notifications; an authorised viewer reveals one record at a time (PR 3).

## AWS readiness

Every PR keeps the agreed AWS shape. Nothing here creates AWS resources, adds credentials or deploys.

| Service | Requirement for each PR | Current state on `main` |
|---|---|---|
| Amplify (Next.js 15 dashboard) | The dashboard stays a standard Next.js 15 app: server components and server actions only, no custom server, no file system writes. It reaches data only through the API (`API_BASE_URL`, server side). | Met. PR 1 adds no server code, no data access and no new environment variables. |
| API Gateway + Lambda (NestJS) | Controllers stay stateless; no in-memory state shared between requests; uploads go to S3 by signed URL, not through Lambda. | No Lambda handler or packaging yet. Proposed for PR 10 (handler, build output, cold-start notes). |
| RDS PostgreSQL via Prisma | Schema changes ship as Prisma migrations; the pool size stays within the RDS connection budget (two per instance today). | Migrations in `apps/api/prisma/migrations`. PR 1 has no schema change. |
| Cognito | Identity stays behind `AuthenticationProvider` / `SessionAuthenticationProvider`; roles and scopes are loaded server-side, never trusted from the client. | Replacement points exist; local sessions fail closed outside development and test. PR 2 keeps account creation and passwords behind this boundary so Cognito can replace it. |
| Private S3 | Documents only through the API's storage adapter and short-lived signed URLs after a permission check. | `S3DocumentStorage` and the presigner exist. PR 4 reuses them. |
| Secrets Manager / environment variables | Secrets (`DATABASE_URL`, `NIC_ENCRYPTION_KEY`, session and Cognito settings) come from environment variables populated from Secrets Manager or Parameter Store; nothing in Git or in browser variables. | Read from environment variables. A Secrets Manager loader, if needed beyond Lambda environment injection, is proposed for PR 10. |
| Bedrock (SarvoAI) | Keep `SARVOAI_ENABLED=false` until Sarvodaya approves global inference processing and an authorised person completes `docs/sarvoai-aws-setup.md`. | PR #74 merged and switched off by default. PR 9 adds only the screens. |

## Deviations from V5

- **No-access wording:** V5 ST04 and M26 name the society ("You don't have access to Thalawa SSS"). The confirmed rule is that no-access screens reveal nothing about restricted records, so the screens say "this society" or "this page".
- **Sidebar counts:** V5 shows a "6" on Review Queue. The old sidebar hard-coded "2". PR 1 removes the hard-coded number; PR 3 shows the real count.
- **Phone bar labels:** V5 shows icons only. Labels are kept as tooltips and screen-reader names so the bar stays accessible.

## Open questions (To Confirm)

These are not decided in V5 or the confirmed requirements. No PR invents an answer; each will be listed again in the PR that meets it.

- Who may open and close an incident beyond what the API allows today, and whether a Society Officer report notifies every society immediately or after review (PR 8).
- Whether D17 Settings and the role "Help" item are in scope, and what they contain.
- Whether HQ Districts (M65) on the phone needs its own API or reuses the district view (PR 5).
- How long a temporary DDM grant may last and whether it can be renewed (PR 7).
- The existing demo-only offline banners and queued submissions on the phone: offline editing is out of scope, so they will be removed with the screens that show them (PR 3, PR 4, PR 8).
