import 'reflect-metadata';
import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_CATEGORY_VALUES,
  ACTIVITY_DIMENSION_VALUES,
} from './activities.dto.js';

/**
 * Issue #169: the API validates and stores exactly the codes the clients
 * use, in the same order.
 */
describe('Development Goals catalogue (issue #169)', () => {
  it('is the same list the clients use', async () => {
    // Loaded by path so the API's compile stays inside apps/api.
    const source = new URL(
      '../../../../packages/api-contracts/src/activities.ts',
      import.meta.url,
    ).href;
    const contracts = (await import(source)) as {
      ACTIVITY_DIMENSIONS: readonly string[];
      ACTIVITY_CATEGORIES: readonly { code: string; title: string }[];
      ACTIVITY_CATEGORY_CODES: readonly string[];
    };
    expect([...ACTIVITY_DIMENSION_VALUES]).toEqual([
      ...contracts.ACTIVITY_DIMENSIONS,
    ]);
    expect([...ACTIVITY_CATEGORY_VALUES]).toEqual(
      contracts.ACTIVITY_CATEGORIES.map((category) => category.code),
    );
    expect([...contracts.ACTIVITY_CATEGORY_CODES]).toEqual([
      ...ACTIVITY_CATEGORY_VALUES,
    ]);
  });

  it('has the ten categories in the confirmed order, each once', async () => {
    const source = new URL(
      '../../../../packages/api-contracts/src/activities.ts',
      import.meta.url,
    ).href;
    const { ACTIVITY_CATEGORIES } = (await import(source)) as {
      ACTIVITY_CATEGORIES: readonly { code: string; title: string }[];
    };
    expect(ACTIVITY_CATEGORIES.map((category) => category.title)).toEqual([
      'Community education',
      'Child wellbeing',
      'Culture',
      'Economy',
      'Governance',
      'Health and nutrition',
      'Housing and infrastructure',
      'Spiritual development',
      'Agriculture',
      'Environment',
    ]);
    expect(new Set(ACTIVITY_CATEGORY_VALUES).size).toBe(10);
  });

  it('matches the database enum', async () => {
    const { readFile } = await import('node:fs/promises');
    const schema = await readFile(
      new URL('../../prisma/schema.prisma', import.meta.url),
      'utf8',
    );
    const block = /enum ActivityCategory \{([^}]*)\}/.exec(schema)?.[1] ?? '';
    const values = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[A-Z_]+$/.test(line));
    expect(values).toEqual([...ACTIVITY_CATEGORY_VALUES]);
  });
});
