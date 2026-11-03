import type { MapSocietyClass } from "@sarvodaya-connect/api-contracts";

/**
 * Mapbox settings shared by the D02 society map and the single-society map.
 * The token is Mapbox's public `pk.` kind, restricted to the dashboard's URLs
 * in the Mapbox account. It is public configuration, not a secret, and is
 * never committed: set NEXT_PUBLIC_MAPBOX_TOKEN in apps/dashboard/.env.local
 * or as an Amplify build variable. Without it the drawn maps are shown.
 */
export function mapboxToken(value = process.env.NEXT_PUBLIC_MAPBOX_TOKEN): string | null {
  const token = value?.trim();
  return token && token.startsWith("pk.") ? token : null;
}

/** To Confirm with Sarvodaya: a light base map keeps the grade colours readable. */
export const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

/** Sri Lanka with a small margin, [west, south] and [east, north]. Pan and zoom stay inside it. */
export const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [
  [79.2, 5.6],
  [82.3, 10.1],
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
