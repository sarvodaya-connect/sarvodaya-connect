/**
 * Explicit sort orders. Array.prototype.sort() without one compares UTF-16
 * code units, which suits ids but not names people read, nor timestamps.
 */

/** Fixed, locale-independent order for identifiers and other machine strings. */
export function byCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Alphabetical order for names shown to people ("apple" before "Banana"). */
export function byName(a: string, b: string): number {
  return a.localeCompare(b, 'en');
}

/** Earliest first, for ISO 8601 timestamps that may use different offsets. */
export function byInstant(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b);
}
