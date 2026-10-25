import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertChangesSupported,
  resolveRegistryChange,
  resolveRegistryChanges,
} from './registry-fields.js';

describe('registry field allowlist', () => {
  it('maps profile, council and membership paths to registry targets', () => {
    expect(resolveRegistryChange('PROFILE_UPDATE', 'profile.village', 'New').target).toEqual({
      kind: 'profile',
      column: 'village',
    });
    expect(
      resolveRegistryChange('COUNCIL_UPDATE', 'council.7.endedOn', '2026-01-31').target,
    ).toEqual({ kind: 'council', seatNumber: 7, column: 'endedOn' });
    expect(
      resolveRegistryChange('MEMBERSHIP_COUNTS', 'membership.2026.ELDERS_COUNCIL.male', 4).target,
    ).toEqual({ kind: 'membership', year: 2026, category: 'ELDERS_COUNCIL', gender: 'male' });
  });

  const unsupported: [string, string, unknown][] = [
    ['PROFILE_UPDATE', 'profile.status', 'ACTIVE'],
    ['PROFILE_UPDATE', 'profile.districtId', 'x'],
    ['PROFILE_UPDATE', 'profile.societyCode', 'DEMO-X'],
    ['PROFILE_UPDATE', 'profile.id', 'x'],
    ['PROFILE_UPDATE', 'profile.primaryContact.phone', '0110000000'],
    ['PROFILE_UPDATE', 'village', 'x'],
    ['PROFILE_UPDATE', 'council.1.fullName', 'Name Here'],
    ['COUNCIL_UPDATE', 'council.1.age', 30],
    ['COUNCIL_UPDATE', 'council.1.phone', '0110000000'],
    ['COUNCIL_UPDATE', 'council.1.email', 'a@example.test'],
    ['COUNCIL_UPDATE', 'council.1.seatType', 'YOUTH'],
    ['COUNCIL_UPDATE', 'council.1.seatNumber', 2],
    ['COUNCIL_UPDATE', 'council.1.isActive', false],
    ['COUNCIL_UPDATE', 'council.1.isPrimaryContact', true],
    ['COUNCIL_UPDATE', 'council.0.fullName', 'Name Here'],
    ['COUNCIL_UPDATE', 'council.26.fullName', 'Name Here'],
    ['MEMBERSHIP_COUNTS', 'membership.2026.TEENS.female', 5],
    ['MEMBERSHIP_COUNTS', 'membership.2026.CHILDREN.total', 5],
    ['MEMBERSHIP_COUNTS', 'membership.1800.CHILDREN.female', 5],
  ];
  it.each(unsupported)('rejects %s field %s', (type, field, value) => {
    expect(() =>
      resolveRegistryChange(type as 'PROFILE_UPDATE', field, value),
    ).toThrow(BadRequestException);
  });

  const badValues: [string, string, unknown][] = [
    ['PROFILE_UPDATE', 'profile.latitude', '7.1'],
    ['PROFILE_UPDATE', 'profile.latitude', 95],
    ['PROFILE_UPDATE', 'profile.establishedOn', '2026-02-30'],
    ['PROFILE_UPDATE', 'profile.village', ''],
    ['COUNCIL_UPDATE', 'council.2.appointedOn', '10/01/2026'],
    ['MEMBERSHIP_COUNTS', 'membership.2026.CHILDREN.female', -1],
    ['MEMBERSHIP_COUNTS', 'membership.2026.CHILDREN.female', 1.5],
    ['MEMBERSHIP_COUNTS', 'membership.2026.CHILDREN.female', '5'],
  ];
  it.each(badValues)('rejects invalid value for %s %s', (type, field, value) => {
    expect(() =>
      resolveRegistryChange(type as 'PROFILE_UPDATE', field, value),
    ).toThrow(BadRequestException);
  });

  it('uses the corrected value over the proposed one', () => {
    const [change] = resolveRegistryChanges('PROFILE_UPDATE', [
      { field: 'profile.village', previousValue: 'Old', proposedValue: 'Proposed', correctedValue: 'Corrected' },
    ]);
    expect(change?.value).toBe('Corrected');
    expect(change?.previousValue).toBe('Old');
  });

  it('treats activity reports and payments as record-only', () => {
    for (const type of ['ACTIVITY_REPORT', 'PAYMENT'] as const) {
      expect(() =>
        assertChangesSupported(type, [{ field: 'anything.goes', proposedValue: 1 }]),
      ).not.toThrow();
      expect(
        resolveRegistryChanges(type, [
          { field: 'anything.goes', previousValue: null, proposedValue: 1, correctedValue: null },
        ]),
      ).toEqual([]);
    }
  });
});
