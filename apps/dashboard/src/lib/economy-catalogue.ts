import type {
  BusinessStatus,
  EconomyIndustry,
  EconomyProduct,
  ProductionBasis,
  ProductionMeasurement,
  ProductionUnit,
} from "@sarvodaya-connect/api-contracts";

/**
 * Issue #147: the Village Economic Profile catalogue from
 * packages/api-contracts/src/economy.ts. The dashboard imports only types from
 * the contracts at run time (like v5-constants.ts), so the codes are repeated
 * here; economy-catalogue.test.ts fails if the two lists ever differ.
 */
export const ECONOMY_INDUSTRIES: readonly EconomyIndustry[] = [
  "AGRICULTURE",
  "LIVESTOCK_DAIRY",
  "FISHERIES",
  "FOOD_PROCESSING",
  "TEXTILES_GARMENTS",
  "HANDICRAFTS",
  "SERVICES",
  "OTHER",
];

export const BUSINESS_STATUSES: readonly BusinessStatus[] = ["OPERATING", "SEASONAL", "TEMPORARILY_STOPPED", "CLOSED"];

export const PRODUCTION_UNITS: readonly { code: ProductionUnit; decimals: number }[] = [
  { code: "LITRE", decimals: 2 },
  { code: "KILOGRAM", decimals: 3 },
  { code: "METRE", decimals: 2 },
  { code: "ITEM", decimals: 0 },
  { code: "NUT", decimals: 0 },
  { code: "EGG", decimals: 0 },
  { code: "PACKET", decimals: 0 },
  { code: "JOB", decimals: 0 },
];

export const ECONOMY_PRODUCTS: readonly {
  code: EconomyProduct;
  industry: EconomyIndustry | null;
  kind: "GOOD" | "SERVICE" | null;
  unit: ProductionUnit | null;
}[] = [
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
];

export const PRODUCTION_BASES: readonly ProductionBasis[] = ["WEEKLY", "MONTHLY", "SEASONAL"];
export const PRODUCTION_MEASUREMENTS: readonly ProductionMeasurement[] = ["ACTUAL", "ESTIMATED"];
