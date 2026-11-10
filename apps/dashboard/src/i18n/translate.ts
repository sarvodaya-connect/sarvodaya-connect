import type { Locale } from "./config";
import type { MessageKey } from "./messages/en";

export type Messages = Record<MessageKey, string>;
type Values = Record<string, string | number>;
/** A key with `.one` and `.other` forms, such as "scope.societies". */
type PluralKey = MessageKey extends infer K ? (K extends `${infer Base}.other` ? Base : never) : never;

export interface Translator {
  (key: MessageKey, values?: Values): string;
  plural(key: PluralKey, count: number, values?: Values): string;
  locale: Locale;
}

const fill = (template: string, values: Values = {}) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));

const NUMBER_LOCALES: Record<Locale, string> = { en: "en-GB", si: "si-LK", ta: "ta-LK" };

/** Stored values stay as they are; only the display follows the language. */
export const formatNumber = (locale: Locale, value: number) => new Intl.NumberFormat(NUMBER_LOCALES[locale]).format(value);

export function createTranslator(messages: Messages, locale: Locale): Translator {
  const t = ((key, values) => fill(messages[key], values)) as Translator;
  t.locale = locale;
  t.plural = (key, count, values) => {
    const form = new Intl.PluralRules(NUMBER_LOCALES[locale]).select(count) === "one" ? "one" : "other";
    return fill(messages[`${key}.${form}` as MessageKey], { count: formatNumber(locale, count), ...values });
  };
  return t;
}
