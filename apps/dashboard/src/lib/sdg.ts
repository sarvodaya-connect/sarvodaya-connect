import { UN_SDGS } from "./v5-constants";

export { UN_SDGS };

/**
 * Official UN SDG colours, used only for the small number circle on chips.
 * The tiles themselves are the official icons in public/sdg (source:
 * docs/sdg-icons.md).
 */
export const SDG_COLOURS: Record<number, string> = {
  1: "#E5243B",
  2: "#DDA63A",
  3: "#4C9F38",
  4: "#C5192D",
  5: "#FF3A21",
  6: "#26BDE2",
  7: "#FCC30B",
  8: "#A21942",
  9: "#FD6925",
  10: "#DD1367",
  11: "#FD9D24",
  12: "#BF8B2E",
  13: "#3F7E44",
  14: "#0A97D9",
  15: "#56C02B",
  16: "#00689D",
  17: "#19486A",
};

export function sdgIconPath(sdg: number) {
  return `/sdg/sdg-${String(sdg).padStart(2, "0")}.jpg`;
}

export function sdgName(sdg: number) {
  return UN_SDGS.find((goal) => goal.number === sdg)?.title ?? `SDG ${sdg}`;
}

/** "SDG 4: Quality education, selected" — the accessible name of a selector tile. */
export function sdgTileLabel(sdg: number, selected: boolean) {
  return `SDG ${sdg}: ${sdgName(sdg)}${selected ? ", selected" : ""}`;
}
