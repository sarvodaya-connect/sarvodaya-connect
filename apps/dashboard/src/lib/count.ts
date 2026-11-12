/**
 * Issue #132: the whole number a person typed, or null when it is not a count
 * from 0 to `max`. Commas and spaces between digits are allowed ("1,000");
 * anything else (a minus sign, a decimal point, letters) is refused, and
 * nothing is silently dropped or clamped.
 */
export function parseCount(text: string, max: number): number | null {
  const compact = text.trim().replace(/[\s,]/g, "");
  if (!/^\d+$/.test(compact)) return null;
  const value = Number(compact);
  return Number.isSafeInteger(value) && value <= max ? value : null;
}
