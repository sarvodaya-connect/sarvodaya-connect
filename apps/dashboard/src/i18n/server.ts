import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { availableLocales, LOCALE_COOKIE, type Locale, resolveLocale } from "./config";
import { en } from "./messages/en";
import { si } from "./messages/si";
import { ta } from "./messages/ta";
import { createTranslator, type Messages } from "./translate";

const CATALOGS: Record<Locale, Messages> = { en, si, ta };

export const messagesFor = (locale: Locale) => CATALOGS[locale];

export const getLocale = cache(async (): Promise<Locale> =>
  resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value, availableLocales()),
);

/** For server components and server actions. */
export async function getT() {
  const locale = await getLocale();
  return createTranslator(CATALOGS[locale], locale);
}
