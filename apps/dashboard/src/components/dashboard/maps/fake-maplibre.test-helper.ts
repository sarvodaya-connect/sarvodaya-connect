/**
 * A stand-in for maplibre-gl in tests (`vi.mock("maplibre-gl", () => import(...))`).
 * jsdom has no WebGL, so the fake map only keeps the HTML markers it is given
 * in its container and returns `fakeMapLibre.features` as the drawn features.
 */
type Handler = (event?: unknown) => void;
type LngLat = [number, number];

export const fakeMapLibre = {
  /** What queryRenderedFeatures returns: points and clusters as MapLibre would draw them. */
  features: [] as { properties: Record<string, unknown>; geometry: { coordinates: LngLat } }[],
  /** Fail the next maps before "load", as no network or a blocked tile server would. */
  failLoad: false,
  maps: [] as Map[],
  markers: [] as Marker[],
  workerUrl: "",
  reset() {
    this.features = [];
    this.failLoad = false;
    this.maps = [];
    this.markers = [];
    this.workerUrl = "";
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
    fakeMapLibre.maps.push(this);
    const fail = fakeMapLibre.failLoad;
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

  /** Each source's data after setData, newest last. */
  data: Record<string, unknown[]> = {};

  getSource(id: string) {
    return {
      getClusterExpansionZoom: async () => 12,
      setData: (data: unknown) => (this.data[id] ??= []).push(data),
    };
  }

  queryRenderedFeatures() {
    return fakeMapLibre.features;
  }

  getContainer() {
    return this.container;
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
    fakeMapLibre.markers.push(this);
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

export function getWorkerUrl() {
  return fakeMapLibre.workerUrl;
}

export function setWorkerUrl(url: string) {
  fakeMapLibre.workerUrl = url;
}
