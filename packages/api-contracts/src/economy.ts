import type { IsoDateTime } from "./common.js";
import type { ActorReference } from "./society-record.js";

/**
 * Issue #145: Village Economic Profile. Businesses operated by the society
 * itself (not every business or household in its village), what each one
 * produces, and how much was produced in an exact covered period.
 *
 * Society -> Business -> Output (product or service) -> Production record.
 *
 * The catalogue below is the one list of industries, products and units that
 * the API, the dashboard and the phone app share. The API mirrors it in
 * apps/api/src/economy/economy.catalogue.ts, and a test keeps the two equal.
 * Codes are stored and sent; the clients translate them for display.
 */

/** Canonical industries. OTHER needs a short description. */
export const ECONOMY_INDUSTRIES = [
  "AGRICULTURE",
  "LIVESTOCK_DAIRY",
  "FISHERIES",
  "FOOD_PROCESSING",
  "TEXTILES_GARMENTS",
  "HANDICRAFTS",
  "SERVICES",
  "OTHER",
] as const;
export type EconomyIndustry = (typeof ECONOMY_INDUSTRIES)[number];

export const BUSINESS_STATUSES = [
  "OPERATING",
  "SEASONAL",
  "TEMPORARILY_STOPPED",
  "CLOSED",
] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

/**
 * How a quantity is measured. `decimals` is how many decimal places are
 * accepted: 0 means whole numbers only (nuts, items, jobs).
 */
export const PRODUCTION_UNITS = [
  { code: "LITRE", decimals: 2 },
  { code: "KILOGRAM", decimals: 3 },
  { code: "METRE", decimals: 2 },
  { code: "ITEM", decimals: 0 },
  { code: "NUT", decimals: 0 },
  { code: "EGG", decimals: 0 },
  { code: "PACKET", decimals: 0 },
  { code: "JOB", decimals: 0 },
] as const;
export type ProductionUnit = (typeof PRODUCTION_UNITS)[number]["code"];

/**
 * Standard products and services. Each has exactly one unit, so outputs of
 * the same product can always be added and no conversion is ever guessed.
 * OTHER has no fixed unit: the officer picks one and describes the output,
 * and Other outputs are never added together in totals.
 */
export const ECONOMY_PRODUCTS = [
  { code: "MILK", industry: "LIVESTOCK_DAIRY", kind: "GOOD", unit: "LITRE" },
  { code: "CURD", industry: "LIVESTOCK_DAIRY", kind: "GOOD", unit: "KILOGRAM" },
  { code: "EGGS", industry: "LIVESTOCK_DAIRY", kind: "GOOD", unit: "EGG" },
  { code: "PADDY", industry: "AGRICULTURE", kind: "GOOD", unit: "KILOGRAM" },
  { code: "VEGETABLES", industry: "AGRICULTURE", kind: "GOOD", unit: "KILOGRAM" },
  { code: "FRUIT", industry: "AGRICULTURE", kind: "GOOD", unit: "KILOGRAM" },
  { code: "COCONUTS", industry: "AGRICULTURE", kind: "GOOD", unit: "NUT" },
  { code: "TEA_LEAF", industry: "AGRICULTURE", kind: "GOOD", unit: "KILOGRAM" },
  { code: "FISH", industry: "FISHERIES", kind: "GOOD", unit: "KILOGRAM" },
  { code: "DRIED_FISH", industry: "FISHERIES", kind: "GOOD", unit: "KILOGRAM" },
  { code: "RICE_FLOUR", industry: "FOOD_PROCESSING", kind: "GOOD", unit: "KILOGRAM" },
  { code: "SNACK_PACKETS", industry: "FOOD_PROCESSING", kind: "GOOD", unit: "PACKET" },
  { code: "GARMENTS", industry: "TEXTILES_GARMENTS", kind: "GOOD", unit: "ITEM" },
  { code: "HANDLOOM_FABRIC", industry: "TEXTILES_GARMENTS", kind: "GOOD", unit: "METRE" },
  { code: "HANDICRAFT_ITEMS", industry: "HANDICRAFTS", kind: "GOOD", unit: "ITEM" },
  { code: "TAILORING_JOBS", industry: "SERVICES", kind: "SERVICE", unit: "JOB" },
  { code: "REPAIR_JOBS", industry: "SERVICES", kind: "SERVICE", unit: "JOB" },
  { code: "OTHER", industry: null, kind: null, unit: null },
] as const;
export type EconomyProduct = (typeof ECONOMY_PRODUCTS)[number]["code"];

/** WEEKLY is Monday to Sunday, MONTHLY a calendar month, SEASONAL any labelled range. */
export const PRODUCTION_BASES = ["WEEKLY", "MONTHLY", "SEASONAL"] as const;
export type ProductionBasis = (typeof PRODUCTION_BASES)[number];

/** Actual and estimated figures are never added together. Summaries default to ACTUAL. */
export const PRODUCTION_MEASUREMENTS = ["ACTUAL", "ESTIMATED"] as const;
export type ProductionMeasurement = (typeof PRODUCTION_MEASUREMENTS)[number];

/** The largest quantity accepted for one record. */
export const MAX_PRODUCTION_QUANTITY = 100_000_000;
/** A season can cover at most this many days. */
export const MAX_SEASON_DAYS = 366;

/** A calendar date in Sri Lanka, `YYYY-MM-DD`. */
export type CalendarDate = string;

export interface ProductionPeriod {
  basis: ProductionBasis;
  /** First covered day, inclusive. */
  startsOn: CalendarDate;
  /** Last covered day, inclusive. */
  endsOn: CalendarDate;
  /** Required for SEASONAL (for example "Maha 2026/27"), otherwise null. */
  seasonLabel: string | null;
}

export interface BusinessOutput {
  id: string;
  businessId: string;
  product: EconomyProduct;
  /** Required for OTHER, otherwise null. */
  otherDescription: string | null;
  unit: ProductionUnit;
  kind: "GOOD" | "SERVICE" | null;
  archivedAt: IsoDateTime | null;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface SocietyBusiness {
  id: string;
  societyId: string;
  name: string;
  industry: EconomyIndustry;
  /** Required for the OTHER industry, otherwise null. */
  otherIndustry: string | null;
  description: string | null;
  status: BusinessStatus;
  /** When the business was last set to CLOSED; null while it is not closed. */
  closedAt: IsoDateTime | null;
  version: number;
  outputs: BusinessOutput[];
  createdBy: ActorReference;
  updatedBy: ActorReference | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ProductionRecord extends ProductionPeriod {
  id: string;
  outputId: string;
  measurement: ProductionMeasurement;
  /** Self-reported by the Society Officer. 0 is a reported zero. */
  quantity: number;
  unit: ProductionUnit;
  note: string | null;
  source: string | null;
  version: number;
  createdBy: ActorReference;
  updatedBy: ActorReference | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ProductionRecordRevision {
  version: number;
  change: "CREATED" | "CORRECTED";
  quantity: number;
  note: string | null;
  source: string | null;
  seasonLabel: string | null;
  changedBy: ActorReference;
  changedAt: IsoDateTime;
}

/** GET /societies/:id/economic-profile */
export interface SocietyEconomicProfile {
  society: { id: string; name: string; societyCode: string; districtId: string };
  /** The free-text business description from the society profile, unchanged. */
  businessDescription: string | null;
  businesses: SocietyBusiness[];
  /** Only the assigned Society Officer manages this module. */
  permissions: { canManage: boolean };
}

/** POST /societies/:id/businesses and PATCH /businesses/:id (with `version`). */
export interface SocietyBusinessInput {
  name: string;
  industry: EconomyIndustry;
  otherIndustry?: string | null;
  description?: string | null;
  status?: BusinessStatus;
  version?: number;
}

/** POST /businesses/:id/outputs. `unit` is only sent for OTHER. */
export interface BusinessOutputInput {
  product: EconomyProduct;
  otherDescription?: string | null;
  unit?: ProductionUnit;
}

/**
 * POST /business-outputs/:id/production-records. `clientRequestId` makes a
 * retried save return the record it already created instead of a second one.
 */
export interface ProductionRecordInput {
  clientRequestId?: string;
  basis: ProductionBasis;
  startsOn: CalendarDate;
  endsOn: CalendarDate;
  seasonLabel?: string | null;
  measurement: ProductionMeasurement;
  quantity: number;
  note?: string | null;
  source?: string | null;
}

/** PATCH /production-records/:id: a correction replaces the current figure. */
export interface ProductionRecordCorrection {
  version: number;
  quantity: number;
  seasonLabel?: string | null;
  note?: string | null;
  source?: string | null;
}

/**
 * GET /economic-profile/production: reported production for one exact
 * period and one measurement, over the caller's societies only.
 */
export interface ProductionSummary {
  period: ProductionPeriod;
  measurement: ProductionMeasurement;
  /** Totals are reported production, never a village's or district's capacity. */
  label: "REPORTED_PRODUCTION";
  products: ProductionSummaryRow[];
  /** Other outputs, one row each, never added together. */
  otherOutputs: OtherProductionRow[];
  /** The latest change to any record counted here. */
  lastUpdatedAt: IsoDateTime | null;
}

export interface ProductionSummaryRow {
  product: Exclude<EconomyProduct, "OTHER">;
  unit: ProductionUnit;
  /** Sum of the reported quantities; null when no society reported. */
  reportedQuantity: number | null;
  contributingBusinesses: number;
  coverage: ProductionCoverage;
}

/**
 * Societies are counted once, however many businesses they have.
 * `eligibleSocieties` are the societies in scope with this product registered
 * for the period (or a record for it); `missingSocieties` have not reported.
 */
export interface ProductionCoverage {
  eligibleSocieties: number;
  reportedSocieties: number;
  /** Reported, and every one of their reports for this period is 0. */
  zeroSocieties: number;
  missingSocieties: number;
}

export interface OtherProductionRow {
  outputId: string;
  description: string;
  unit: ProductionUnit;
  quantity: number;
  society: { id: string; name: string };
  businessName: string;
}

/** GET /economic-profile/production-records: mixed periods are listed, never totalled. */
export interface ProductionRecordListItem extends ProductionRecord {
  product: EconomyProduct;
  otherDescription: string | null;
  business: {
    id: string;
    name: string;
    industry: EconomyIndustry;
    otherIndustry: string | null;
  };
  society: { id: string; name: string };
}

/**
 * Query for both GET /economic-profile/production and (with `page` and
 * `pageSize`) GET /economic-profile/production-records. The same values give
 * the summary and exactly the records it counts. `districtId`, `societyId`
 * and `industry` only narrow the caller's own scope.
 */
export interface ProductionQuery {
  basis: ProductionBasis;
  startsOn: CalendarDate;
  endsOn: CalendarDate;
  measurement?: ProductionMeasurement;
  product?: EconomyProduct;
  industry?: EconomyIndustry;
  districtId?: string;
  societyId?: string;
}

/**
 * GET /economic-profile/scope (issue #147): who the figures cover and the
 * filter choices. `societies` are those in scope with at least one business
 * (within `districtId` when one is sent), at most 500.
 */
export interface EconomyFilterScope {
  kind: "NATIONAL" | "DISTRICT" | "ASSIGNED" | "ASSIGNED_AND_DISTRICT";
  /** Every society in scope, with or without businesses. */
  societyCount: number;
  /** A DDM's temporary district access ends then; otherwise null. */
  temporaryAccessEndsAt: IsoDateTime | null;
  districts: { id: string; name: string }[];
  /** Only when there is more than one district to choose from. */
  canChooseDistrict: boolean;
  societies: { id: string; name: string; districtId: string }[];
  societiesTruncated: boolean;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
