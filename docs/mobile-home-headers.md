# Mobile home headers

Issue #120 uses the M05 / M05s / M05d Figma home designs as the reference.

`HomeMasthead` in `apps/mobile/lib/src/widgets/masthead.dart` shares the
approved logo, hills, trees, greeting and notifications entry across Society
Officer, SPC, DDM (including temporary access), DM and HQ homes.

- Names and scope come from the signed-in user and existing scoped home APIs.
- Greetings use the app clock and existing English, Sinhala and Tamil messages.
- Text wraps; the artwork has a fixed height and is excluded from pointer and
  accessibility handling. Header text stays clear of the trees.
- Field-role homes scroll the header with their content. Society Officer and
  HQ headers have a scrollable height limit to leave space for their content.
- Existing access rules remain in force. Temporary DDM district access remains
  view-only; assigned societies retain their existing edit rights.
- HQ keeps its search and SarvoAI actions. Its national access banner has
  English, Sinhala and Tamil messages; the new translations require native review.
- The app shell recreates cached page state when the account or role changes.
  Notifications continue using the existing session-isolated API loading flow.

The owner requested manual device testing and no screenshot/evidence submission.
Before merging, check each role, temporary DDM access, notification navigation and
unread counts, account switching, long names, all three languages, narrow screens,
landscape, safe areas and increased system text size on iOS and Android.
