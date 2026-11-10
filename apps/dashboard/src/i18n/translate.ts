import { createElement, Fragment, type ReactNode } from "react";

import type { Locale } from "./config";
import type { MessageKey } from "./messages/en";

export type Messages = Record<MessageKey, string>;
type Values = Record<string, string | number>;
/** A key with `.one` and `.other` forms, such as "scope.societies". */
type PluralKey = MessageKey extends infer K ? (K extends `${infer Base}.other` ? Base : never) : never;

export interface Translator {
  (key: MessageKey, values?: Values): string;
  plural(key: PluralKey, count: number, values?: Values): string;
  /** A whole sentence with parts styled inside it, so a translation can move them. */
  rich(key: MessageKey, parts: Record<string, ReactNode>): ReactNode;
  locale: Locale;
}

const fill = (template: string, values: Values = {}) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));

const NUMBER_LOCALES: Record<Locale, string> = { en: "en-GB", si: "si-LK", ta: "ta-LK" };

/** Stored values stay as they are; only the display follows the language. */
export const localeTag = (locale: Locale) => NUMBER_LOCALES[locale];

export const formatNumber = (locale: Locale, value: number) => new Intl.NumberFormat(NUMBER_LOCALES[locale]).format(value);

/** A date in the language's own month names. */
export const formatDate = (locale: Locale, value: Date, options: Intl.DateTimeFormatOptions) =>
  value.toLocaleDateString(NUMBER_LOCALES[locale], options);

export function createTranslator(messages: Messages, locale: Locale): Translator {
  const t = ((key, values) => fill(messages[key], values)) as Translator;
  t.locale = locale;
  t.plural = (key, count, values) => {
    const form = new Intl.PluralRules(NUMBER_LOCALES[locale]).select(count) === "one" ? "one" : "other";
    return fill(messages[`${key}.${form}` as MessageKey], { count: formatNumber(locale, count), ...values });
  };
  t.rich = (key, parts) =>
    createElement(
      Fragment,
      null,
      ...messages[key].split(/(\{\w+\})/).map((piece, index) => {
        const name = /^\{(\w+)\}$/.exec(piece)?.[1];
        return createElement(Fragment, { key: index }, name && name in parts ? parts[name] : piece);
      }),
    );
  return t;
}
