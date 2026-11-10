# Localization

The dashboard and phone app support English, Sinhala (`si`) and Tamil (`ta`). The work is delivered in phases under issue #108, and [`localization-audit.md`](localization-audit.md) tracks every screen. Screens not yet converted still show English.

## How language choice works

| Question | Dashboard | Phone |
|---|---|---|
| Where it is saved | `sc_locale` cookie on this browser, for one year | On this device |
| Before sign-in | Uses the saved language, and can be changed on the sign-in screen | First run asks, then uses the saved language |
| After sign-in | Same choice, changed in Settings | Same choice, changed in More › Language |
| After sign-out, reload or restart | Kept | Kept |
| Nothing chosen yet | English | English |
| Different account on the same device | Keeps this device's language | Keeps this device's language |

The choice belongs to the browser or device, not the account, so this work needs no API or database change. A per-account preference can be added later.

## Translation review

**Sinhala and Tamil are drafts until a native speaker approves them.** Drafts are written with AI assistance and must not reach users without review.

| Build | Languages offered |
|---|---|
| Dashboard in production | Reviewed languages only (currently English) |
| Dashboard in development, or with `SHOW_UNREVIEWED_TRANSLATIONS=true` | All three |
| Phone release build | Reviewed languages only (currently English) |
| Phone debug build, or with `--dart-define=SC_SHOW_UNREVIEWED_TRANSLATIONS=true` | All three |

With only one language available, the dashboard's switcher and the phone's first-run language screen don't appear.

To approve a language once reviewed, add it to `REVIEWED_LOCALES` in `apps/dashboard/src/i18n/config.ts` and `reviewedLanguages` in `apps/mobile/lib/src/models/app_language.dart`. Approve only when its whole journey is translated, or people would see mixed languages.

**Review builds** use a test environment only, with `SHOW_UNREVIEWED_TRANSLATIONS` or the Dart define set. Never set either in production.

## Adding text

**Dashboard:** add the key to `src/i18n/messages/en.ts`, `si.ts` and `ta.ts`. Then use `const { t } = useI18n()` in client components, or `const t = await getT()` in server components. For plurals, add `.one` and `.other` forms and call `t.plural("key", count)`.

**Phone:** add the key to `lib/l10n/app_en.arb`, `app_si.arb` and `app_ta.arb`, run `flutter pub get`, and use `context.l10n.key`. Generated files aren't committed.

**Missing translations fail the checks.** A missing dashboard key is a compile error. On both platforms, tests fail if a key is missing, has different placeholders, or is left in English in a translation. On the phone, `build/untranslated-l10n.json` also lists them.

## What stays untranslated

- Brand names and acronyms: Sarvodaya Connect, SarvoAI, HQ, SPC, DDM, DM, NIC, GPS, SDGs, FY, LKR, Exco.
- Society and district names, people's names, uploaded documents, audit records and anything else users enter or the database stores.
- API identifiers, enum values and routes. Map them to display labels instead.

English Title Case (issue #100) is an English rule. Don't apply it to Sinhala or Tamil.

## Known limits of this phase

- **Most screens are still English.** The audit lists them.
- **API messages are still English.** They need structured codes, in a later phase.
- **Browser and device only:** the language doesn't follow someone to another device.
- **Dashboard rendering:** reading the cookie in the root layout makes every dashboard route render per request.
