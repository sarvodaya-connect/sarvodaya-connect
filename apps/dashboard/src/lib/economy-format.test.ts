import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import { si } from "@/i18n/messages/si";
import { ta } from "@/i18n/messages/ta";
import { createTranslator } from "@/i18n/translate";

import {
  lastCompletedMonth,
  lastCompletedWeek,
  mondayOf,
  overviewHref,
  parseOverviewFilters,
  periodFor,
  periodLabel,
  productionQuery,
  productLabel,
  quantityLabel,
  safeReturnPath,
} from "./economy-format";

const EN = createTranslator(en, "en");
// 13 November 2026, 10:00 in Sri Lanka (a Friday).
const NOW = new Date("2026-11-13T04:30:00.000Z");
const DISTRICT = "29000000-0000-4000-8000-000000000001";

/** Issue #147: the overview's filters and labels. No figures are added up here. */
describe("Village Economic Profile filters", () => {
  it("defaults to actual figures for the last month that has ended in Sri Lanka", () => {
    const filters = parseOverviewFilters({}, NOW);
    expect(filters).toMatchObject({ basis: "MONTHLY", month: "2026-10", measurement: "ACTUAL", page: 1 });
    expect(productionQuery(filters)).toEqual({ basis: "MONTHLY", startsOn: "2026-10-01", endsOn: "2026-10-31", measurement: "ACTUAL" });
    // 1 January 2027 at 01:00 in Sri Lanka is still 31 December in UTC.
    expect(lastCompletedMonth(new Date("2026-12-31T19:30:00.000Z"))).toBe("2026-12");
  });

  it("turns any day of a week into Monday to Sunday", () => {
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(lastCompletedWeek(NOW)).toBe("2026-11-02");
    expect(periodFor(parseOverviewFilters({ basis: "WEEKLY", week: "2026-11-05" }, NOW))).toEqual({ startsOn: "2026-11-02", endsOn: "2026-11-08" });
  });

  it("handles month ends, including February in a leap year", () => {
    expect(periodFor(parseOverviewFilters({ month: "2028-02" }, NOW))).toEqual({ startsOn: "2028-02-01", endsOn: "2028-02-29" });
  });

  it("asks for a season's dates and refuses impossible seasons, without querying", () => {
    expect(periodFor(parseOverviewFilters({ basis: "SEASONAL" }, NOW))).toEqual({ problem: "CHOOSE_SEASON" });
    expect(periodFor(parseOverviewFilters({ basis: "SEASONAL", startsOn: "2026-03-10", endsOn: "2025-10-15" }, NOW))).toEqual({ problem: "INVALID" });
    expect(periodFor(parseOverviewFilters({ basis: "SEASONAL", startsOn: "2024-01-01", endsOn: "2025-01-02" }, NOW))).toEqual({ problem: "INVALID" });
    expect(productionQuery(parseOverviewFilters({ basis: "SEASONAL" }, NOW))).toBeNull();
    expect(productionQuery(parseOverviewFilters({ basis: "SEASONAL", startsOn: "2025-10-15", endsOn: "2026-03-10" }, NOW))).toMatchObject({
      basis: "SEASONAL",
      startsOn: "2025-10-15",
      endsOn: "2026-03-10",
    });
  });

  it("drops anything that is not a known code, date or id", () => {
    const filters = parseOverviewFilters(
      { basis: "YEARLY", month: "2026-13", measurement: "GUESSED", product: "GOLD", industry: "MINING", districtId: "north", societyId: "1 OR 1=1", page: "-3" },
      NOW,
    );
    expect(filters).toMatchObject({ basis: "MONTHLY", month: "2026-10", measurement: "ACTUAL", page: 1 });
    expect(filters.product).toBeUndefined();
    expect(filters.industry).toBeUndefined();
    expect(filters.districtId).toBeUndefined();
    expect(filters.societyId).toBeUndefined();
  });

  it("keeps the filters in links, so paging and Back show the same figures", () => {
    const filters = parseOverviewFilters({ month: "2026-10", product: "MILK", districtId: DISTRICT, measurement: "ESTIMATED" }, NOW);
    const href = overviewHref(filters, { page: 2 });
    expect(href).toBe(`/economic-profile?basis=MONTHLY&month=2026-10&measurement=ESTIMATED&product=MILK&districtId=${DISTRICT}&page=2`);
    const again = parseOverviewFilters(Object.fromEntries(new URL(href, "https://x").searchParams), NOW);
    expect(again).toEqual({ ...filters, page: 2 });
    expect(overviewHref(parseOverviewFilters({}, NOW))).toBe("/economic-profile?basis=MONTHLY&month=2026-10");
  });

  it("only follows a return link back to the overview", () => {
    expect(safeReturnPath("/economic-profile?basis=MONTHLY&month=2026-10")).toBe("/economic-profile?basis=MONTHLY&month=2026-10");
    for (const bad of ["https://example.com", "//example.com/economic-profile", "/economic-profile//evil", "/societies/x", "/economic-profile-x", undefined])
      expect(safeReturnPath(bad)).toBeUndefined();
  });
});

describe("Village Economic Profile labels", () => {
  it("writes quantities in the unit's own words and number format", () => {
    expect(quantityLabel(3200, "LITRE", EN)).toBe("3,200 litres");
    expect(quantityLabel(1, "LITRE", EN)).toBe("1 litre");
    expect(quantityLabel(12.5, "KILOGRAM", EN)).toBe("12.5 kg");
    expect(quantityLabel(14, "JOB", EN)).toBe("14 jobs");
    expect(quantityLabel(0, "NUT", EN)).toBe("0 nuts");
    expect(quantityLabel(3200, "LITRE", createTranslator(si, "si"))).toContain("ලීටර්");
    expect(quantityLabel(3200, "LITRE", createTranslator(ta, "ta"))).toContain("லீட்டர்");
  });

  it("names periods exactly", () => {
    expect(periodLabel({ basis: "MONTHLY", startsOn: "2026-10-01", endsOn: "2026-10-31" }, EN)).toBe("October 2026");
    expect(periodLabel({ basis: "WEEKLY", startsOn: "2026-11-02", endsOn: "2026-11-08" }, EN)).toBe("Week 2 Nov – 8 Nov 2026");
    expect(periodLabel({ basis: "SEASONAL", startsOn: "2025-10-15", endsOn: "2026-03-10", seasonLabel: "Maha 2025/26" }, EN)).toBe(
      "Maha 2025/26 · 15 Oct 2025 – 10 Mar 2026",
    );
  });

  it("shows Other by its description and an unknown code as sent", () => {
    expect(productLabel("MILK", EN)).toBe("Milk");
    expect(productLabel("OTHER", EN, "Fictional jaggery")).toBe("Fictional jaggery");
    expect(productLabel("SPICES", EN)).toBe("SPICES");
  });
});
