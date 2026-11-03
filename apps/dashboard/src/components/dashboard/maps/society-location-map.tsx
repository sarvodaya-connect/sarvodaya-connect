"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { useEffect, useRef } from "react";

import { roundCoordinate } from "@/lib/mapbox";

import { MapStatus } from "./map-status";
import { type Mapbox, useMapbox } from "./use-mapbox";

type Position = { latitude: number; longitude: number };

const PIN_SVG =
  '<svg aria-hidden="true" width="28" height="36" viewBox="0 0 28 36"><path d="M14 1C6.8 1 1 6.6 1 13.6 1 23 14 35 14 35s13-12 13-21.4C27 6.6 21.2 1 14 1z" fill="#c0392b" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13.5" r="4.5" fill="#fff"/></svg>';

function pinElement(label: string) {
  const element = document.createElement("div");
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", label);
  element.innerHTML = PIN_SVG;
  return element;
}

/**
 * One society's map position. Read-only on the record; with `onPick` (the
 * create and edit forms), a click or a drag of the pin sets the position and
 * the form's latitude and longitude fields stay the source of the value.
 */
export function SocietyLocationMap({
  className = "h-40",
  name,
  onPick,
  position,
  token,
}: {
  className?: string;
  name: string;
  onPick?: (latitude: number, longitude: number) => void;
  position: Position | null;
  token: string;
}) {
  const live = useRef<{ mapbox: Mapbox; map: MapboxMap; marker: Marker | null } | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const label = onPick ? `Map pin for ${name || "the new society"}. Drag it, or click the map, to set the location` : `${name} map location`;

  function placePin(next: Position | null) {
    const current = live.current;
    if (!current) return;
    if (!next) {
      current.marker?.remove();
      current.marker = null;
      return;
    }
    if (current.marker) {
      current.marker.setLngLat([next.longitude, next.latitude]);
      return;
    }
    const marker = new current.mapbox.Marker({ anchor: "bottom", draggable: Boolean(pick.current), element: pinElement(label) })
      .setLngLat([next.longitude, next.latitude])
      .addTo(current.map);
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLngLat();
      pick.current?.(roundCoordinate(lat), roundCoordinate(lng));
    });
    current.marker = marker;
  }

  const { container, phase, retry } = useMapbox(
    token,
    (mapbox, map) => {
      live.current = { mapbox, map, marker: null };
      placePin(position);
      if (pick.current) {
        map.getCanvas().style.cursor = "crosshair";
        map.on("click", (event) => pick.current?.(roundCoordinate(event.lngLat.lat), roundCoordinate(event.lngLat.lng)));
      }
    },
    position ? { bounds: undefined, center: [position.longitude, position.latitude], zoom: 13 } : {},
  );

  // Typed coordinates move the pin too. Values outside Sri Lanka are left for the form to reject.
  const latitude = position?.latitude;
  const longitude = position?.longitude;
  useEffect(() => {
    if (phase !== "ready") return;
    placePin(latitude === undefined || longitude === undefined ? null : { latitude, longitude });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placePin only reads refs
  }, [latitude, longitude, phase]);

  return (
    <div className={`relative overflow-hidden rounded-lg border border-line bg-[#e3efe0] ${className}`}>
      <div aria-label={onPick ? "Map for choosing the society's location" : `Map showing where ${name} is`} className="absolute inset-0" ref={container} role="region" />
      <MapStatus phase={phase} retry={retry} />
    </div>
  );
}
