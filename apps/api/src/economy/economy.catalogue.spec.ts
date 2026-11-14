import { describe, expect, it } from 'vitest';

import * as contracts from '../../../../packages/api-contracts/src/economy.js';
import * as api from './economy.catalogue.js';
import { outputUnit, quantityError } from './economy.catalogue.js';

describe('Village Economic Profile catalogue (issue #145)', () => {
  it('is the same list the clients use', () => {
    for (const name of [
      'ECONOMY_INDUSTRIES',
      'BUSINESS_STATUSES',
      'PRODUCTION_UNITS',
      'ECONOMY_PRODUCTS',
      'PRODUCTION_BASES',
      'PRODUCTION_MEASUREMENTS',
      'MAX_PRODUCTION_QUANTITY',
      'MAX_SEASON_DAYS',
    ] as const)
      expect(api[name], name).toEqual(contracts[name]);
  });

  it('gives every standard product one known unit, and services count jobs', () => {
    const units = api.PRODUCTION_UNITS.map((unit) => unit.code) as string[];
    for (const product of api.ECONOMY_PRODUCTS.filter(
      (p) => p.code !== 'OTHER',
    ))
      expect(units).toContain(product.unit);
    expect(api.productDefinition('TAILORING_JOBS')).toMatchObject({
      kind: 'SERVICE',
      unit: 'JOB',
    });
    expect(new Set(api.ECONOMY_PRODUCT_CODES).size).toBe(
      api.ECONOMY_PRODUCT_CODES.length,
    );
  });

  describe('outputUnit', () => {
    it('uses the product’s own unit and refuses another', () => {
      expect(outputUnit('MILK', undefined)).toEqual({ unit: 'LITRE' });
      expect(outputUnit('MILK', 'LITRE')).toEqual({ unit: 'LITRE' });
      expect(outputUnit('MILK', 'KILOGRAM')).toHaveProperty('error');
    });

    it('makes Other choose a known unit', () => {
      expect(outputUnit('OTHER', undefined)).toHaveProperty('error');
      expect(outputUnit('OTHER', 'BUCKET')).toHaveProperty('error');
      expect(outputUnit('OTHER', 'ITEM')).toEqual({ unit: 'ITEM' });
      expect(outputUnit('NOT_A_PRODUCT', undefined)).toHaveProperty('error');
    });
  });

  describe('quantityError', () => {
    it('accepts 0, whole counts and fractions of measured units', () => {
      expect(quantityError(0, 'NUT')).toBeNull();
      expect(quantityError(3200, 'LITRE')).toBeNull();
      expect(quantityError(12.75, 'LITRE')).toBeNull();
      expect(quantityError(0.125, 'KILOGRAM')).toBeNull();
      expect(quantityError(100_000_000, 'ITEM')).toBeNull();
    });

    it('refuses fractions of counts and too many decimals', () => {
      expect(quantityError(2.5, 'NUT')).toMatch(/whole numbers/);
      expect(quantityError(1.5, 'JOB')).toMatch(/whole numbers/);
      expect(quantityError(1.005, 'LITRE')).toMatch(/2 decimal places/);
    });

    it('refuses negative, too large and non-finite quantities', () => {
      expect(quantityError(-1, 'LITRE')).toMatch(/negative/);
      expect(quantityError(100_000_001, 'LITRE')).toMatch(/more than/);
      expect(quantityError(Number.NaN, 'LITRE')).toMatch(/number/);
      expect(quantityError(Number.POSITIVE_INFINITY, 'LITRE')).toMatch(
        /number/,
      );
    });
  });
});
