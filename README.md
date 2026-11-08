# Issue #117 (scoped Programmes & Activities) screenshots

Evidence for the pull request for issue #117. All data is fictional, and the Sinhala and Tamil are unreviewed AI-assisted drafts.

- `d-*`: the real dashboard (`next start` production build) against the real API and a disposable local PostgreSQL with the fictional seed plus 11 fictional approved activities. Signed in as fictional HQ, DM (Fictional North District), DDM (one assigned society) and SPC (one North and one Central society) accounts, in headless Chrome at 1440 px. `d-ddmgrant-*` is the DDM with a valid temporary grant for Fictional North District; `d-ddm-en` is the same DDM without one.
- `m-*` (no `app-` prefix): the same dashboard at 390 px wide. Every page checked there has no horizontal scroll.
- `app-*`: the phone app's screens in a Flutter widget test at 390 × 844, and at 320 × 568 with 2× text (`-small-large-text`), with the macOS Arial, Sinhala Sangam MN and Tamil Sangam MN fonts and the demo API's fictional Kurunegala figures. A golden image shows only the first screen of a scrolling page.

What stays English is listed in `docs/localization-audit.md`. This branch can be deleted after review.
