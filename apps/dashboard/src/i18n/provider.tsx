"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import { DEFAULT_LOCALE, type Locale } from "./config";
import { en } from "./messages/en";
import { createTranslator, type Messages, type Translator } from "./translate";

type I18n = { t: Translator; locale: Locale; available: readonly Locale[] };

const I18nContext = createContext<I18n>({
  t: createTranslator(en, DEFAULT_LOCALE),
  locale: DEFAULT_LOCALE,
  available: [DEFAULT_LOCALE],
});

/** Sends only the active language to the browser. */
export function I18nProvider({
  available,
  children,
  locale,
  messages,
}: {
  available: readonly Locale[];
  children: ReactNode;
  locale: Locale;
  messages: Messages;
}) {
  const value = useMemo(() => ({ t: createTranslator(messages, locale), locale, available }), [available, locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
