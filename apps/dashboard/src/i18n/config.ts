export const LOCALES = ["en", "si", "ta"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Holds the choice on this browser, before and after sign-in. Sign-out leaves it in place. */
export const LOCALE_COOKIE = "sc_locale";
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 3600;

/** Each language's name in that language: always shown this way, whichever language is active. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", si: "සිංහල", ta: "தமிழ்" };

/**
 * Languages a Sinhala or Tamil speaker has approved. Add one only after that
 * review (docs/localization.md): this list is what lets it reach production users.
 */
export const REVIEWED_LOCALES: readonly Locale[] = ["en"];

/** Unreviewed drafts appear only in development, or where SHOW_UNREVIEWED_TRANSLATIONS is set for review. */
export function availableLocales(env: { NODE_ENV?: string; SHOW_UNREVIEWED_TRANSLATIONS?: string } = process.env): readonly Locale[] {
  const showDrafts = env.NODE_ENV !== "production" || env.SHOW_UNREVIEWED_TRANSLATIONS === "true";
  return showDrafts ? LOCALES : REVIEWED_LOCALES;
}

export function resolveLocale(value: string | undefined, available: readonly Locale[]): Locale {
  return available.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}
