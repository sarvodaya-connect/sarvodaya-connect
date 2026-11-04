"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import type { MapSocietyClass, SocietyMap } from "@sarvodaya-connect/api-contracts";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { loadNationalMapPins } from "@/app/(dashboard)/map/actions";
import { GRADE_COLOURS, gradeText } from "@/lib/mapbox";

import { MapStatus } from "./map-status";
import { type Mapbox, useMapbox } from "./use-mapbox";

type Pin = SocietyMap["points"][number];
type SourceFeature = { properties: Record<string, unknown> | null; geometry: { coordinates: [number, number] } };
const SOURCE = "societies";
const INDEX_LAYER = "societies-index";

const LEGEND: { label: string; classes: MapSocietyClass[] }[] = [
  { label: "A · Strong", classes: ["A"] },
  { label: "B · Developing", classes: ["B"] },
  { label: "C · Needs strengthening", classes: ["C"] },
  { label: "No grade or not active", classes: ["UNGRADED", "NOT_ACTIVE"] },
];

/** Societies recorded at exactly the same position share one marker, so a list can be offered. */
export function groupByPosition(points: Pin[]) {
  const groups = new Map<string, Pin[]>();
  for (const point of points) {
    const key = `${point.latitude},${point.longitude}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  return groups;
}

const pinLabel = (pin: Pin) => `${pin.name}, ${gradeText(pin.class)}, open record`;
const tipText = (pin: Pin) => {
  const grade = gradeText(pin.class);
  return `${pin.name} · ${pin.societyCode} · ${grade[0]!.toUpperCase()}${grade.slice(1)}`;
};
const plainClick = (event: MouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);

const TIP_CLASS =
  "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1d2a22] px-2 py-1 text-[11px] font-semibold text-white group-hover:block group-focus-visible:block";
const RING_CLASS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d2a22] focus-visible:ring-offset-1";

function pinElement(pin: Pin, open: (id: string) => void) {
  const link = document.createElement("a");
  link.href = `/societies/${pin.id}`;
  link.className = `group relative block size-4 cursor-pointer rounded-full border-2 border-white shadow ${RING_CLASS}`;
  link.style.backgroundColor = GRADE_COLOURS[pin.class];
  link.dataset.mapClass = pin.class;
  link.setAttribute("aria-label", pinLabel(pin));
  const tip = document.createElement("span");
  tip.className = TIP_CLASS;
  tip.setAttribute("aria-hidden", "true");
  tip.textContent = tipText(pin);
  link.append(tip);
  link.addEventListener("click", (event) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    open(pin.id);
  });
  return link;
}

function bubble(count: number, label: string, className: string, onClick: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  const size = count < 10 ? 26 : count < 100 ? 32 : 38;
  button.style.width = button.style.height = `${size}px`;
  button.className = `grid cursor-pointer place-items-center rounded-full text-[11px] font-bold shadow ${className} ${RING_CLASS}`;
  button.setAttribute("aria-label", label);
  button.textContent = count.toLocaleString("en-GB");
  button.addEventListener("click", onClick);
  return button;
}

/**
 * V5 D02 Society map: every located society on a Mapbox map of Sri Lanka,
 * coloured by grade and clustered into numbered bubbles that zoom in when
 * clicked. A pin opens the society record.
 */
export function SocietyPinsMap({ token }: { token: string }) {
  const router = useRouter();
  const [pins, setPins] = useState<Pin[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [chooser, setChooser] = useState<Pin[] | null>(null);
  const chooserHeading = useRef<HTMLHeadingElement>(null);

  async function setup(mapbox: Mapbox, map: MapboxMap) {
    const result = await loadNationalMapPins();
    if ("error" in result) throw new Error(result.error);
    setPins(result.points);
    setTruncated(result.truncated);
    const groups = groupByPosition(result.points);
    map.addSource(SOURCE, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [...groups].map(([key, group]) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [group[0]!.longitude, group[0]!.latitude] },
          properties: { key, count: group.length },
        })),
      },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 44,
      clusterProperties: { societies: ["+", ["get", "count"]] },
    });
    // Invisible: it tells the markers below which points and clusters are drawn at this zoom. The markers are HTML, so they can take keyboard focus.
    map.addLayer({ id: INDEX_LAYER, type: "circle", source: SOURCE, paint: { "circle-opacity": 0, "circle-radius": 1 } });

    const open = (id: string) => router.push(`/societies/${id}`);
    let markers = new Map<string, Marker>();
    const sync = () => {
      const next = new Map<string, Marker>();
      // Rendered features only: querySourceFeatures also returns clusters from tiles of the previous zoom.
      for (const feature of map.queryRenderedFeatures({ layers: [INDEX_LAYER] }) as unknown as SourceFeature[]) {
        const properties = feature.properties ?? {};
        const [lng, lat] = feature.geometry.coordinates;
        const id = properties.cluster ? `cluster-${properties.cluster_id}` : `place-${properties.key}`;
        if (next.has(id)) continue;
        let marker = markers.get(id);
        if (!marker) {
          let element: HTMLElement;
          if (properties.cluster) {
            const count = Number(properties.societies);
            element = bubble(count, `${count} societies, zoom in`, "border-2 border-white bg-[#24492f] text-white", () => {
              (map.getSource(SOURCE) as GeoJSONSource).getClusterExpansionZoom(Number(properties.cluster_id), (error, zoom) => {
                if (!error && zoom !== null && zoom !== undefined) map.easeTo({ center: [lng, lat], zoom });
              });
            });
          } else {
            const group = groups.get(String(properties.key)) ?? [];
            element =
              group.length === 1
                ? pinElement(group[0]!, open)
                : bubble(group.length, `${group.length} societies at the same place, choose one`, "border-2 border-[#24492f] bg-white text-[#24492f]", () => {
                    setChooser(group);
                    requestAnimationFrame(() => chooserHeading.current?.focus());
                  });
          }
          marker = new mapbox.Marker({ element }).setLngLat([lng, lat]).addTo(map);
        }
        next.set(id, marker);
      }
      for (const [id, marker] of markers) if (!next.has(id)) marker.remove();
      markers = next;
    };
    // "idle" follows every move and tile load once the map has finished drawing.
    map.on("idle", sync);
    sync();
  }

  const { container, phase, retry } = useMapbox(token, setup, { maxZoom: 16, minZoom: 5 });

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative h-[340px] overflow-hidden rounded-lg bg-[#e9eef1]">
        <div aria-label="Map of societies in Sri Lanka, coloured by grade" className="h-full w-full" ref={container} role="region" />
        <MapStatus phase={phase} retry={retry} />
      </div>
      {chooser && (
        <section aria-labelledby="map-chooser" className="mt-2 rounded-lg border border-line px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-bold text-ink" id="map-chooser" ref={chooserHeading} tabIndex={-1}>
              {chooser.length} societies at this place
            </h3>
            <button className="text-[11px] font-semibold text-brand-forest hover:underline" onClick={() => setChooser(null)} type="button">
              Close
            </button>
          </div>
          <ul className="mt-1 divide-y divide-line-soft text-[12px]">
            {chooser.map((pin) => (
              <li key={pin.id}>
                <Link aria-label={pinLabel(pin)} className="flex items-center gap-2 py-1.5 text-ink hover:underline" href={`/societies/${pin.id}`}>
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: GRADE_COLOURS[pin.class] }} />
                  {pin.name} <span className="text-muted">{pin.societyCode}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {phase === "ready" && (
        <ul aria-label="Grade" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink">
          {LEGEND.map((item) => (
            <li className="flex items-center gap-1.5" key={item.label}>
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: GRADE_COLOURS[item.classes[0]!] }} />
              {item.label}
              <strong>{pins.filter((pin) => item.classes.includes(pin.class)).length.toLocaleString("en-GB")}</strong>
            </li>
          ))}
        </ul>
      )}
      {truncated && <p className="mt-1 text-[11px] text-muted">The map shows the first 10,000 societies. Use the list view to see them all.</p>}
    </div>
  );
}
