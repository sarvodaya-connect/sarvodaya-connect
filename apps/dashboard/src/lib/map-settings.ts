import type { MapSocietyClass } from "@sarvodaya-connect/api-contracts";

/**
 * Issue #181: map settings shared by the society maps and the single-society
 * map. MapLibre draws them in the browser with OpenFreeMap's background map
 * (OpenStreetMap data). No key is needed.
 *
 * Only the background comes from OpenFreeMap: its style, tiles, fonts and
 * icons, all from tiles.openfreemap.org. Society names, positions and grades
 * come from our API and are drawn in the page; they are never sent there.
 * OpenFreeMap only learns which map area is being looked at.
 */

/** OpenFreeMap's light "Positron" style keeps the grade colours readable. Its credit comes with the tiles. */
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

/** Sri Lanka with a small margin, [west, south] and [east, north]. The default view fits it. */
export const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [
  [79.2, 5.6],
  [82.3, 10.1],
];

/**
 * How far the user can pan. Wider than the island because the map keeps the
 * whole view inside it: a wide card showing all of Sri Lanka also shows sea
 * either side.
 */
export const PAN_BOUNDS: [[number, number], [number, number]] = [
  [76.0, 4.0],
  [85.5, 11.7],
];

export const GRADE_COLOURS: Record<MapSocietyClass, string> = {
  A: "#2f7d4a",
  B: "#e2b33a",
  C: "#e07b2e",
  UNGRADED: "#9aa39c",
  NOT_ACTIVE: "#9aa39c",
};

export function gradeText(mapClass: MapSocietyClass) {
  if (mapClass === "NOT_ACTIVE") return "not active";
  if (mapClass === "UNGRADED") return "not graded";
  return `grade ${mapClass}`;
}

/** Six decimal places is about 10 cm, more than a pin needs. */
export const roundCoordinate = (value: number) => Math.round(value * 1e6) / 1e6;

/** The position typed in a form's latitude and longitude fields, or null while either is empty or out of range. */
export function typedPosition(latitude: string, longitude: string) {
  if (!latitude.trim() || !longitude.trim()) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { latitude: lat, longitude: lng } : null;
}
