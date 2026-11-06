# Localization audit checklist

Generated from the frames in [`v5-coverage.md`](v5-coverage.md), so each row is a real screen. Issue #108 stays open until every row is done and reviewed.

**Status:** `Done` means the screen's application-owned text comes from the catalogs. `Partly done` means some of it does and the rest is listed under [Remaining exceptions](#remaining-exceptions). `Not started` means its own text is still English, although the navigation around it is translated on every screen. No Sinhala or Tamil text is reviewed yet, so `Done` doesn't mean approved. Phase assignments are a first grouping and may move as each phase is planned.

## Platform and role combinations

| Role | Dashboard | Phone |
|---|---|---|
| HQ | Yes | Yes |
| DM | Yes | Yes |
| DDM | Yes | Yes |
| SPC | Yes | Yes |
| Society Officer | **Does not exist:** Society Officers use the phone | Yes |

## Delivery phases

| Phase | Scope |
|---|---|
| 1 Foundation (#109) | Catalogs, persistence, checks, sign-in, navigation shell, Settings, More |
| 2 Homes, lists and national views | Dashboard: role homes, society lists, national dashboards, maps, reports, search, requests, temporary access. Phone: the same screens, in a separate PR. |
| 3 Society records | Society record, Exco, grade requests, staff assignment |
| 4 Records and documents | Documents, audits, yearly figures |
| 5 Activities and work plans | Work plans, activities, approvals, SDGs |
| 6 Disaster response | Incidents, assessments, situation reports |
| 7 Administration and notifications | Accounts, change log, alerts, requests |
| 8 SarvoAI | Interface text, then answering in the chosen language |
| 9 API messages | Structured error and notification codes across the 100+ API messages |
| 10 Dates, numbers and final review | Locale formatting across all screens, Sinhala and Tamil speaker review, final sweep |

## Dashboard (101 screens and states)

| Done | Frame | Screen | Roles | Phase |
|---|---|---|---|---|
| Done | D01 | Sign in | All desktop roles | 1 Foundation |
| Done | D02 | National Dashboard | HQ | 2 Homes, lists and national views |
| Done | D04 | Societies list | HQ | 2 Homes, lists and national views |
| Partly done | D05 | Society record: overview | HQ | 3 Society records |
| Not started | D05m | Summary not added yet | HQ | 4 Records and documents |
| Done | D05e | HQ: edit society information | HQ | 3 Society records |
| Done | D05x | Society record: Exco | HQ | 3 Society records |
| Not started | D05w | Society record: work plan | HQ | 5 Activities and work plans |
| Done | D05n | Create a society record | HQ | 3 Society records |
| Done | D05c | Create a society: Exco | HQ | 3 Society records |
| Done | D05a | Assign responsible staff | HQ | 3 Society records |
| Not started | D16 | Accounts | HQ | 7 Administration and notifications |
| Not started | D16i | Create an account | HQ | 7 Administration and notifications |
| Not started | D16t | Set a new password | HQ | 7 Administration and notifications |
| Done | D22 | Grade-change queue | HQ | 3 Society records |
| Done | D22r | Grade-change request | HQ | 3 Society records |
| Not started | D24 | Change & access log | HQ | 4 Records and documents |
| Done | D21 | Page states | All desktop roles | 3 Society records |
| Not started | D30 | Incidents: open an incident | HQ | 6 Disaster response |
| Not started | D31 | Live incident | HQ | 6 Disaster response |
| Not started | D32 | Response actions: assign helping societies | HQ | 6 Disaster response |
| Not started | D33 | Situation report | HQ | 6 Disaster response |
| Done | D01e | Sign in: wrong password | All desktop roles | 1 Foundation |
| Done | D03 | Map view | HQ | 2 Homes, lists and national views |
| Done | D03b | District view | HQ | 2 Homes, lists and national views |
| Done | D08 | Membership | HQ | 2 Homes, lists and national views |
| Not started | D11 | Audits and AGM | HQ | 4 Records and documents |
| Not started | D07 | Programmes and activities | HQ | 5 Activities and work plans |
| Done | D18 | Search | HQ | 2 Homes, lists and national views |
| Not started | D19 | Alerts | HQ | 7 Administration and notifications |
| Done | D13 | Requests and tasks | HQ | 2 Homes, lists and national views |
| Done | D15 | Reports | HQ | 2 Homes, lists and national views |
| Not started | D12 | Documents | HQ | 4 Records and documents |
| Done | D17 | Settings | HQ | 7 Administration and notifications |
| Not started | D40 | SarvoAI: ask a question | HQ | 8 SarvoAI |
| Not started | D40b | SarvoAI: question typed | HQ | 8 SarvoAI |
| Not started | D41 | SarvoAI: answering | HQ | 8 SarvoAI |
| Not started | D42 | SarvoAI: average profit answer | HQ | 8 SarvoAI |
| Not started | D42h | SarvoAI: how was this answered | HQ | 8 SarvoAI |
| Not started | D43 | SarvoAI: follow-up question | HQ | 8 SarvoAI |
| Not started | D44 | SarvoAI: who is the president | HQ | 8 SarvoAI |
| Not started | D44h | SarvoAI: how the president was found | HQ | 8 SarvoAI |
| Not started | D45 | SarvoAI: which do you mean | HQ | 8 SarvoAI |
| Not started | D46 | SarvoAI: profit above an amount for five years | HQ | 8 SarvoAI |
| Not started | D47 | SarvoAI: yearly figures not submitted | HQ | 8 SarvoAI |
| Not started | D49a | SarvoAI: no matching societies | HQ | 8 SarvoAI |
| Not started | D49b | SarvoAI: incomplete data | HQ | 8 SarvoAI |
| Not started | D49c | SarvoAI: unclear question | HQ | 8 SarvoAI |
| Not started | D49d | SarvoAI: question it cannot answer | HQ | 8 SarvoAI |
| Not started | D49e | SarvoAI: service error | HQ | 8 SarvoAI |
| Not started | D49f | SarvoAI: no access | SPC, DDM, DM | 8 SarvoAI |
| Not started | D46h | SarvoAI: how the five-year answer was found | HQ | 8 SarvoAI |
| Not started | D47h | SarvoAI: how the not-submitted list was found | HQ | 8 SarvoAI |
| Done | D02k | Dashboard: map zoomed to Kurunegala | HQ | 2 Homes, lists and national views |
| Done | D02o | Dashboard: two societies at the same place | HQ | 3 Society records |
| Done | D02s | Dashboard: society chosen on the map | HQ | 3 Society records |
| Done | D02n | Dashboard: societies with no location | HQ | 3 Society records |
| Done | D02l | Dashboard: loading | HQ | 2 Homes, lists and national views |
| Done | D02e | Dashboard: map could not load | HQ | 2 Homes, lists and national views |
| Done | D02x | Dashboard: period with no data yet | HQ | 2 Homes, lists and national views |
| Done | SP01 | SPC home | SPC | 2 Homes, lists and national views |
| Done | SP02 | SPC: my societies | SPC | 2 Homes, lists and national views |
| Partly done | SP03 | SPC: society record | SPC | 3 Society records |
| Done | SP04 | SPC: edit society information | SPC | 3 Society records |
| Done | SP05 | SPC: request a grade change | SPC | 3 Society records |
| Done | DD01 | DDM home | DDM | 2 Homes, lists and national views |
| Done | DD02 | DDM home: temporary district access | DDM | 2 Homes, lists and national views |
| Done | DD03 | DDM: my societies | DDM | 2 Homes, lists and national views |
| Done | DD04 | DDM: district societies, view only | DDM | 2 Homes, lists and national views |
| Partly done | DD05 | DDM: assigned society record | DDM | 3 Society records |
| Done | DD08 | DDM: edit society information | DDM | 3 Society records |
| Done | DD09 | DDM: request a grade change | DDM | 3 Society records |
| Partly done | DD06 | DDM: district society, view only | DDM | 3 Society records |
| Done | DD07 | DDM: after temporary access ends | DDM | 2 Homes, lists and national views |
| Done | DM01 | DM: district overview | DM | 2 Homes, lists and national views |
| Done | DM02 | DM: societies | DM | 2 Homes, lists and national views |
| Partly done | DM03 | DM: society record, view only | DM | 3 Society records |
| Done | DM04 | DM: temporary DDM access | DM | 2 Homes, lists and national views |
| Done | DM05 | DM: give temporary access | DM | 2 Homes, lists and national views |
| Not started | IR01 | Live incident (SPC) | SPC | 6 Disaster response |
| Not started | IR02 | Report an incident (SPC) | SPC | 6 Disaster response |
| Not started | IR03 | Rapid assessment (SPC) | SPC | 6 Disaster response |
| Not started | IR04 | Close incident (SPC) | SPC | 6 Disaster response |
| Not started | IR05 | Notifications (SPC) | SPC | 6 Disaster response |
| Not started | IR01_DDM | Live incident (DDM) | DDM | 6 Disaster response |
| Not started | IR02_DDM | Report an incident (DDM) | DDM | 6 Disaster response |
| Not started | IR03_DDM | Rapid assessment (DDM) | DDM | 6 Disaster response |
| Not started | IR04_DDM | Close incident (DDM) | DDM | 6 Disaster response |
| Not started | IR05_DDM | Notifications (DDM) | DDM | 6 Disaster response |
| Not started | IR01_DM | Live incident (DM) | DM | 6 Disaster response |
| Not started | IR02_DM | Report an incident (DM) | DM | 6 Disaster response |
| Not started | IR03_DM | Rapid assessment (DM) | DM | 6 Disaster response |
| Not started | IR04_DM | Close incident (DM) | DM | 6 Disaster response |
| Not started | IR05_DM | Notifications (DM) | DM | 6 Disaster response |
| Done | ST01 | Loading | All desktop roles | 2 Homes, lists and national views |
| Done | ST02 | Empty: no matching societies | All desktop roles | 3 Society records |
| Done | ST03 | Error: page could not load | All desktop roles | 2 Homes, lists and national views |
| Done | ST04 | No access to this society | All desktop roles | 3 Society records |
| Not started | SP06 | SPC: activities to approve | SPC | 5 Activities and work plans |
| Not started | SP07 | SPC: review activity and choose UN SDGs | SPC | 5 Activities and work plans |
| Not started | SP08 | SPC: activity approved | SPC | 5 Activities and work plans |

## Phone (105 screens and states)

| Done | Frame | Screen | Roles | Phase |
|---|---|---|---|---|
| Done | M01 | Splash | All phone roles | 1 Foundation |
| Done | M02 | Choose language | All phone roles | 1 Foundation |
| Done | M03 | Sign in | All phone roles | 1 Foundation |
| Done | M05 | Home: Society Officer | Society Officer | 3 Society records |
| Done | M05s | Home: SPC | SPC | 2 Homes, lists and national views |
| Done | M05d | Home: DDM | DDM | 2 Homes, lists and national views |
| Done | M05t | Home: DDM with temporary access | DDM | 2 Homes, lists and national views |
| Done | M05m | Home: DM | DM | 2 Homes, lists and national views |
| Done | M05h | Home: HQ National Dashboard | HQ | 2 Homes, lists and national views |
| Done | M20 | Society list: filters | DM, HQ | 3 Society records |
| Partly done | M06 | Society detail (Society Officer) | Society Officer, DM (view only) | 3 Society records |
| Partly done | M06_SPC | M06 Society detail (SPC) | SPC | 3 Society records |
| Partly done | M06_DDM | M06 Society detail (DDM) | DDM | 3 Society records |
| Partly done | M06v | Society detail: view only | Society Officer, DM (view only) | 3 Society records |
| Done | M06g | Request a grade change | SPC, DDM | 3 Society records |
| Done | M06q | Grade-change requests | SPC, DDM | 3 Society records |
| Done | M06e | Edit society information | Society Officer, SPC, DDM | 3 Society records |
| Done | M06u | Unsaved changes warning | Society Officer, DM (view only) | 3 Society records |
| Not started | M06f | Edit annual financial summary | Society Officer, SPC | 4 Records and documents |
| Not started | M06fx | Summary not added yet | Society Officer, SPC | 4 Records and documents |
| Not started | M13a | Upload the audit report | Society Officer, SPC | 4 Records and documents |
| Not started | M13 | Documents | Society Officer, SPC | 4 Records and documents |
| Done | M06h | Change history | All phone roles | 3 Society records |
| Done | M07 | Exco members | Society Officer, SPC, DDM, DM (M07d) | 3 Society records |
| Done | M07s | Exco: 25 seats, incomplete until filled | Society Officer, SPC, DDM, DM (M07d) | 3 Society records |
| Done | M07e | Replace or edit a member | Society Officer, SPC, DDM, DM (M07d) | 3 Society records |
| Done | M07o | Choose an office bearer | Society Officer, SPC, DDM, DM (M07d) | 3 Society records |
| Done | M07v | Exco member | Society Officer, SPC, DDM, DM (M07d) | 3 Society records |
| Done | M07r | Exco member: NIC shown | Society Officer, SPC, DDM, DM (M07d) | 3 Society records |
| Done | M07x | Replace, not remove | Society Officer, SPC, DDM, DM (M07d) | 3 Society records |
| Done | M07d | Exco member: DM view | Society Officer, SPC, DDM, DM (M07d) | 3 Society records |
| Not started | M09 | Annual work plan | Society Officer | 5 Activities and work plans |
| Not started | M09c | Work plan calendar | Society Officer | 5 Activities and work plans |
| Not started | M09a | New activity: details and sector | Society Officer | 5 Activities and work plans |
| Done | M30 | Give temporary access | DM (M30–M33), DDM (M32 view) | 2 Homes, lists and national views |
| Done | M31 | Confirm temporary access | DM (M30–M33), DDM (M32 view) | 2 Homes, lists and national views |
| Done | M32 | Active temporary access | DM (M30–M33), DDM (M32 view) | 2 Homes, lists and national views |
| Done | M33 | End access early | DM (M30–M33), DDM (M32 view) | 2 Homes, lists and national views |
| Not started | M16 | Notifications | Each role | 7 Administration and notifications |
| Not started | M16_SPC | Notifications | Each role | 7 Administration and notifications |
| Not started | M16_DDM | Notifications | Each role | 7 Administration and notifications |
| Not started | M16_DM | Notifications | Each role | 7 Administration and notifications |
| Not started | M16_HQ | Notifications | Each role | 7 Administration and notifications |
| Done | M17 | More | Each role | 7 Administration and notifications |
| Done | M17_SPC | More | Each role | 7 Administration and notifications |
| Done | M17_DDM | More | Each role | 7 Administration and notifications |
| Done | M17_DM | More | Each role | 7 Administration and notifications |
| Done | M17_HQ | More | Each role | 7 Administration and notifications |
| Not started | M48 | Report an incident | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Not started | M48n | Incident notification | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Not started | M40 | Home: active incident | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Not started | M41 | Rapid assessment: a question | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Not started | M42 | Rapid assessment: check and send | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Not started | M43 | Assessment sent | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Not started | M49 | Close an incident | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Not started | M45 | Help for the affected society | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Not started | M45h | Helping another society | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Not started | M46 | Update delivery | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Not started | M47 | Situation report on the phone | Society Officer, SPC, DDM, DM, HQ | 6 Disaster response |
| Partly done | M26_Loading | M26 Loading | All phone roles | 2 Homes, lists and national views |
| Partly done | M26_Empty | M26 Empty | All phone roles | 2 Homes, lists and national views |
| Partly done | M26_Error | M26 Error · retry | All phone roles | 2 Homes, lists and national views |
| Partly done | M26_Success | M26 Success | All phone roles | 2 Homes, lists and national views |
| Done | M03e | Sign in: wrong password | All phone roles | 1 Foundation |
| Partly done | M26_Denied | M26 No access | All phone roles | 2 Homes, lists and national views |
| Not started | M09b | New activity: participants and beneficiaries | Society Officer | 5 Activities and work plans |
| Not started | M09d | New activity: resources and partners | Society Officer | 5 Activities and work plans |
| Not started | M09r | New activity: check and send | Society Officer | 5 Activities and work plans |
| Not started | M09s | Activity sent to SPC | Society Officer | 5 Activities and work plans |
| Not started | M50 | SPC: activities to approve | SPC | 5 Activities and work plans |
| Not started | M51 | SPC: review activity and choose UN SDGs | SPC | 5 Activities and work plans |
| Not started | M51b | SPC: send activity back | SPC | 5 Activities and work plans |
| Not started | M52 | SPC: activity approved | SPC | 5 Activities and work plans |
| Done | M61 | HQ: membership | HQ | 2 Homes, lists and national views |
| Not started | M62 | HQ: audit and AGM | HQ | 4 Records and documents |
| Not started | M63 | HQ: profit and expenses | HQ | 4 Records and documents |
| Not started | M64 | HQ: activities | HQ | 5 Activities and work plans |
| Done | M65 | HQ: districts | HQ | 2 Homes, lists and national views |
| Done | M66 | HQ: societies | HQ | 3 Society records |
| Done | M67 | HQ: society summary | HQ | 3 Society records |
| Done | M67x | HQ: society, figures not added | HQ | 3 Society records |
| Done | M68 | HQ: map | HQ | 2 Homes, lists and national views |
| Done | M69a | HQ: dashboard loading | HQ | 2 Homes, lists and national views |
| Done | M69b | HQ: no societies match | HQ | 3 Society records |
| Done | M69c | HQ: could not load | HQ | 2 Homes, lists and national views |
| Done | M69d | No access to the national view | HQ | 2 Homes, lists and national views |
| Not started | M80 | SarvoAI: ask a question | HQ | 8 SarvoAI |
| Not started | M80b | SarvoAI: question typed | HQ | 8 SarvoAI |
| Not started | M81 | SarvoAI: answering | HQ | 8 SarvoAI |
| Not started | M82 | SarvoAI: average profit answer | HQ | 8 SarvoAI |
| Not started | M82h | SarvoAI: view details | HQ | 8 SarvoAI |
| Not started | M83 | SarvoAI: follow-up | HQ | 8 SarvoAI |
| Not started | M84 | SarvoAI: who is the president | HQ | 8 SarvoAI |
| Not started | M85 | SarvoAI: which do you mean | HQ | 8 SarvoAI |
| Not started | M86 | SarvoAI: profit above an amount for five years | HQ | 8 SarvoAI |
| Not started | M87 | SarvoAI: yearly figures not submitted | HQ | 8 SarvoAI |
| Not started | M89a | SarvoAI: no matching societies | HQ | 8 SarvoAI |
| Not started | M89b | SarvoAI: incomplete data | HQ | 8 SarvoAI |
| Not started | M89c | SarvoAI: unclear question | HQ | 8 SarvoAI |
| Not started | M89d | SarvoAI: question it cannot answer | HQ | 8 SarvoAI |
| Not started | M89e | SarvoAI: service error | HQ | 8 SarvoAI |
| Not started | M89f | SarvoAI: no access | DM, DDM, SPC, Society Officer | 8 SarvoAI |
| Not started | M84h | SarvoAI: how the president was found | HQ | 8 SarvoAI |
| Not started | M86h | SarvoAI: how the five-year answer was found | HQ | 8 SarvoAI |
| Not started | M87h | SarvoAI: how the not-submitted list was found | HQ | 8 SarvoAI |

## Remaining exceptions

`Done` means the text is in the catalogs, with an AI-assisted Sinhala and Tamil draft. **No Sinhala or Tamil is approved yet**: approval needs a native speaker's review (`docs/localization.md`), and these drafts stay hidden in production and release builds until then.

### Phone, phase 2 (homes, national views, temporary access)

| Text | Where | Why it is still English | Phase |
|---|---|---|---|
| "Needs attention" reasons on the DM home (M05m) | `GET /home` | Written by the API | 9 |
| Messages the server sends when a request fails, such as a refused temporary access grant | API errors | Sent as English sentences; the app's own connection and server messages are translated | 9 |
| Messages from the demonstration APIs, such as "Could not load your overview." when a demo load fails | `demo_*_api.dart` | They stand in for server messages | 9 |
| The active incident card on each home | `IncidentHomeSection` (M40) | Disaster response screens | 6 |
| UN SDG titles in the SDG tiles' screen-reader label (M05h) | `sdgTitle` | Shared with the activity screens | 5 |
| Province names in the district list (M65) | API data | Stored place names | — |
| Text each screen passes to the shared states (M26) | Each caller | The shared widgets' own text, such as "Loading" and "You Don't Have Access to This", is translated; each screen's message follows that screen's phase | By screen |

The filter sheet that M20 opens is translated already, because the role homes use the same sheet.

Numbers on the converted screens use the language's digit grouping (Tamil groups by lakh). Dates there use the language's month and day names. Phase 10 covers the rest of the app.

### Phase 3 (society records), dashboard and phone

| Text | Where | Why it is still English | Phase |
|---|---|---|---|
| The annual financial summary card at the top of the record overview (D05, SP03, DD05, DD06, DM03 on the dashboard; M06, M06_SPC, M06_DDM, M06v on the phone) | `annual-summary-cards.tsx`, `_AnnualSummaryCard` | Yearly figures and the audit report belong to records and documents. This is why those frames are `Partly done`: everything else on them is translated | 4 |
| The Work Plan and Documents tabs inside the record | Work plan and document screens | Their own frames (D05w, M09, M13) | 4 and 5 |
| What the API says is still missing from an Exco, such as "No Treasurer chosen yet." | `excoStatus.problems` | Written by the API. The app's own fallback, used when an older API sends none, is translated | 9 |
| Change-history entries, such as "Society information updated" | `history[].summary` | Written by the API and stored with the record | 9 |
| Messages the server sends when saving fails, for example a duplicate S number | API errors | Sent as English sentences; the app's own validation and connection messages are translated | 9 |
| "Creating a society and assigning staff need the live server…" on the phone in demonstration mode | `DemoSocietyAdminApi` | Stands in for a server message | 9 |
| Older demonstration society profiles (non-UUID ids, demo mode only) | `society-profile-tabs.tsx`, `societies/[id]/page.tsx` | Not a V5 frame; the API-backed record (D05) replaces them | Not planned |
| The locked-during-review notice | `NoticeBanner.locked` | Used by the activity review screens | 5 |
| Reasons a society needs attention, Exco office names sent by the API | API data | As in phase 2 | 9 |

D02o, D02s and D02n (two societies at one place, a society chosen on the map, societies with no location) take their text from the catalogs through #110's map components. This PR checked the code and marks them `Done`; they were not rendered here, because no Mapbox token was set.

Office titles (President, Secretary, Treasurer), seat groups, grades and record statuses are stored in English and sent that way to the API. Only their display labels are translated.

