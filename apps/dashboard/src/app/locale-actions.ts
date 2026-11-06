"use server";

import { cookies } from "next/headers";

import { availableLocales, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/config";

/** Saves the language on this browser. Not a sign-in cookie, so sign-out leaves it. */
export async function setLocale(locale: string) {
  if (!availableLocales().some((available) => available === locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
