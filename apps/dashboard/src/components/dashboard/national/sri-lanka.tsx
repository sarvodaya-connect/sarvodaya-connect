/**
 * A simplified outline of Sri Lanka and a projection from latitude and
 * longitude to the SVG, shared by the D02 district map and the D03 map view.
 * Positions come from the society records; the outline is drawn by hand and
 * is only a guide.
 */
export const MAP_WIDTH = 250;
export const MAP_HEIGHT = 420;
const WEST = 79.5;
const EAST = 82;
const NORTH = 9.95;
const SOUTH = 5.85;

export function project(latitude: number, longitude: number) {
  return {
    x: ((longitude - WEST) / (EAST - WEST)) * MAP_WIDTH,
    y: ((NORTH - latitude) / (NORTH - SOUTH)) * MAP_HEIGHT,
  };
}

const OUTLINE: [number, number][] = [
  [9.82, 79.95], [9.83, 80.25], [9.6, 80.42], [9.3, 80.6], [8.95, 80.95], [8.55, 81.22],
  [8.2, 81.4], [7.85, 81.62], [7.45, 81.83], [7, 81.88], [6.65, 81.8], [6.25, 81.62],
  [6.12, 81.3], [6.03, 80.95], [5.93, 80.6], [6.03, 80.25], [6.25, 80.05], [6.6, 79.95],
  [7.05, 79.84], [7.5, 79.82], [8, 79.78], [8.4, 79.85], [8.75, 79.92], [9.05, 79.95],
  [9.3, 80.1], [9.55, 80.05],
];

export const OUTLINE_POINTS = OUTLINE.map(([latitude, longitude]) => {
  const { x, y } = project(latitude, longitude);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(" ");

export function IslandOutline() {
  return <polygon fill="#f7f5ec" points={OUTLINE_POINTS} stroke="#b9bdb2" strokeWidth={1.2} />;
}
