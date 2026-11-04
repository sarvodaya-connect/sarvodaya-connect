# V5 screen coverage

Every frame on the Figma page **Sarvodaya Connect V5 · Prototype** (file "Sarvodaya Prototype", 207 frames: 60 HQ desktop, 41 SPC/DDM/DM desktop, 105 phone and the start page), with the code that implements it. Written for V5 PR 10 on 3 Nov 2026 from `main` after PR 9 (#84).

**Result: 190 Done, 16 Partial, 0 Missing, 1 not an app screen.**

How a row was checked:

- **Route or screen** was confirmed to exist in the code on this branch; the frame code is named in the implementation or in a test (the "Tests" and "Named in" columns), or the frame falls in a range a PR's screens and tests name ("D40–D49", "M81–M84").
- The frame was compared with the coded screen by the PR that built it (each PR description lists its frames and checks). PR 10 re-checked the Society Officer phone flow (M05, Nav, notifications to the society record) with widget tests after removing the V3 screens, and rendered the D02 frames again to judge the map states below.
- **Partial** means part of the frame is not built; the reason says which part and whether it is To Confirm. Nothing marked Done is a visual placeholder.
- Deliberate deviations from V5 (confirmed rules win): no-access screens never name the refused record; no progress bars as data displays (M41 shows "Question 5 of 10"); incident notifications go to the people covering the societies, not to everyone; phone bar labels stay as tooltips.

| Frame | Title | Role | Device | Route or phone screen | PR | Status | Evidence or gap |
|---|---|---|---|---|---|---|---|
| D01 | D01 Sign in | All desktop roles | Desktop | `/` sign-in | 2 | Done | Tests: `dashboard/components/dashboard/identity-forms.test.tsx` |
| D02 | D02 National Dashboard | HQ | Desktop | `/dashboard` (HQ) | 5, 9 | Done | Tests: `dashboard/app/(dashboard)/dashboard/page.test.tsx`, `dashboard/components/dashboard/national/national.test.tsx` |
| D04 | D04 Societies list | HQ | Desktop | `/societies` | 5 | Partial | The "Needs follow-up" tab is To Confirm (PR 5); the rest of D04 is built. Named in `dashboard/app/(dashboard)/societies/page.tsx`, `dashboard/components/dashboard/ui/wave-header.tsx` |
| D05 | D05 Society record: overview | HQ | Desktop | `/societies/[id]` | 3 | Partial | The record summary tiles are To Confirm (PR 3/4); the rest of D05 is built. Tests: `dashboard/components/dashboard/society-record/society-record.test.tsx`, `dashboard/components/dashboard/activities/activities.test.tsx` |
| D05m | D05m Summary not added yet | HQ | Desktop | `/societies/[id]` annual summary | 4 | Partial | Summary tiles above the annual summary are To Confirm (PR 4). Tests: `dashboard/components/dashboard/society-record/society-record.test.tsx` |
| D05e | D05e HQ: edit society information | HQ | Desktop | `/societies/[id]` edit panel | 3 | Done | Tests: `dashboard/components/dashboard/society-record/society-record.test.tsx` |
| D05x | D05x Society record: Exco | HQ | Desktop | `/societies/[id]/exco` | 3 | Done | Tests: `dashboard/components/dashboard/society-record/society-record.test.tsx` |
| D05w | D05w Society record: work plan | HQ | Desktop | `/societies/[id]/work-plan` | 4 | Done | Tests: `dashboard/components/dashboard/society-record/society-record.test.tsx`, `api/societies/society-record.service.spec.ts` |
| D05n | D05n Create a society record | HQ | Desktop | `/societies/new` | 3 | Done | Tests: `dashboard/components/dashboard/society-record/v5-record.test.tsx`, `api/test/db/society-admin.db-spec.ts` |
| D05c | D05c Create a society: Exco | HQ | Desktop | `/societies/[id]/exco/edit` | 3 | Done | Deliberate deviation: HQ no longer enters the Exco when creating a society; after D05a the assigned Society Officer (or SPC, DDM or HQ) enters it and can save it partly, and the record shows "Exco incomplete" until all 25 seats are filled. Tests: `dashboard/components/dashboard/society-record/v5-record.test.tsx`, `api/test/db/society-admin.db-spec.ts` |
| D05a | D05a Assign responsible staff | HQ | Desktop | `/societies/[id]?panel=assign` | 3 | Done | Tests: `dashboard/components/dashboard/society-record/v5-record.test.tsx`, `api/test/db/society-admin.db-spec.ts` |
| D16 | D16 Accounts | HQ | Desktop | `/accounts` | 2 | Done | Tests: `dashboard/components/dashboard/identity-forms.test.tsx`, `dashboard/lib/accounts.test.ts` |
| D16i | D16i Create an account | HQ | Desktop | `/accounts` | 2 | Done | Tests: `dashboard/components/dashboard/identity-forms.test.tsx`, `api/test/db/identity.db-spec.ts` |
| D16t | D16t Set a new password | HQ | Desktop | `/accounts` | 2 | Done | Tests: `dashboard/components/dashboard/identity-forms.test.tsx`, `api/test/db/identity.db-spec.ts` |
| D22 | D22 Grade-change queue | HQ | Desktop | `/reviews` | 3 | Done | Tests: `api/test/db/society-admin.db-spec.ts` |
| D22r | D22r Grade-change request | HQ | Desktop | `/reviews/[id]` | 3 | Done | Tests: `dashboard/components/dashboard/society-record/v5-record.test.tsx`, `api/test/db/society-admin.db-spec.ts` |
| D24 | D24 Change & access log | HQ | Desktop | `/audit`, `/audit/export` | 3 | Done | Tests: `dashboard/components/dashboard/society-record/v5-record.test.tsx`, `api/test/db/society-admin.db-spec.ts` |
| D21 | D21 Page states | All desktop roles | Desktop | `/states` (shared page states) | 1 | Done | Named in `dashboard/components/dashboard/data-states.tsx`, `dashboard/components/dashboard/page-states-gallery.tsx` |
| D30 | D30 Incidents: open an incident | HQ | Desktop | `/emergencies`, `/emergencies/[id]` | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| D31 | D31 Live incident | HQ | Desktop | `/emergencies`, `/emergencies/[id]` | 8 | Done | Tests: `dashboard/components/dashboard/emergencies/incident-view.test.tsx`, `api/test/db/emergencies.db-spec.ts` |
| D32 | D32 Response actions: assign helping societies | HQ | Desktop | `/emergencies`, `/emergencies/[id]` | 8 | Done | Tests: `dashboard/components/dashboard/emergencies/incident-view.test.tsx`, `api/test/db/emergencies.db-spec.ts` |
| D33 | D33 Situation report | HQ | Desktop | `/emergencies`, `/emergencies/[id]` | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| D01e | D01e Sign in: wrong password | All desktop roles | Desktop | `/` sign-in | 2 | Done | Tests: `dashboard/components/dashboard/identity-forms.test.tsx`, `api/test/db/identity.db-spec.ts` |
| D03 | D03 Map view | HQ | Desktop | `/map` | 5 | Done | Tests: `dashboard/components/dashboard/national/national.test.tsx` |
| D03b | D03b District view | HQ | Desktop | `/districts` | 5 | Done | Named in `dashboard/app/(dashboard)/districts/page.tsx`, `dashboard/lib/national-api.ts` |
| D08 | D08 Membership | HQ | Desktop | `/membership` | 5 | Done | Named in `dashboard/app/(dashboard)/membership/page.tsx`, `dashboard/components/dashboard/ui/kpi-tile.tsx` |
| D11 | D11 Audits and AGM | HQ | Desktop | `/compliance` | 4 | Done | Named in `dashboard/app/(dashboard)/compliance/page.tsx`, `dashboard/components/dashboard/ui/kpi-tile.tsx` |
| D07 | D07 Programmes and activities | HQ | Desktop | `/activities` | 5 | Done | Named in `dashboard/app/(dashboard)/activities/page.tsx`, `dashboard/lib/national-api.ts` |
| D18 | D18 Search | HQ | Desktop | `/search` | 5 | Done | Named in `dashboard/app/(dashboard)/search/page.tsx`, `dashboard/components/dashboard/ui/wave-header.tsx` |
| D19 | D19 Alerts | HQ | Desktop | `/notifications` | 5 | Done | Named in `dashboard/app/(dashboard)/layout.tsx`, `dashboard/app/(dashboard)/notifications/actions.ts` |
| D13 | D13 Requests and tasks | HQ | Desktop | `/requests` | 5 | Partial | Request tracker and sending requests are built; reminders and personal "My tasks" are To Confirm (PR 5). Named in `dashboard/app/(dashboard)/requests/actions.ts`, `dashboard/app/(dashboard)/requests/request-form.tsx` |
| D15 | D15 Reports | HQ | Desktop | `/reports`, `/reports/[type]` | 5 | Partial | Reports, preview, print-to-PDF and CSV are built; scheduled reports are To Confirm (they need EventBridge and email). Tests: `dashboard/components/dashboard/national/national.test.tsx` |
| D12 | D12 Documents | HQ | Desktop | `/documents` | 4 | Done | Named in `dashboard/app/(dashboard)/societies/[id]/documents/page.tsx`, `dashboard/app/(dashboard)/documents/page.tsx` |
| D17 | D17 Settings | HQ | Desktop | `/settings` | 9 | Partial | Profile, sign-out, language note and password are built; notification preferences are To Confirm (PR 9). Named in `dashboard/app/(dashboard)/settings/page.tsx` |
| D40 | D40 SarvoAI: ask a question | HQ | Desktop | `/sarvoai` | 9 | Done | Tests: `dashboard/components/dashboard/sarvoai/sarvoai.test.tsx` |
| D40b | D40b SarvoAI: question typed | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D41 | D41 SarvoAI: answering | HQ | Desktop | `/sarvoai` | 9 | Done | Tests: `dashboard/components/dashboard/sarvoai/sarvoai.test.tsx` |
| D42 | D42 SarvoAI: average profit answer | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D42h | D42h SarvoAI: how was this answered | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D43 | D43 SarvoAI: follow-up question | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D44 | D44 SarvoAI: who is the president | HQ | Desktop | `/sarvoai` | 9 | Done | Tests: `dashboard/components/dashboard/sarvoai/sarvoai.test.tsx` |
| D44h | D44h SarvoAI: how the president was found | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D45 | D45 SarvoAI: which do you mean | HQ | Desktop | `/sarvoai` | 9 | Done | Tests: `dashboard/components/dashboard/sarvoai/sarvoai.test.tsx` |
| D46 | D46 SarvoAI: profit above an amount for five years | HQ | Desktop | `/sarvoai` | 9 | Done | Tests: `dashboard/components/dashboard/sarvoai/sarvoai.test.tsx` |
| D47 | D47 SarvoAI: yearly figures not submitted | HQ | Desktop | `/sarvoai` | 9 | Done | Tests: `dashboard/components/dashboard/sarvoai/sarvoai.test.tsx` |
| D49a | D49a SarvoAI: no matching societies | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D49b | D49b SarvoAI: incomplete data | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D49c | D49c SarvoAI: unclear question | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D49d | D49d SarvoAI: question it cannot answer | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D49e | D49e SarvoAI: service error | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D49f | D49f SarvoAI: no access | SPC, DDM, DM | Desktop | `/no-access?page=sarvoai` | 9 | Done | Middleware sends SPC/DDM/DM to `/no-access?page=sarvoai`; the API answers 403 as well. Tests: `dashboard/components/dashboard/sarvoai/sarvoai.test.tsx` |
| D46h | D46h SarvoAI: how the five-year answer was found | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D47h | D47h SarvoAI: how the not-submitted list was found | HQ | Desktop | `/sarvoai` | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D02k | D02k Dashboard: map zoomed to Kurunegala | HQ | Desktop | `/dashboard` (HQ) | 5, 9 | Partial | D02 shows a static district map with counts. Clicking a district to zoom in and see its societies (V5 D02k) is not built; `/map` (D03) shows every society instead. Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D02o | D02o Dashboard: two societies at the same place | HQ | Desktop | `/dashboard` (HQ) | 5, 9 | Partial | Numbered markers for societies at the same place are not built on D02 or `/map`. Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D02s | D02s Dashboard: society chosen on the map | HQ | Desktop | `/dashboard` (HQ) | 5, 9 | Partial | Choosing a society on the D02 map is not built; choosing a dot works on `/map` (D03), with the same society summary. Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D02n | D02n Dashboard: societies with no location | HQ | Desktop | `/dashboard` (HQ) | 5, 9 | Done | "N active societies have no map position yet" under the D02 map, from the API. Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D02l | D02l Dashboard: loading | HQ | Desktop | `/dashboard` (HQ) | 5, 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D02e | D02e Dashboard: map could not load | HQ | Desktop | `/dashboard` (HQ) | 5, 9 | Done | The D02 map is drawn in the page (no tiles to fail); a failed API call shows the page error state with Try again. Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| D02x | D02x Dashboard: period with no data yet | HQ | Desktop | `/dashboard` (HQ) | 5, 9 | Partial | A period with no figures shows the SDG empty line only; the "No data available for FY …" and "Not submitted" panels for membership, finance and audits in V5 D02x are not built. Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| SP01 | SP01 SPC home | SPC | Desktop | `/dashboard`, `/my-societies` | 6 | Done | Tests: `dashboard/app/(dashboard)/dashboard/page.test.tsx`, `dashboard/components/dashboard/dashboard-shell.test.tsx` |
| SP02 | SP02 SPC: my societies | SPC | Desktop | `/dashboard`, `/my-societies` | 6 | Done | Tests: `dashboard/components/dashboard/role-home/role-home.test.tsx`, `api/home/home.compose.spec.ts` |
| SP03 | SP03 SPC: society record | SPC | Desktop | `/societies/[id]` (assigned, edit) | 3, 6 | Done | Covered by the PR 6 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| SP04 | SP04 SPC: edit society information | SPC | Desktop | `/societies/[id]` (assigned, edit) | 3, 6 | Done | Covered by the PR 6 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| SP05 | SP05 SPC: request a grade change | SPC | Desktop | `/societies/[id]/grade` | 3 | Done | Covered by the PR 3 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| DD01 | DD01 DDM home | DDM | Desktop | `/dashboard`, `/my-societies` | 6 | Done | Tests: `dashboard/components/dashboard/role-home/role-home.test.tsx`, `dashboard/lib/access.test.ts` |
| DD02 | DD02 DDM home: temporary district access | DDM | Desktop | `/dashboard`, `/my-societies?scope=district`, `/societies/[id]` (temporary, view only) | 7 | Done | Tests: `dashboard/components/dashboard/district-access/district-access.test.tsx`, `mobile/test/district_access_test.dart` |
| DD03 | DD03 DDM: my societies | DDM | Desktop | `/dashboard`, `/my-societies` | 6 | Done | Tests: `api/home/home.compose.spec.ts` |
| DD04 | DD04 DDM: district societies, view only | DDM | Desktop | `/dashboard`, `/my-societies?scope=district`, `/societies/[id]` (temporary, view only) | 7 | Done | Tests: `dashboard/components/dashboard/district-access/district-access.test.tsx`, `api/test/db/district-access.db-spec.ts` |
| DD05 | DD05 DDM: assigned society record | DDM | Desktop | `/societies/[id]` (assigned, edit) | 3, 6 | Done | Covered by the PR 6 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| DD08 | DD08 DDM: edit society information | DDM | Desktop | `/societies/[id]` (assigned, edit) | 3, 6 | Done | Covered by the PR 6 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| DD09 | DD09 DDM: request a grade change | DDM | Desktop | `/societies/[id]/grade` | 3 | Done | Covered by the PR 3 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| DD06 | DD06 DDM: district society, view only | DDM | Desktop | `/dashboard`, `/my-societies?scope=district`, `/societies/[id]` (temporary, view only) | 7 | Done | Tests: `dashboard/components/dashboard/district-access/district-access.test.tsx`, `api/test/db/district-access.db-spec.ts` |
| DD07 | DD07 DDM: after temporary access ends | DDM | Desktop | `/dashboard`, `/my-societies?scope=district`, `/societies/[id]` (temporary, view only) | 7 | Done | Tests: `dashboard/components/dashboard/district-access/district-access.test.tsx`, `api/test/db/district-access.db-spec.ts` |
| DM01 | DM01 DM: district overview | DM | Desktop | `/dashboard`, `/my-societies` | 6 | Done | Tests: `dashboard/app/(dashboard)/dashboard/page.test.tsx`, `dashboard/components/dashboard/role-home/role-home.test.tsx` |
| DM02 | DM02 DM: societies | DM | Desktop | `/dashboard`, `/my-societies` | 6 | Done | Tests: `dashboard/components/dashboard/role-home/role-home.test.tsx`, `api/home/home.compose.spec.ts` |
| DM03 | DM03 DM: society record, view only | DM | Desktop | `/societies/[id]` (view only) | 6 | Done | Named in `dashboard/components/dashboard/ui/access-banner.tsx`, `mobile/widgets/state_views.dart` |
| DM04 | DM04 DM: temporary DDM access | DM | Desktop | `/district-access` | 7 | Done | Tests: `dashboard/components/dashboard/district-access/district-access.test.tsx`, `dashboard/lib/access.test.ts` |
| DM05 | DM05 DM: give temporary access | DM | Desktop | `/district-access` | 7 | Done | Tests: `dashboard/components/dashboard/district-access/district-access.test.tsx`, `api/identity/district-access.rules.spec.ts` |
| IR01 | IR01 Live incident (SPC) | SPC | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `dashboard/components/dashboard/emergencies/incident-view.test.tsx`, `api/test/db/emergencies.db-spec.ts` |
| IR02 | IR02 Report an incident (SPC) | SPC | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `dashboard/app/(dashboard)/dashboard/page.test.tsx`, `api/test/db/emergencies.db-spec.ts` |
| IR03 | IR03 Rapid assessment (SPC) | SPC | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| IR04 | IR04 Close incident (SPC) | SPC | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| IR05 | IR05 Notifications (SPC) | SPC | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| IR01_DDM | IR01_DDM Live incident (DDM) | DDM | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `dashboard/components/dashboard/emergencies/incident-view.test.tsx`, `api/test/db/emergencies.db-spec.ts` |
| IR02_DDM | IR02_DDM Report an incident (DDM) | DDM | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `dashboard/app/(dashboard)/dashboard/page.test.tsx`, `api/test/db/emergencies.db-spec.ts` |
| IR03_DDM | IR03_DDM Rapid assessment (DDM) | DDM | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| IR04_DDM | IR04_DDM Close incident (DDM) | DDM | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| IR05_DDM | IR05_DDM Notifications (DDM) | DDM | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| IR01_DM | IR01_DM Live incident (DM) | DM | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `dashboard/components/dashboard/emergencies/incident-view.test.tsx`, `api/test/db/emergencies.db-spec.ts` |
| IR02_DM | IR02_DM Report an incident (DM) | DM | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `dashboard/app/(dashboard)/dashboard/page.test.tsx`, `api/test/db/emergencies.db-spec.ts` |
| IR03_DM | IR03_DM Rapid assessment (DM) | DM | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| IR04_DM | IR04_DM Close incident (DM) | DM | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| IR05_DM | IR05_DM Notifications (DM) | DM | Desktop | `/emergencies/[id]`, `/dashboard?report=incident`, role bell | 8 | Done | Tests: `api/test/db/emergencies.db-spec.ts` |
| ST01 | ST01 Loading | All desktop roles | Desktop | `data-states.tsx` (`/states`) | 1 | Done | Named in `dashboard/app/(dashboard)/emergencies/loading.tsx`, `dashboard/components/dashboard/data-states.tsx` |
| ST02 | ST02 Empty: no matching societies | All desktop roles | Desktop | `data-states.tsx` (`/states`) | 1 | Done | Named in `dashboard/components/dashboard/data-states.tsx` |
| ST03 | ST03 Error: page could not load | All desktop roles | Desktop | `data-states.tsx` (`/states`) | 1 | Done | Named in `dashboard/components/dashboard/data-states.tsx` |
| ST04 | ST04 No access to this society | All desktop roles | Desktop | `NoAccessState`, `/no-access` | 1, 7 | Done | Deliberate deviation: no-access screens do not name the refused society. Tests: `dashboard/components/dashboard/district-access/district-access.test.tsx` |
| SP06 | SP06 SPC: activities to approve | SPC | Desktop | `/activities-to-approve`, `/activities-to-approve/[id]` | 4 | Done | Tests: `api/activities/activities.service.spec.ts` |
| SP07 | SP07 SPC: review activity and choose UN SDGs | SPC | Desktop | `/activities-to-approve`, `/activities-to-approve/[id]` | 4 | Done | Tests: `dashboard/components/dashboard/activities/activities.test.tsx` |
| SP08 | SP08 SPC: activity approved | SPC | Desktop | `/activities-to-approve`, `/activities-to-approve/[id]` | 4 | Done | Tests: `api/activities/activities.service.spec.ts` |
| M01 | M01 Splash | All phone roles | Phone | `splash_screen.dart`, `language_screen.dart` | 2 | Done | Tests: `mobile/test/authentication_onboarding_test.dart` |
| M02 | M02 Choose language | All phone roles | Phone | `splash_screen.dart`, `language_screen.dart` | 2 | Done | Named in `mobile/screens/language_screen.dart` |
| M03 | M03 Sign in | All phone roles | Phone | `sign_in_screen.dart` | 2 | Done | Tests: `mobile/test/authentication_onboarding_test.dart` |
| M05 | M05 Home: Society Officer | Society Officer | Phone | `society_officer_home_screen.dart` | 6, 10 | Done | PR 10: demo mode now shows the V5 M05 home and Nav too (the V3 Submit/Requests journey was removed). Tests: `mobile/test/society_officer_home_test.dart`, `mobile/test/widget_test.dart` |
| M05s | M05s Home: SPC | SPC | Phone | `home/home_screens.dart` | 9 | Done | Tests: `mobile/test/role_home_v5_test.dart` |
| M05d | M05d Home: DDM | DDM | Phone | `home/home_screens.dart` | 9 | Done | Tests: `mobile/test/role_home_v5_test.dart` |
| M05t | M05t Home: DDM with temporary access | DDM | Phone | `home/home_screens.dart` (temporary access banner) | 7, 9 | Done | Tests: `mobile/test/district_access_test.dart` |
| M05m | M05m Home: DM | DM | Phone | `home/home_screens.dart` | 9 | Done | Tests: `mobile/test/role_home_v5_test.dart` |
| M05h | M05h Home: HQ National Dashboard | HQ | Phone | `national/national_screens.dart` (Overview tab) | 5, 9 | Done | Tests: `mobile/test/national_v5_test.dart` |
| M20 | M20 Society list: filters | DM, HQ | Phone | `home/home_screens.dart` (`DistrictSocietiesScreen` filters) | 9 | Done | Tests: `mobile/test/role_home_v5_test.dart` |
| M06 | M06 Society detail (Society Officer) | Society Officer, DM (view only) | Phone | `society_record/society_record_screen.dart` | 3 | Done | Tests: `mobile/test/society_record_test.dart` |
| M06_SPC | M06 Society detail (SPC) | SPC | Phone | `society_record/society_record_screen.dart` | 3 | Done | Tests: `mobile/test/society_record_test.dart` |
| M06_DDM | M06 Society detail (DDM) | DDM | Phone | `society_record/society_record_screen.dart` | 3 | Done | Tests: `mobile/test/society_record_test.dart` |
| M06v | M06v Society detail: view only | Society Officer, DM (view only) | Phone | `society_record/society_record_screen.dart` | 3 | Done | Tests: `mobile/test/society_record_test.dart` |
| M06g | M06g Request a grade change | SPC, DDM | Phone | `society_record/grade_change_request_screen.dart` | 3 | Done | Tests: `mobile/test/society_record_test.dart`, `api/societies/society-record.service.spec.ts` |
| M06q | M06q Grade-change requests | SPC, DDM | Phone | `society_record/grade_requests_screen.dart` | 3 | Done | Tests: `mobile/test/society_record_test.dart`, `api/societies/society-record.service.spec.ts` |
| M06e | M06e Edit society information | Society Officer, SPC, DDM | Phone | `society_record/edit_society_screen.dart` | 3 | Done | Tests: `mobile/test/society_record_test.dart` |
| M06u | M06u Unsaved changes warning | Society Officer, DM (view only) | Phone | `society_record/society_record_screen.dart` | 3 | Done | Tests: `mobile/test/society_record_test.dart` |
| M06f | M06f Edit annual financial summary | Society Officer, SPC | Phone | `society_record/annual_summary_screen.dart` | 4 | Done | Tests: `mobile/test/society_record_test.dart`, `api/societies/society-record.service.spec.ts` |
| M06fx | M06fx Summary not added yet | Society Officer, SPC | Phone | `society_record/annual_summary_screen.dart` | 4 | Done | Tests: `mobile/test/society_record_test.dart` |
| M13a | M13a Upload the audit report | Society Officer, SPC | Phone | `society_record/society_record_screen.dart`, `document_upload_screen.dart` | 4 | Done | Tests: `dashboard/components/dashboard/documents/document-upload.test.tsx`, `mobile/test/society_record_test.dart` |
| M13 | M13 Documents | Society Officer, SPC | Phone | `society_record/society_record_screen.dart`, `document_upload_screen.dart` | 4 | Done | Tests: `dashboard/components/dashboard/activities/activities.test.tsx`, `mobile/test/document_library_test.dart` |
| M06h | M06h Change history | All phone roles | Phone | `society_record/society_record_screen.dart` (change history) | 3 | Done | Tests: `mobile/test/society_record_test.dart`, `api/societies/society-record.service.spec.ts` |
| M07 | M07 Exco members | Society Officer, SPC, DDM, DM (M07d) | Phone | `society_record/exco_screens.dart` | 3 | Done | Tests: `mobile/test/exco_v5_test.dart` |
| M07s | M07s Exco: 25 seats, incomplete until filled | Society Officer, SPC, DDM, DM (M07d) | Phone | `society_record/exco_screens.dart` | 3 | Done | Named in `mobile/society_record/society_record_screen.dart` |
| M07e | M07e Replace or edit a member | Society Officer, SPC, DDM, DM (M07d) | Phone | `society_record/exco_screens.dart` | 3 | Done | Tests: `mobile/test/exco_v5_test.dart` |
| M07o | M07o Choose an office bearer | Society Officer, SPC, DDM, DM (M07d) | Phone | `society_record/exco_screens.dart` | 3 | Done | Tests: `mobile/test/exco_v5_test.dart` |
| M07v | M07v Exco member | Society Officer, SPC, DDM, DM (M07d) | Phone | `society_record/exco_screens.dart` | 3 | Done | Tests: `mobile/test/exco_v5_test.dart` |
| M07r | M07r Exco member: NIC shown | Society Officer, SPC, DDM, DM (M07d) | Phone | `society_record/exco_screens.dart` | 3 | Done | Named in `mobile/society_record/exco_screens.dart` |
| M07x | M07x Replace, not remove | Society Officer, SPC, DDM, DM (M07d) | Phone | `society_record/exco_screens.dart` | 3 | Done | Tests: `mobile/test/exco_v5_test.dart` |
| M07d | M07d Exco member: DM view | Society Officer, SPC, DDM, DM (M07d) | Phone | `society_record/exco_screens.dart` | 3 | Done | Tests: `mobile/test/exco_v5_test.dart` |
| M09 | M09 Annual work plan | Society Officer | Phone | `society_record/work_plan_view.dart` | 4 | Done | Tests: `mobile/test/activities_v5_test.dart` |
| M09c | M09c Work plan calendar | Society Officer | Phone | `society_record/work_plan_view.dart` | 4 | Done | Named in `dashboard/app/(dashboard)/societies/[id]/work-plan/new/page.tsx`, `dashboard/components/dashboard/activities/activity-form.tsx` |
| M09a | M09a New activity: details and sector | Society Officer | Phone | `society_record/activity_screens.dart` | 4 | Done | Tests: `api/activities/activities.service.spec.ts` |
| M30 | M30 Give temporary access | DM (M30–M33), DDM (M32 view) | Phone | `district_access/district_access_screens.dart` | 7 | Done | Tests: `mobile/test/district_access_test.dart`, `api/identity/district-access.rules.spec.ts` |
| M31 | M31 Confirm temporary access | DM (M30–M33), DDM (M32 view) | Phone | `district_access/district_access_screens.dart` | 7 | Done | Tests: `mobile/test/district_access_test.dart` |
| M32 | M32 Active temporary access | DM (M30–M33), DDM (M32 view) | Phone | `district_access/district_access_screens.dart` | 7 | Done | Tests: `dashboard/components/dashboard/district-access/district-access.test.tsx`, `mobile/test/district_access_test.dart` |
| M33 | M33 End access early | DM (M30–M33), DDM (M32 view) | Phone | `district_access/district_access_screens.dart` | 7 | Done | Covered by the PR 7 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M16 | M16 Notifications | Each role | Phone | `screens/notifications_screen.dart` (Alerts tab) | 6, 9 | Done | Tests: `mobile/test/notifications_test.dart` |
| M16_SPC | M16_SPC Notifications | Each role | Phone | `screens/notifications_screen.dart` (Alerts tab) | 6, 9 | Done | Tests: `mobile/test/notifications_test.dart` |
| M16_DDM | M16_DDM Notifications | Each role | Phone | `screens/notifications_screen.dart` (Alerts tab) | 6, 9 | Done | Tests: `mobile/test/notifications_test.dart` |
| M16_DM | M16_DM Notifications | Each role | Phone | `screens/notifications_screen.dart` (Alerts tab) | 6, 9 | Done | Tests: `mobile/test/notifications_test.dart` |
| M16_HQ | M16_HQ Notifications | Each role | Phone | `screens/notifications_screen.dart` (Alerts tab) | 6, 9 | Done | Tests: `mobile/test/notifications_test.dart` |
| M17 | M17 More | Each role | Phone | `screens/more_screen.dart` | 6, 9 | Partial | Built; the "Help and HQ contact" content has no frame text yet (To Confirm). Tests: `mobile/test/sarvoai_test.dart`, `mobile/test/role_navigation_test.dart` |
| M17_SPC | M17_SPC More | Each role | Phone | `screens/more_screen.dart` | 6, 9 | Partial | Built; Help content To Confirm. Tests: `mobile/test/sarvoai_test.dart`, `mobile/test/role_navigation_test.dart` |
| M17_DDM | M17_DDM More | Each role | Phone | `screens/more_screen.dart` | 6, 9 | Partial | Built; Help content To Confirm. Tests: `mobile/test/sarvoai_test.dart`, `mobile/test/role_navigation_test.dart` |
| M17_DM | M17_DM More | Each role | Phone | `screens/more_screen.dart` | 6, 9 | Partial | Built; Help content To Confirm. Tests: `mobile/test/sarvoai_test.dart`, `mobile/test/role_navigation_test.dart` |
| M17_HQ | M17_HQ More | Each role | Phone | `screens/more_screen.dart` | 6, 9 | Partial | Built; Help content To Confirm. Tests: `mobile/test/sarvoai_test.dart`, `mobile/test/role_navigation_test.dart` |
| M48 | M48 Report an incident | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Done | Tests: `mobile/test/incidents_test.dart`, `api/test/db/emergencies.db-spec.ts` |
| M48n | M48n Incident notification | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Partial | Incident notifications are listed in the app (Incident tab, Alerts); a push notification needs FCM/APNs and device tokens (To Confirm, PR 8). Tests: `mobile/test/incidents_test.dart`, `api/test/db/emergencies.db-spec.ts` |
| M40 | M40 Home: active incident | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Done | Tests: `mobile/test/society_officer_home_test.dart`, `mobile/test/incidents_test.dart` |
| M41 | M41 Rapid assessment: a question | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Done | Deviation: progress shown as "Question 5 of 10" text, not a segmented bar (no-bars rule). Tests: `mobile/test/incidents_test.dart`, `api/test/db/emergencies.db-spec.ts` |
| M42 | M42 Rapid assessment: check and send | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Done | Named in `dashboard/app/(dashboard)/emergencies/actions.ts`, `mobile/incidents/incident_api.dart` |
| M43 | M43 Assessment sent | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Done | Tests: `mobile/test/incidents_test.dart`, `api/test/db/emergencies.db-spec.ts` |
| M49 | M49 Close an incident | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Done | Tests: `mobile/test/incidents_test.dart`, `api/test/db/emergencies.db-spec.ts` |
| M45 | M45 Help for the affected society | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Done | Tests: `mobile/test/incidents_test.dart`, `api/test/db/emergencies.db-spec.ts` |
| M45h | M45h Helping another society | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Done | Tests: `mobile/test/incidents_test.dart` |
| M46 | M46 Update delivery | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Done | Tests: `mobile/test/incidents_test.dart`, `api/test/db/emergencies.db-spec.ts` |
| M47 | M47 Situation report on the phone | Society Officer, SPC, DDM, DM, HQ | Phone | `incidents/incident_screens.dart` | 8 | Done | Tests: `mobile/test/incidents_test.dart`, `api/test/db/emergencies.db-spec.ts` |
| M26_Loading | M26 Loading | All phone roles | Phone | `widgets/state_views.dart` | 1 | Done | Tests: `mobile/test/v5_shell_test.dart`, `mobile/test/role_navigation_test.dart` |
| M26_Empty | M26 Empty | All phone roles | Phone | `widgets/state_views.dart` | 1 | Done | Tests: `mobile/test/v5_shell_test.dart`, `mobile/test/role_navigation_test.dart` |
| M26_Error | M26 Error · retry | All phone roles | Phone | `widgets/state_views.dart` | 1 | Done | Tests: `mobile/test/v5_shell_test.dart`, `mobile/test/role_navigation_test.dart` |
| M26_Success | M26 Success | All phone roles | Phone | `widgets/state_views.dart` | 1 | Done | Tests: `mobile/test/v5_shell_test.dart`, `mobile/test/role_navigation_test.dart` |
| M03e | M03e Sign in: wrong password | All phone roles | Phone | `sign_in_screen.dart` | 2 | Done | Tests: `mobile/test/api_auth_service_test.dart`, `api/test/db/identity.db-spec.ts` |
| M26_Denied | M26 No access | All phone roles | Phone | `widgets/state_views.dart` | 1 | Done | Deliberate deviation: does not name the refused society. Tests: `mobile/test/v5_shell_test.dart`, `mobile/test/role_navigation_test.dart` |
| M09b | M09b New activity: participants and beneficiaries | Society Officer | Phone | `society_record/activity_screens.dart` | 4 | Done | Named in `mobile/society_record/activity_screens.dart` |
| M09d | M09d New activity: resources and partners | Society Officer | Phone | `society_record/activity_screens.dart` | 4 | Done | Tests: `api/activities/activities.service.spec.ts` |
| M09r | M09r New activity: check and send | Society Officer | Phone | `society_record/activity_screens.dart` | 4 | Done | Covered by the PR 4 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M09s | M09s Activity sent to SPC | Society Officer | Phone | `society_record/activity_screens.dart` | 4 | Done | Named in `mobile/society_record/activity_screens.dart` |
| M50 | M50 SPC: activities to approve | SPC | Phone | `society_record/activity_screens.dart` | 4 | Done | Tests: `mobile/test/activities_v5_test.dart`, `api/activities/activities.service.spec.ts` |
| M51 | M51 SPC: review activity and choose UN SDGs | SPC | Phone | `society_record/activity_screens.dart` | 4 | Done | Tests: `dashboard/components/dashboard/activities/activities.test.tsx`, `mobile/test/activities_v5_test.dart` |
| M51b | M51b SPC: send activity back | SPC | Phone | `society_record/activity_screens.dart` | 4 | Done | Tests: `mobile/test/activities_v5_test.dart` |
| M52 | M52 SPC: activity approved | SPC | Phone | `society_record/activity_screens.dart` | 4 | Done | Tests: `mobile/test/activities_v5_test.dart`, `api/activities/activities.service.spec.ts` |
| M61 | M61 HQ: membership | HQ | Phone | `national/national_screens.dart` | 5 | Done | Tests: `mobile/test/national_v5_test.dart` |
| M62 | M62 HQ: audit and AGM | HQ | Phone | `national/national_screens.dart` | 5 | Done | Covered by the PR 5 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M63 | M63 HQ: profit and expenses | HQ | Phone | `national/national_screens.dart` | 5 | Done | Named in `mobile/national/national_screens.dart`, `mobile/national/national_models.dart` |
| M64 | M64 HQ: activities | HQ | Phone | `national/national_screens.dart` | 5 | Done | Tests: `mobile/test/national_v5_test.dart` |
| M65 | M65 HQ: districts | HQ | Phone | `national/national_screens.dart` | 5 | Done | Tests: `mobile/test/national_v5_test.dart` |
| M66 | M66 HQ: societies | HQ | Phone | `national/national_screens.dart` | 5 | Done | HQ can also create a society here (Create society → Assign staff), as on the dashboard; rows show "Exco N of 25" until the Exco is complete. Named in `mobile/national/national_screens.dart`, `mobile/national/national_models.dart` |
| M67 | M67 HQ: society summary | HQ | Phone | `national/national_screens.dart` | 5 | Done | Shows the Exco state and Assign staff, as on the dashboard. Tests: `mobile/test/national_v5_test.dart` |
| M67x | M67x HQ: society, figures not added | HQ | Phone | `national/national_screens.dart` | 5 | Done | Covered by the PR 5 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M68 | M68 HQ: map | HQ | Phone | `national/national_screens.dart` | 5 | Done | Covered by the PR 5 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M69a | M69a HQ: dashboard loading | HQ | Phone | `national/national_screens.dart` | 5 | Done | Covered by the PR 5 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M69b | M69b HQ: no societies match | HQ | Phone | `national/national_screens.dart` | 5 | Done | Named in `mobile/national/national_screens.dart` |
| M69c | M69c HQ: could not load | HQ | Phone | `national/national_screens.dart` | 5 | Done | Tests: `mobile/test/national_v5_test.dart` |
| M69d | M69d No access to the national view | HQ | Phone | `national/national_screens.dart` | 5 | Done | Tests: `dashboard/components/dashboard/district-access/district-access.test.tsx`, `mobile/test/national_v5_test.dart` |
| M80 | M80 SarvoAI: ask a question | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Tests: `mobile/test/sarvoai_test.dart` |
| M80b | M80b SarvoAI: question typed | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M81 | M81 SarvoAI: answering | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Tests: `mobile/test/sarvoai_test.dart` |
| M82 | M82 SarvoAI: average profit answer | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M82h | M82h SarvoAI: view details | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M83 | M83 SarvoAI: follow-up | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M84 | M84 SarvoAI: who is the president | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Tests: `mobile/test/sarvoai_test.dart` |
| M85 | M85 SarvoAI: which do you mean | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Tests: `mobile/test/sarvoai_test.dart` |
| M86 | M86 SarvoAI: profit above an amount for five years | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Tests: `mobile/test/sarvoai_test.dart` |
| M87 | M87 SarvoAI: yearly figures not submitted | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Tests: `mobile/test/sarvoai_test.dart` |
| M89a | M89a SarvoAI: no matching societies | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M89b | M89b SarvoAI: incomplete data | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M89c | M89c SarvoAI: unclear question | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M89d | M89d SarvoAI: question it cannot answer | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M89e | M89e SarvoAI: service error | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M89f | M89f SarvoAI: no access | DM, DDM, SPC, Society Officer | Phone | `sarvoai/sarvoai_screen.dart` (no access) | 9 | Done | Tests: `mobile/test/sarvoai_test.dart` |
| M84h | M84h SarvoAI: how the president was found | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M86h | M86h SarvoAI: how the five-year answer was found | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| M87h | M87h SarvoAI: how the not-submitted list was found | HQ | Phone | `sarvoai/sarvoai_screen.dart` (from M05h and More) | 9 | Done | Covered by the PR 9 frame range (e.g. "D40–D49", "M81–M84") in its screens and tests |
| Main | Sarvodaya Connect prototype: start | — | Prototype index | — | — | N/A | The prototype start page (links to the flows); not an app screen. |

## Partial frames and what is left

| Frame | What is not built | Why |
|---|---|---|
| D04 | The "Needs follow-up" tab is To Confirm (PR 5); the rest of D04 is built. | To Confirm |
| D05 | The record summary tiles are To Confirm (PR 3/4); the rest of D05 is built. | To Confirm |
| D05m | Summary tiles above the annual summary are To Confirm (PR 4). | To Confirm |
| D13 | Request tracker and sending requests are built; reminders and personal "My tasks" are To Confirm (PR 5). | To Confirm |
| D15 | Reports, preview, print-to-PDF and CSV are built; scheduled reports are To Confirm (they need EventBridge and email). | To Confirm |
| D17 | Profile, sign-out, language note and password are built; notification preferences are To Confirm (PR 9). | To Confirm |
| D02k | D02 shows a static district map with counts. Clicking a district to zoom in and see its societies (V5 D02k) is not built; `/map` (D03) shows every society instead. | Not built yet (resolvable from the prototype) |
| D02o | Numbered markers for societies at the same place are not built on D02 or `/map`. | Not built yet (resolvable from the prototype) |
| D02s | Choosing a society on the D02 map is not built; choosing a dot works on `/map` (D03), with the same society summary. | Not built yet (resolvable from the prototype) |
| D02x | A period with no figures shows the SDG empty line only; the "No data available for FY …" and "Not submitted" panels for membership, finance and audits in V5 D02x are not built. | Not built yet (resolvable from the prototype) |
| M17 | Built; the "Help and HQ contact" content has no frame text yet (To Confirm). | To Confirm |
| M17_SPC | Built; Help content To Confirm. | To Confirm |
| M17_DDM | Built; Help content To Confirm. | To Confirm |
| M17_DM | Built; Help content To Confirm. | To Confirm |
| M17_HQ | Built; Help content To Confirm. | To Confirm |
| M48n | Incident notifications are listed in the app (Incident tab, Alerts); a push notification needs FCM/APNs and device tokens (To Confirm, PR 8). | To Confirm |

## Rules checked across all screens (PR 10)

- **UN SDGs:** the 17 official icons (`apps/dashboard/public/sdg`, `apps/mobile/assets/sdg`, see `docs/sdg-icons.md`) are shown in order 1–17 in the SP07/M51 selector; rankings (D02, D07) count completed (SPC-approved) activities and order ties by SDG number (`rankSdgs`, tested in `national-rules.spec.ts`).
- **Financial records:** only yearly total profit and yearly total expenses (`annual_financial_summaries`); SarvoAI's tools read only those two figures (tested in `assistant.service.spec.ts`). No loans, savings, shares or bookkeeping.
- **No progress bars as data:** values, labels, badges, ranked lists and tables; loading is text or a small spinner. Phone tests assert no `LinearProgressIndicator` on the incident and SarvoAI screens.
- **Cards in a row** stretch to the same height (`items-stretch` grids on the dashboard; `IntrinsicHeight` rows on the phone).
