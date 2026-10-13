# SC-25 Mobile Society Profile Flow

## Purpose

This document converts the approved AGM demonstration prototype into a low-fidelity mobile journey for the Society Officer. It is the design and implementation handoff for SC-26; it does not prescribe Flutter widget structure or API implementation.

The flow is provisional until Sarvodaya confirms the remaining business rules. All names, identifiers, dates, phone numbers and figures used for the demonstration must remain fictional.

## User and scope

- **User:** Society Officer
- **Authentication:** WSO2 Identity Server
- **Assigned record:** One society profile determined by the authenticated account
- **Primary goal:** Maintain the society record, submit changes to the District Manager and follow the review outcome
- **Out of scope for SC-25:** District/HQ dashboard implementation, production authentication, API integration and final visual styling

## Navigation model

The mobile app uses four persistent destinations:

1. **Home** - society summary, completeness and current submission
2. **Society** - society profile and committee maintenance
3. **Documents** - approved and draft supporting documents
4. **Tracker** - submission history, reviewer feedback and outcomes

The Home screen also exposes the contextual actions **View Society Profile**, **Update Committee**, **Report Activity** and **Upload Document**.

## Primary demonstration journey

| Step | Screen | Officer action | Expected result | Next |
| --- | --- | --- | --- | --- |
| 1 | Sign in | Enter WSO2 username and password | Assigned society account opens | Home |
| 2 | Home | Select **View Society Profile** | Current registry profile opens | Society profile |
| 3 | Society profile | Select **Update Committee** | Current Executive Committee is shown | Committee |
| 4 | Committee | Select **Replace** for Treasurer | Replacement form opens | Replace Treasurer |
| 5 | Replace Treasurer | Enter the new member, phone and start date, then save | Committee preview highlights the changed role | Committee changed |
| 6 | Committee changed | Select **Next: add supporting document** | Documents screen opens | Documents |
| 7 | Documents | Upload AGM minutes | File appears as a Draft attached to the update | Documents updated |
| 8 | Documents updated | Select **Next: review and submit** | Change summary opens | Review and submit |
| 9 | Review and submit | Check changed values and supporting document | Submission is ready to send | Confirm submission |
| 10 | Confirm submission | Confirm **Yes, submit** | Reference number is issued | Submitted |
| 11 | Submitted | Select **Track submission** | Timeline shows Submitted and awaiting District Manager review | Tracker |
| 12 | Home - Changes Requested | Open the returned submission | Only the field requiring correction is editable | Changes requested |
| 13 | Changes requested | Correct the returned field | Corrected value is ready for review | Review and resubmit |
| 14 | Review and resubmit | Confirm the correction and resubmit | Timeline adds Resubmitted | Tracker - Resubmitted |
| 15 | Tracker - Approved | View the final outcome | Approved value and reviewer comment are visible | End |

## Screen specifications

### M01 - Sign in

**Content**

- Sarvodaya Connect logo and name
- Username or email
- Password with visibility control
- Sign in button
- Password-help text directing the user to the District Centre
- WSO2 Identity Server notice

**Rules**

- Both credentials are required.
- Incorrect credentials display an inline message without clearing the username.
- A successful sign-in opens the account's assigned society; the user cannot choose another society.

### M02 - Home / status

**Content**

- Officer greeting and role
- Society name, Society ID and district
- Profile-completeness percentage, completed sections and missing sections
- Current-submission card
- Actions: View Society Profile, Update Committee, Report Activity and Upload Document

**Submission-card variants**

- No active submission
- Draft
- Submitted
- Under Review
- Changes Requested, with reviewer summary and **Open returned submission**
- Resubmitted
- Approved
- Rejected, with reason

### M03 - Society profile

**Content**

- Approval/verification badge and last verified date
- Registration: Society ID, registration number, established date, district and division
- Address and contact: address, phone and email
- GPS location/map preview with coordinates
- Executive Committee summary
- Edit Profile and Update Committee actions

**Rules**

- Missing data is labelled **Missing**, not silently hidden.
- Profile completeness is based on required sections, not submission status.
- Editing creates a draft; it must never change the approved record before review.

### M04 - Edit profile

**Editable sections**

- Address
- Village or town
- Society phone
- Society email
- GPS location

**Validation**

- Required fields show an inline message next to the field.
- Email must use a valid email structure.
- Phone input must use the agreed Sri Lankan format once confirmed by Sarvodaya.
- GPS may be captured from the device or placed manually.
- Denied location permission must offer **Open Settings** and **Place Pin Manually**.

### M05 - Executive Committee

**Content and actions**

- Member name, role, phone, start date and primary-contact indicator
- Add member
- Edit member
- Replace member
- Make primary contact

**Rules**

- Exactly one committee member is displayed as the primary contact.
- Replacing a role retains the outgoing member in history.
- Replacement requires the incoming member's name, phone and effective date.
- All edits remain Draft until submitted and approved.

### M06 - Documents

**Content and actions**

- Approved and draft document list
- Document name, type, upload date and review status
- Upload supporting document

**Upload rules**

- Select a document type before upload.
- Allowed demo formats: PDF, JPG and PNG.
- Maximum demo size: 10 MB.
- Invalid type or size displays an inline error and lets the user choose another file.
- A newly uploaded file is marked Draft and attached to the pending update.

### M07 - Review and submit

**Content**

- Old and proposed values for every changed field
- Unchanged sections summarised as **No change**
- Supporting-document summary
- Save as Draft
- Submit to District Manager

**Rules**

- Submission requires a confirmation dialog.
- Nothing is sent when the user cancels.
- A successful submission shows its reference and status.

### M08 - Submission result

**Content**

- Success indicator
- Submission reference
- Status: Submitted
- Submission type
- District Manager review notice
- Track submission and Back to Home actions

### M09 - Submission tracker

**Timeline events**

- Draft started
- Submitted to District Manager
- Under Review
- Changes Requested, including field and reviewer comment
- Resubmitted
- Approved or Rejected, including reviewer and date/time

**Rules**

- Pending review is visibly locked and cannot be edited.
- Activity submissions explicitly state that they are excluded from HQ reporting until approval.
- The officer can open a returned submission from the tracker or Home.

### M10 - Changes requested

**Content**

- Reviewer, date/time and comment
- Correction Required fields highlighted
- Previously submitted and corrected values
- Unaffected fields marked **No Correction Required** and read-only
- Review and Resubmit action

**Rules**

- Only fields returned by the District Manager can be changed.
- Resubmission requires confirmation.
- The original and corrected values remain visible in history.

## Reusable states

| State | Presentation | Available action |
| --- | --- | --- |
| Loading | Skeleton matching the destination screen | None until complete |
| Offline / network error | Plain explanation; preserve local draft | Try Again |
| Empty tracker | Explain that there are no submissions yet | Return Home or start an action |
| Validation error | Summary plus inline field errors | Correct highlighted fields |
| Authentication error | Inline message on Sign in | Retry credentials |
| Uploading | File name and progress indicator | Cancel Upload |
| Upload error | Explain size/type failure | Choose Another File |
| Submission success | Reference and status | Track Submission |
| Record locked | Reviewer name and review start time | View Read-only |
| Conflicting update | Explain that a newer version exists | Reload Record |
| Location permission denied | Explain why location is needed | Open Settings or Place Pin Manually |
| Changes requested | Returned field and reviewer comment | Open Returned Submission |

## Status model

`DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED`

Correction loop:

`UNDER_REVIEW -> CHANGES_REQUESTED -> RESUBMITTED -> UNDER_REVIEW`

Alternative end state:

`UNDER_REVIEW -> REJECTED`

Only **APPROVED** changes become part of the official society record. Draft, submitted and returned values must not replace the approved version.

## Data needed by the mobile flow

- Authenticated officer: display name, identity subject, assigned role and assigned society
- Society: ID, registration number, names, district, division, established date and status
- Contact/profile: address, village/town, phone, email, latitude and longitude
- Committee: member ID, name, role, phone, start date and primary-contact flag
- Document: ID, name, type, size, status, upload date and submission reference
- Submission: reference, type, status, submitted date, reviewer, returned fields, comments and timeline events
- Completeness: percentage, completed sections and missing sections

These field names describe UI needs. SC-26 should use local fixtures until the production API is available.

## SC-26 implementation boundary

Sithara's SC-26 should implement the approved screens and validation using mock data. It may create reusable Flutter widgets, navigation and fixtures. It should not implement WSO2 login, production HTTP calls, database logic, dashboard behaviour or final API integration.

Minimum SC-26 demonstration path:

`Sign in -> Home -> Society profile -> Committee -> Replace Treasurer -> Documents -> Review -> Submit -> Tracker -> Changes Requested -> Correct -> Resubmit -> Approved`

## Acceptance checklist

- [ ] Every primary screen and action above is represented.
- [ ] Navigation follows the approved demonstration path.
- [ ] Draft values are visually separate from the approved record.
- [ ] Required-field, authentication, upload and location errors are represented.
- [ ] Loading, offline, locked, conflicting-update and empty states are represented.
- [ ] Changes Requested permits only the returned fields to be edited.
- [ ] Submission history preserves comments, reviewer and timestamps.
- [ ] All displayed demonstration data is fictional.
- [ ] No real client information, credentials or secrets are included.

## Items requiring Sarvodaya confirmation

- Final committee roles and whether every role is compulsory
- Which profile fields are mandatory for completeness
- Phone-number format and multilingual field requirements
- Who may become the primary contact
- Allowed document types, retention rules and production size limits
- Whether Society Officers may withdraw a submission before review
- Whether rejected submissions may be edited and submitted again
- Notification channels and wording
