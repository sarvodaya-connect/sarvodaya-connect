"use client";

import type { Map as MapboxMap, MapOptions } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

import { MAP_STYLE, PAN_BOUNDS, SRI_LANKA_BOUNDS } from "@/lib/mapbox";

export type Mapbox = typeof import("mapbox-gl");
export type MapPhase = "loading" | "ready" | "error";

/**
 * Starts a Mapbox map in `container` bounded to Sri Lanka, then runs `setup`
 * once the style has loaded. Mapbox's logo and attribution stay on (the
 * defaults). A failure before the map is ready, including a refused token,
 * ends in "error"; `retry` starts again.
 */
export function useMapbox(
  token: string,
  setup: (mapbox: Mapbox, map: MapboxMap) => void | Promise<void>,
  options: Partial<Omit<MapOptions, "container" | "accessToken" | "style">> = {},
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
    let map: MapboxMap | undefined;
    const fail = () => {
      if (!cancelled) setPhase("error");
    };
    (async () => {
      // mapbox-gl is a UMD bundle: depending on the bundler the classes are on the module or on its default export.
      const bundle = await import("mapbox-gl");
      const mapbox = (bundle as unknown as { default?: Mapbox }).default ?? bundle;
      if (cancelled) return;
      map = new mapbox.Map({
        bounds: SRI_LANKA_BOUNDS,
        fitBoundsOptions: { padding: 12 },
        maxBounds: PAN_BOUNDS,
        ...latest.current.options,
        accessToken: token,
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
          await latest.current.setup(mapbox, map!);
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
  }, [token, attempt]);

  return {
    container,
    phase,
    retry: () => {
      setPhase("loading");
      setAttempt((value) => value + 1);
    },
  };
}
