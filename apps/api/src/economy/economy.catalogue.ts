/**
 * Issue #145: mirrors the catalogue in packages/api-contracts/src/economy.ts.
 * `economy.catalogue.spec.ts` fails if the two differ.
 */
export const ECONOMY_INDUSTRIES = [
  'AGRICULTURE',
  'LIVESTOCK_DAIRY',
  'FISHERIES',
  'FOOD_PROCESSING',
  'TEXTILES_GARMENTS',
  'HANDICRAFTS',
  'SERVICES',
  'OTHER',
] as const;
export type EconomyIndustry = (typeof ECONOMY_INDUSTRIES)[number];

export const BUSINESS_STATUSES = [
  'OPERATING',
  'SEASONAL',
  'TEMPORARILY_STOPPED',
  'CLOSED',
] as const;
export type BusinessStatusValue = (typeof BUSINESS_STATUSES)[number];

export const PRODUCTION_UNITS = [
  { code: 'LITRE', decimals: 2 },
  { code: 'KILOGRAM', decimals: 3 },
  { code: 'METRE', decimals: 2 },
  { code: 'ITEM', decimals: 0 },
  { code: 'NUT', decimals: 0 },
  { code: 'EGG', decimals: 0 },
  { code: 'PACKET', decimals: 0 },
  { code: 'JOB', decimals: 0 },
] as const;
export type ProductionUnit = (typeof PRODUCTION_UNITS)[number]['code'];
export const PRODUCTION_UNIT_CODES = PRODUCTION_UNITS.map((unit) => unit.code);

export const ECONOMY_PRODUCTS = [
  { code: 'MILK', industry: 'LIVESTOCK_DAIRY', kind: 'GOOD', unit: 'LITRE' },
  { code: 'CURD', industry: 'LIVESTOCK_DAIRY', kind: 'GOOD', unit: 'KILOGRAM' },
  { code: 'EGGS', industry: 'LIVESTOCK_DAIRY', kind: 'GOOD', unit: 'EGG' },
  { code: 'PADDY', industry: 'AGRICULTURE', kind: 'GOOD', unit: 'KILOGRAM' },
  {
    code: 'VEGETABLES',
    industry: 'AGRICULTURE',
    kind: 'GOOD',
    unit: 'KILOGRAM',
  },
  { code: 'FRUIT', industry: 'AGRICULTURE', kind: 'GOOD', unit: 'KILOGRAM' },
  { code: 'COCONUTS', industry: 'AGRICULTURE', kind: 'GOOD', unit: 'NUT' },
  { code: 'TEA_LEAF', industry: 'AGRICULTURE', kind: 'GOOD', unit: 'KILOGRAM' },
  { code: 'FISH', industry: 'FISHERIES', kind: 'GOOD', unit: 'KILOGRAM' },
  {
    code: 'DRIED_FISH',
    industry: 'FISHERIES',
    kind: 'GOOD',
    unit: 'KILOGRAM',
  },
  {
    code: 'RICE_FLOUR',
    industry: 'FOOD_PROCESSING',
    kind: 'GOOD',
    unit: 'KILOGRAM',
  },
  {
    code: 'SNACK_PACKETS',
    industry: 'FOOD_PROCESSING',
    kind: 'GOOD',
    unit: 'PACKET',
  },
  {
    code: 'GARMENTS',
    industry: 'TEXTILES_GARMENTS',
    kind: 'GOOD',
    unit: 'ITEM',
  },
  {
    code: 'HANDLOOM_FABRIC',
    industry: 'TEXTILES_GARMENTS',
    kind: 'GOOD',
    unit: 'METRE',
  },
  {
    code: 'HANDICRAFT_ITEMS',
    industry: 'HANDICRAFTS',
    kind: 'GOOD',
    unit: 'ITEM',
  },
  {
    code: 'TAILORING_JOBS',
    industry: 'SERVICES',
    kind: 'SERVICE',
    unit: 'JOB',
  },
  { code: 'REPAIR_JOBS', industry: 'SERVICES', kind: 'SERVICE', unit: 'JOB' },
  { code: 'OTHER', industry: null, kind: null, unit: null },
] as const;
export type EconomyProduct = (typeof ECONOMY_PRODUCTS)[number]['code'];
export const ECONOMY_PRODUCT_CODES = ECONOMY_PRODUCTS.map((p) => p.code);

export const PRODUCTION_BASES = ['WEEKLY', 'MONTHLY', 'SEASONAL'] as const;
export type ProductionBasisValue = (typeof PRODUCTION_BASES)[number];

export const PRODUCTION_MEASUREMENTS = ['ACTUAL', 'ESTIMATED'] as const;
export type ProductionMeasurementValue =
  (typeof PRODUCTION_MEASUREMENTS)[number];

export const MAX_PRODUCTION_QUANTITY = 100_000_000;
export const MAX_SEASON_DAYS = 366;

export function productDefinition(code: string) {
  return ECONOMY_PRODUCTS.find((product) => product.code === code);
}

export function unitDecimals(code: string): number | undefined {
  return PRODUCTION_UNITS.find((unit) => unit.code === code)?.decimals;
}

/**
 * The unit a new output must use: the product's own unit, or for OTHER the
 * one the officer chose. Returns an error message when it does not fit.
 */
export function outputUnit(
  product: string,
  requestedUnit: string | undefined,
): { unit: ProductionUnit } | { error: string } {
  const definition = productDefinition(product);
  if (!definition)
    return { error: 'Choose a product or service from the list' };
  if (definition.unit === null) {
    if (!requestedUnit) return { error: 'Choose the unit for this output' };
    if (unitDecimals(requestedUnit) === undefined)
      return { error: 'Choose a unit from the list' };
    return { unit: requestedUnit as ProductionUnit };
  }
  if (requestedUnit && requestedUnit !== definition.unit)
    return {
      error: `${product} is always recorded in ${definition.unit}`,
    };
  return { unit: definition.unit };
}

/**
 * Whether a quantity fits the unit: finite, 0 or more, within the limit, and
 * with no more decimal places than the unit allows (none for counts).
 */
export function quantityError(quantity: number, unit: string): string | null {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity))
    return 'Enter the quantity as a number';
  if (quantity < 0) return 'The quantity cannot be negative';
  if (quantity > MAX_PRODUCTION_QUANTITY)
    return `The quantity cannot be more than ${MAX_PRODUCTION_QUANTITY.toLocaleString('en-US')}`;
  const decimals = unitDecimals(unit);
  if (decimals === undefined) return 'This output has an unknown unit';
  const scaled = quantity * 10 ** decimals;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6)
    return decimals === 0
      ? `${unit} is counted in whole numbers`
      : `${unit} accepts at most ${decimals} decimal places`;
  return null;
}
