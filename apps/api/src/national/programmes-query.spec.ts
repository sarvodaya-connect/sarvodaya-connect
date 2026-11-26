import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ProgrammesQueryDto } from './directory.dto.js';
import { classificationFilters } from './national.service.js';

/** Issue #173: the Programmes classification filters in the query string. */
async function parse(query: Record<string, unknown>) {
  const dto = plainToInstance(ProgrammesQueryDto, query);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('Programmes classification filters', () => {
  it('reads a value given once, repeated or comma separated, each once', async () => {
    expect((await parse({ dimension: 'SOCIAL' })).dto.dimension).toEqual([
      'SOCIAL',
    ]);
    expect(
      (await parse({ dimension: ['GOVERNANCE', 'SOCIAL', 'SOCIAL'] })).dto
        .dimension,
    ).toEqual(['GOVERNANCE', 'SOCIAL']);
    expect(
      (await parse({ category: 'ECONOMY, CULTURE,,ECONOMY' })).dto.category,
    ).toEqual(['ECONOMY', 'CULTURE']);
    const none = await parse({ year: '2025', dimension: '' });
    expect(none.dto.dimension).toBeUndefined();
    expect(none.errors).toEqual([]);
  });

  it('refuses values that are not supported codes', async () => {
    expect((await parse({ dimension: 'social' })).errors).not.toEqual([]);
    expect((await parse({ category: 'Health' })).errors).not.toEqual([]);
    expect(
      (await parse({ category: ['ECONOMY', 'NOT_A_CATEGORY'] })).errors,
    ).not.toEqual([]);
  });

  it('answers with the filters in contract order', () => {
    expect(
      classificationFilters({
        dimension: ['GOVERNANCE', 'SOCIAL'],
        category: ['ENVIRONMENT', 'COMMUNITY_EDUCATION'],
      }),
    ).toEqual({
      dimensions: ['SOCIAL', 'GOVERNANCE'],
      categories: ['COMMUNITY_EDUCATION', 'ENVIRONMENT'],
    });
    expect(classificationFilters({})).toEqual({
      dimensions: [],
      categories: [],
    });
  });
});
