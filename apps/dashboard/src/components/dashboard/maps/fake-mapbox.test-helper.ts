/**
 * A stand-in for mapbox-gl in tests (`vi.mock("mapbox-gl", () => import(...))`).
 * jsdom has no WebGL, so the fake map only keeps the HTML markers it is given
 * in its container and returns `fakeMapbox.features` as the drawn features.
 */
type Handler = (event?: unknown) => void;
type LngLat = [number, number];

export const fakeMapbox = {
  /** What queryRenderedFeatures returns: points and clusters as Mapbox would draw them. */
  features: [] as { properties: Record<string, unknown>; geometry: { coordinates: LngLat } }[],
  /** Fail the next maps before "load", as a refused token or no network would. */
  failLoad: false,
  maps: [] as Map[],
  markers: [] as Marker[],
  reset() {
    this.features = [];
    this.failLoad = false;
    this.maps = [];
    this.markers = [];
  },
};

export class Map {
  readonly container: HTMLElement;
  readonly options: Record<string, unknown>;
  readonly handlers: Record<string, Handler[]> = {};
  readonly sources: Record<string, unknown> = {};
  readonly easeTo: (options: unknown) => void;

  constructor(options: { container: HTMLElement } & Record<string, unknown>) {
    this.container = options.container;
    this.options = options;
    this.easeTo = (eased) => this.eased.push(eased);
    fakeMapbox.maps.push(this);
    const fail = fakeMapbox.failLoad;
    queueMicrotask(() => this.emit(fail ? "error" : "load", { error: new Error("refused") }));
  }

  eased: unknown[] = [];

  on(type: string, handler: Handler) {
    (this.handlers[type] ??= []).push(handler);
    return this;
  }

  emit(type: string, event?: unknown) {
    for (const handler of this.handlers[type] ?? []) handler(event);
  }

  addSource(id: string, source: unknown) {
    this.sources[id] = source;
  }

  addLayer() {}

  getSource() {
    return { getClusterExpansionZoom: (_id: number, done: (error: Error | null, zoom: number) => void) => done(null, 12) };
  }

  queryRenderedFeatures() {
    return fakeMapbox.features;
  }

  getCanvas() {
    return { style: {} as Record<string, string> };
  }

  remove() {}
}

export class Marker {
  readonly element: HTMLElement;
  readonly draggable: boolean;
  readonly handlers: Record<string, Handler> = {};
  lngLat: LngLat = [0, 0];

  constructor(options: { element: HTMLElement; draggable?: boolean }) {
    this.element = options.element;
    this.draggable = Boolean(options.draggable);
    fakeMapbox.markers.push(this);
  }

  setLngLat(lngLat: LngLat) {
    this.lngLat = lngLat;
    return this;
  }

  addTo(map: Map) {
    map.container.append(this.element);
    return this;
  }

  remove() {
    this.element.remove();
  }

  on(type: string, handler: Handler) {
    this.handlers[type] = handler;
    return this;
  }

  getLngLat() {
    return { lng: this.lngLat[0], lat: this.lngLat[1] };
  }
}

// mapbox-gl's own typings declare a default export with the same classes.
const mapboxgl = { Map, Marker };
export default mapboxgl;
