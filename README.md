# Issue #108 phase 3 (society records) screenshots

Evidence for the pull request "feat: localize society records across dashboard and mobile (refs #108)". All data is fictional, and the Sinhala and Tamil are unreviewed AI-assisted drafts.

- `d-*`: dashboard components rendered in a test with fictional records, then styled with the production build's CSS and fonts in headless Chrome at 1280 px. The app's page chrome around them is not shown.
- `m-*`: phone screens rendered in a Flutter widget test at 390 × 844, and at 320 × 568 with 2× text (`-small-large-text`), with the macOS Arial, Sinhala Sangam MN and Tamil Sangam MN fonts. The record's Edit button shows boxes only because this harness doesn't load a font for that button style; in the app it renders normally.

The annual financial summary card and the API's own sentences stay English, as listed in `docs/localization-audit.md`. This branch can be deleted after review.
