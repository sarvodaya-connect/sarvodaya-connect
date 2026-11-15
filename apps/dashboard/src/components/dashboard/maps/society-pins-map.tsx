"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { MapSocietyClass, SocietyMap } from "@sarvodaya-connect/api-contracts";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { loadNationalMapPins } from "@/app/(dashboard)/map/actions";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages/en";
import type { Translator } from "@/i18n/translate";
import { GRADE_COLOURS } from "@/lib/map-settings";

import { MapStatus } from "./map-status";
import { type MapLibre, useMap } from "./use-map";

type Pin = SocietyMap["points"][number];
type SourceFeature = { properties: Record<string, unknown> | null; geometry: { coordinates: [number, number] } };
const SOURCE = "societies";
const INDEX_LAYER = "societies-index";

const LEGEND: { label: MessageKey; classes: MapSocietyClass[] }[] = [
  { label: "grade.A", classes: ["A"] },
  { label: "grade.B", classes: ["B"] },
  { label: "grade.C", classes: ["C"] },
  { label: "map.noGrade", classes: ["UNGRADED", "NOT_ACTIVE"] },
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

/** One map point per position, with how many societies are there. */
function pointData(groups: Map<string, Pin[]>): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [...groups].map(([key, group]) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [group[0]!.longitude, group[0]!.latitude] },
      properties: { key, count: group.length },
    })),
  };
}

const gradeText = (mapClass: MapSocietyClass, t: Translator) =>
  mapClass === "NOT_ACTIVE" ? t("map.gradeNotActive") : mapClass === "UNGRADED" ? t("map.gradeNotGraded") : t("map.gradeOf", { grade: mapClass });
const pinLabel = (pin: Pin, t: Translator) => t("map.pinLabel", { name: pin.name, grade: gradeText(pin.class, t) });
const tipText = (pin: Pin, t: Translator) => {
  const grade = gradeText(pin.class, t);
  return `${pin.name} · ${pin.societyCode} · ${grade[0]!.toUpperCase()}${grade.slice(1)}`;
};
const plainClick = (event: MouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);

const TIP_CLASS =
  "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1d2a22] px-2 py-1 text-[11px] font-semibold text-white group-hover:block group-focus-visible:block";
const RING_CLASS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d2a22] focus-visible:ring-offset-1";

function pinElement(pin: Pin, open: (id: string) => void, t: Translator) {
  const link = document.createElement("a");
  link.href = `/societies/${pin.id}`;
  link.className = `group relative block size-4 cursor-pointer rounded-full border-2 border-white shadow ${RING_CLASS}`;
  link.style.backgroundColor = GRADE_COLOURS[pin.class];
  link.dataset.mapClass = pin.class;
  link.setAttribute("aria-label", pinLabel(pin, t));
  const tip = document.createElement("span");
  tip.className = TIP_CLASS;
  tip.setAttribute("aria-hidden", "true");
  tip.textContent = tipText(pin, t);
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
 * V5 D02 and D03 society map (issue #181): every located society on a map of
 * Sri Lanka, coloured by grade and clustered into numbered bubbles that zoom
 * in when clicked. A society opens its record. The background map comes from
 * OpenFreeMap; the societies come from our API and are drawn here.
 *
 * Map View passes the `points` its filters chose, and the map follows them
 * when the filters change. Without `points` (National Overview) the map loads
 * every located society the viewer may see.
 */
export function SocietyPinsMap({
  className = "h-[340px]",
  legend = true,
  points,
  truncated: truncatedPoints = false,
}: {
  className?: string;
  /** Map View shows its own counts beside the map. */
  legend?: boolean;
  points?: Pin[];
  truncated?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pins, setPins] = useState<Pin[]>(points ?? []);
  const [truncated, setTruncated] = useState(truncatedPoints);
  const [chooser, setChooser] = useState<Pin[] | null>(null);
  const chooserHeading = useRef<HTMLHeadingElement>(null);
  const live = useRef<{ shown: Pin[]; show: (next: Pin[]) => void } | null>(null);

  async function setup(maplibre: MapLibre, map: MapLibreMap) {
    let initial = points;
    if (!initial) {
      const result = await loadNationalMapPins();
      if ("error" in result) throw new Error(result.error);
      initial = result.points;
      setTruncated(result.truncated);
    }
    let groups = groupByPosition(initial);
    setPins(initial);
    map.addSource(SOURCE, {
      type: "geojson",
      data: pointData(groups),
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 44,
      clusterProperties: { societies: ["+", ["get", "count"]] },
    });
    // Invisible: it tells the markers below which points and clusters are drawn at this zoom. The markers are HTML, so they can take keyboard focus.
    map.addLayer({ id: INDEX_LAYER, type: "circle", source: SOURCE, paint: { "circle-opacity": 0, "circle-radius": 1 } });

    const open = (id: string) => router.push(`/societies/${id}`);
    let markers = new Map<string, Marker>();
    const clear = () => {
      for (const marker of markers.values()) marker.remove();
      markers = new Map();
    };
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
            element = bubble(count, t("map.clusterLabel", { count }), "border-2 border-white bg-[#24492f] text-white", () => {
              (map.getSource(SOURCE) as GeoJSONSource)
                .getClusterExpansionZoom(Number(properties.cluster_id))
                .then((zoom) => map.easeTo({ center: [lng, lat], zoom }))
                .catch(() => {});
            });
          } else {
            const group = groups.get(String(properties.key)) ?? [];
            element =
              group.length === 1
                ? pinElement(group[0]!, open, t)
                : bubble(group.length, t("map.samePlace", { count: group.length }), "border-2 border-[#24492f] bg-white text-[#24492f]", () => {
                    setChooser(group);
                    requestAnimationFrame(() => chooserHeading.current?.focus());
                  });
          }
          marker = new maplibre.Marker({ element }).setLngLat([lng, lat]).addTo(map);
        }
        next.set(id, marker);
      }
      for (const [id, marker] of markers) if (!next.has(id)) marker.remove();
      markers = next;
    };
    // "idle" follows every move and tile load once the map has finished drawing.
    map.on("idle", sync);
    sync();
    live.current = {
      shown: initial,
      // New filter results: the old markers go, and the next "idle" draws the new ones.
      show: (next) => {
        if (next === live.current?.shown) return;
        live.current!.shown = next;
        groups = groupByPosition(next);
        clear();
        setChooser(null);
        (map.getSource(SOURCE) as GeoJSONSource).setData(pointData(groups));
      },
    };
  }

  const { container, phase, retry } = useMap(setup, { attributionControl: { compact: false }, maxZoom: 16, minZoom: 5 });

  useEffect(() => {
    if (!points) return;
    setPins(points);
    setTruncated(truncatedPoints);
    if (phase === "ready") live.current?.show(points);
  }, [points, truncatedPoints, phase]);

  return (
    <div className="flex flex-1 flex-col">
      <div className={`relative overflow-hidden rounded-lg bg-[#e9eef1] ${className}`}>
        <div aria-label={t("map.region")} className="h-full w-full" ref={container} role="region" />
        <MapStatus
          fallback={
            <Link className="font-semibold text-brand-forest underline underline-offset-2" href="/societies">
              {t("n.listView")}
            </Link>
          }
          phase={phase}
          retry={retry}
        />
      </div>
      {chooser && (
        <section aria-labelledby="map-chooser" className="mt-2 rounded-lg border border-line px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-bold text-ink" id="map-chooser" ref={chooserHeading} tabIndex={-1}>
              {t("map.atThisPlace", { count: chooser.length })}
            </h3>
            <button className="text-[11px] font-semibold text-brand-forest hover:underline" onClick={() => setChooser(null)} type="button">
              {t("map.close")}
            </button>
          </div>
          <ul className="mt-1 divide-y divide-line-soft text-[12px]">
            {chooser.map((pin) => (
              <li key={pin.id}>
                <Link aria-label={pinLabel(pin, t)} className="flex items-center gap-2 py-1.5 text-ink hover:underline" href={`/societies/${pin.id}`}>
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: GRADE_COLOURS[pin.class] }} />
                  {pin.name} <span className="text-muted">{pin.societyCode}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {legend && phase === "ready" && (
        <ul aria-label={t("home.grade")} className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink">
          {LEGEND.map((item) => (
            <li className="flex items-center gap-1.5" key={item.label}>
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: GRADE_COLOURS[item.classes[0]!] }} />
              {t(item.label)}
              <strong>{pins.filter((pin) => item.classes.includes(pin.class)).length.toLocaleString("en-GB")}</strong>
            </li>
          ))}
        </ul>
      )}
      {truncated && <p className="mt-1 text-[11px] text-muted">{t("map.truncated")}</p>}
    </div>
  );
}
