import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SocietyMap } from "@sarvodaya-connect/api-contracts";

import { mapboxToken, typedPosition } from "@/lib/mapbox";

import { fakeMapbox } from "./fake-mapbox.test-helper";

vi.mock("mapbox-gl", () => import("./fake-mapbox.test-helper"));
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));
const { loadNationalMapPins, push } = vi.hoisted(() => ({ loadNationalMapPins: vi.fn(), push: vi.fn() }));
vi.mock("@/app/(dashboard)/map/actions", () => ({ loadNationalMapPins }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { SocietyLocationMap } from "./society-location-map";
import { SocietyPinsMap } from "./society-pins-map";

const TOKEN = "pk.test-only";
type Pin = SocietyMap["points"][number];

const pin = (id: string, name: string, mapClass: Pin["class"], latitude = 7.5, longitude = 80.4): Pin => ({
  id,
  name,
  societyCode: `S-${id}`,
  class: mapClass,
  latitude,
  longitude,
  district: "Kurunegala",
});

const pins = [
  pin("1", "Pahala Kosgama SSS", "B"),
  pin("2", "Galewela SSS", "A", 7.75, 80.57),
  pin("3", "Rideegama SSS", "C", 7.55, 80.48),
  pin("4", "Ihala Kosgama SSS", "UNGRADED", 7.6, 80.3),
  pin("5", "Wariyapola SSS", "NOT_ACTIVE", 7.63, 80.24),
];

/** One unclustered feature per place, as Mapbox returns them once zoomed in. */
const placeFeatures = (points: Pin[]) =>
  points.map((point) => ({
    properties: { key: `${point.latitude},${point.longitude}`, count: 1 },
    geometry: { coordinates: [point.longitude, point.latitude] as [number, number] },
  }));

beforeEach(() => {
  vi.clearAllMocks();
  fakeMapbox.reset();
});

describe("Mapbox settings", () => {
  it("only uses a public pk. token", () => {
    expect(mapboxToken("pk.abc")).toBe("pk.abc");
    expect(mapboxToken(" pk.abc ")).toBe("pk.abc");
    expect(mapboxToken("")).toBeNull();
    expect(mapboxToken(undefined)).toBeNull();
    expect(mapboxToken("sk.secret")).toBeNull();
  });

  it("reads typed coordinates only when both are numbers in range", () => {
    expect(typedPosition("7.6123", "80.2354")).toEqual({ latitude: 7.6123, longitude: 80.2354 });
    expect(typedPosition("7.6", "")).toBeNull();
    expect(typedPosition("97", "80")).toBeNull();
    expect(typedPosition("abc", "80")).toBeNull();
  });
});

describe("V5 D02 society map (Mapbox)", () => {
  it("keeps the map inside Sri Lanka and Mapbox's attribution on", async () => {
    loadNationalMapPins.mockResolvedValue({ counts: {}, points: [], truncated: false });
    render(<SocietyPinsMap token={TOKEN} />);
    await screen.findByRole("list", { name: "Grade" });
    const options = fakeMapbox.maps[0]!.options;
    expect(options.accessToken).toBe(TOKEN);
    expect(options.maxBounds).toEqual(options.bounds);
    expect(options).not.toHaveProperty("attributionControl", false);
  });

  it("shows loading text, never a bar, until the pins arrive", () => {
    loadNationalMapPins.mockReturnValue(new Promise(() => {}));
    render(<SocietyPinsMap token={TOKEN} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the map…");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("colours each society by grade, labels it and counts the legend", async () => {
    fakeMapbox.features = placeFeatures(pins);
    loadNationalMapPins.mockResolvedValue({ counts: {}, points: pins, truncated: false });
    render(<SocietyPinsMap token={TOKEN} />);

    const colour = async (name: string) => (await screen.findByRole("link", { name })).style.backgroundColor;
    expect(await colour("Galewela SSS, grade A, open record")).toBe("rgb(47, 125, 74)");
    expect(await colour("Pahala Kosgama SSS, grade B, open record")).toBe("rgb(226, 179, 58)");
    expect(await colour("Rideegama SSS, grade C, open record")).toBe("rgb(224, 123, 46)");
    expect(await colour("Ihala Kosgama SSS, not graded, open record")).toBe("rgb(154, 163, 156)");
    expect(await colour("Wariyapola SSS, not active, open record")).toBe("rgb(154, 163, 156)");
    // Hover and keyboard focus show the name, S number and grade.
    expect(screen.getByText("Pahala Kosgama SSS · S-1 · Grade B")).toBeInTheDocument();

    const legend = screen.getByRole("list", { name: "Grade" });
    expect(legend).toHaveTextContent("A · Strong1");
    expect(legend).toHaveTextContent("No grade or not active2");
  });

  it("opens the society record when a society is clicked", async () => {
    const user = userEvent.setup();
    fakeMapbox.features = placeFeatures(pins.slice(0, 1));
    loadNationalMapPins.mockResolvedValue({ counts: {}, points: pins.slice(0, 1), truncated: false });
    render(<SocietyPinsMap token={TOKEN} />);
    const marker = await screen.findByRole("link", { name: "Pahala Kosgama SSS, grade B, open record" });
    expect(marker).toHaveAttribute("href", "/societies/1");
    await user.click(marker);
    expect(push).toHaveBeenCalledWith("/societies/1");
  });

  it("shows a cluster's count and zooms in when it is clicked", async () => {
    const user = userEvent.setup();
    fakeMapbox.features = [
      { properties: { cluster: true, cluster_id: 7, societies: 12 }, geometry: { coordinates: [80.5, 7.6] } },
    ];
    loadNationalMapPins.mockResolvedValue({ counts: {}, points: pins, truncated: false });
    render(<SocietyPinsMap token={TOKEN} />);
    const cluster = await screen.findByRole("button", { name: "12 societies, zoom in" });
    expect(cluster).toHaveTextContent("12");
    await user.click(cluster);
    expect(fakeMapbox.maps[0]!.eased).toEqual([{ center: [80.5, 7.6], zoom: 12 }]);
  });

  it("offers a list when several societies are at exactly the same place", async () => {
    const user = userEvent.setup();
    const shared = [pin("1", "Pahala Kosgama SSS", "B"), pin("9", "Kosgama Women's SSS", "A")];
    fakeMapbox.features = [{ properties: { key: "7.5,80.4", count: 2 }, geometry: { coordinates: [80.4, 7.5] } }];
    loadNationalMapPins.mockResolvedValue({ counts: {}, points: shared, truncated: false });
    render(<SocietyPinsMap token={TOKEN} />);
    await user.click(await screen.findByRole("button", { name: "2 societies at the same place, choose one" }));
    expect(screen.getByRole("heading", { name: "2 societies at this place" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kosgama Women's SSS, grade A, open record" })).toHaveAttribute("href", "/societies/9");
  });

  it("says the map could not load, and tries again", async () => {
    const user = userEvent.setup();
    loadNationalMapPins.mockResolvedValueOnce({ error: "Service unavailable" });
    render(<SocietyPinsMap token={TOKEN} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The map could not load");

    fakeMapbox.features = placeFeatures(pins.slice(0, 1));
    loadNationalMapPins.mockResolvedValueOnce({ counts: {}, points: pins.slice(0, 1), truncated: false });
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Pahala Kosgama SSS, grade B, open record" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error when Mapbox refuses the map", async () => {
    fakeMapbox.failLoad = true;
    loadNationalMapPins.mockResolvedValue({ counts: {}, points: [], truncated: false });
    render(<SocietyPinsMap token={TOKEN} />);
    expect(await screen.findByText("The map could not load")).toBeInTheDocument();
    expect(loadNationalMapPins).not.toHaveBeenCalled();
  });
});

describe("Single society location map", () => {
  it("shows a fixed pin on the record", async () => {
    render(<SocietyLocationMap name="Pahala Kosgama SSS" position={{ latitude: 7.5, longitude: 80.4 }} token={TOKEN} />);
    const marker = await screen.findByRole("img", { name: "Pahala Kosgama SSS map location" });
    await waitFor(() => expect(fakeMapbox.maps[0]!.options.center).toEqual([80.4, 7.5]));
    expect(marker).toBeInTheDocument();
  });

  it("sets the position from a click on the map or a drag of the pin", async () => {
    const onPick = vi.fn();
    render(<SocietyLocationMap name="Pahala Kosgama SSS" onPick={onPick} position={{ latitude: 7.5, longitude: 80.4 }} token={TOKEN} />);
    await screen.findByRole("img", { name: /Map pin for Pahala Kosgama SSS/ });
    const map = fakeMapbox.maps[0]!;
    act(() => map.emit("click", { lngLat: { lat: 7.123456789, lng: 80.987654321 } }));
    expect(onPick).toHaveBeenLastCalledWith(7.123457, 80.987654);

    const marker = fakeMapbox.markers[0]!;
    expect(marker.draggable).toBe(true);
    marker.setLngLat([80.2354, 7.6123]);
    act(() => marker.handlers.dragend!());
    expect(onPick).toHaveBeenLastCalledWith(7.6123, 80.2354);
  });

  it("does not let the record's pin be dragged", async () => {
    render(<SocietyLocationMap name="Pahala Kosgama SSS" position={{ latitude: 7.5, longitude: 80.4 }} token={TOKEN} />);
    await screen.findByRole("img", { name: "Pahala Kosgama SSS map location" });
    expect(fakeMapbox.markers[0]!.draggable).toBe(false);
  });
});
