"use client";

import type { Map as MapLibreMap, MapOptions } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { MAP_STYLE, PAN_BOUNDS, SRI_LANKA_BOUNDS } from "@/lib/map-settings";

export type MapLibre = typeof import("maplibre-gl");
export type MapPhase = "loading" | "ready" | "error";

/**
 * MapLibre draws in a web worker. Its own way of finding the worker file does
 * not survive bundling, so the bundler copies the file and the map is told
 * where it is.
 */
const workerUrl = () => new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href;

/**
 * Issue #181: starts a MapLibre map in `container` bounded to Sri Lanka, with
 * OpenFreeMap's background map, then runs `setup` once the style has loaded.
 * The credit for OpenFreeMap, OpenMapTiles and OpenStreetMap stays on (the
 * default). A failure before the map is ready, such as no connection, ends in
 * "error"; `retry` starts again.
 */
export function useMap(
  setup: (maplibre: MapLibre, map: MapLibreMap) => void | Promise<void>,
  options: Partial<Omit<MapOptions, "container" | "style">> = {},
) {
  const container = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<MapPhase>("loading");
  const [attempt, setAttempt] = useState(0);
  // The latest callbacks and options, without starting the map again.
  const latest = useRef({ setup, options });
  latest.current = { setup, options };

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let cancelled = false;
    let map: MapLibreMap | undefined;
    const fail = () => {
      if (!cancelled) setPhase("error");
    };
    (async () => {
      const maplibre: MapLibre = await import("maplibre-gl");
      if (cancelled) return;
      if (!maplibre.getWorkerUrl()) maplibre.setWorkerUrl(workerUrl());
      map = new maplibre.Map({
        bounds: SRI_LANKA_BOUNDS,
        fitBoundsOptions: { padding: 12 },
        maxBounds: PAN_BOUNDS,
        ...latest.current.options,
        container: element,
        style: MAP_STYLE,
      });
      let loaded = false;
      map.on("error", () => {
        if (!loaded) fail();
      });
      map.on("load", async () => {
        loaded = true;
        try {
          await latest.current.setup(maplibre, map!);
          if (!cancelled) setPhase("ready");
        } catch {
          fail();
        }
      });
    })().catch(fail);
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [attempt]);

  return {
    container,
    phase,
    retry: () => {
      setPhase("loading");
      setAttempt((value) => value + 1);
    },
  };
}
