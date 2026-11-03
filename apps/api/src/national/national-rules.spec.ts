import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { recordFields } from './directory.service.js';
import {
  auditPastDue,
  districtLabel,
  monthIndex,
  percent,
} from './national-rules.js';
import { chosenYear, rankSdgs } from './national.service.js';
import { toCsv } from './reports.service.js';
import { sriLankaToday } from './requests.service.js';

describe('V5 PR 5 national rules', () => {
  const now = new Date('2026-11-03T04:00:00.000Z');

  it('ranks all 17 UN SDGs by completed activities, ties by SDG number', () => {
    const ranked = rankSdgs([
      { sdg: 16, completed: 410 },
      { sdg: 4, completed: 980 },
      { sdg: 6, completed: 410 },
    ]);
    expect(ranked).toHaveLength(17);
    expect(ranked.slice(0, 3)).toEqual([
      { sdg: 4, completed: 980 },
      { sdg: 6, completed: 410 },
      { sdg: 16, completed: 410 },
    ]);
    expect(ranked[3]).toEqual({ sdg: 1, completed: 0 });
  });

  it('uses the latest ended financial year and refuses years outside the last five', () => {
    expect(chosenYear(undefined, now)).toBe(2025);
    expect(chosenYear(2023, now)).toBe(2023);
    expect(() => chosenYear(2026, now)).toThrow(BadRequestException);
    expect(() => chosenYear(2015, now)).toThrow(BadRequestException);
  });

  it('marks the audit report past due after 30 September, Sri Lanka time', () => {
    expect(auditPastDue(2025, new Date('2026-09-30T18:00:00.000Z'))).toBe(
      false,
    );
    expect(auditPastDue(2025, new Date('2026-09-30T18:31:00.000Z'))).toBe(true);
    expect(auditPastDue(2026, now)).toBe(false);
  });

  it('counts months and dates in Sri Lanka time', () => {
    expect(monthIndex(new Date('2026-10-31T19:00:00.000Z'))).toBe(
      2026 * 12 + 11,
    );
    expect(sriLankaToday(new Date('2026-11-02T19:00:00.000Z'))).toBe(
      '2026-11-03',
    );
  });

  it('counts the eight fields of a complete record', () => {
    const empty = {
      establishedOn: null,
      addressLine: null,
      village: null,
      gnDivision: null,
      dsDivision: null,
      latitude: null,
      longitude: null,
    };
    expect(recordFields(empty)).toEqual({ present: 0, total: 8 });
    expect(
      recordFields({
        ...empty,
        dsDivision: 'Demo DS',
        latitude: 7,
        longitude: 80,
        contacts: [{ fullName: 'Fictional', phone: null }],
      }),
    ).toEqual({ present: 3, total: 8 });
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
  });

  it('names a district once', () => {
    expect(districtLabel('Kurunegala')).toBe('Kurunegala District');
    expect(districtLabel('Fictional North District')).toBe(
      'Fictional North District',
    );
  });

  it('writes CSV that Excel opens, quoting commas and quotes', () => {
    const csv = toCsv(
      [
        { key: 'district', label: 'District' },
        { key: 'active', label: 'Active', numeric: true },
      ],
      [
        { district: 'Kurunegala', active: 98 },
        { district: 'Say "hi", world', active: 1 },
      ],
    );
    expect(csv).toBe(
      '﻿District,Active\r\nKurunegala,98\r\n"Say ""hi"", world",1\r\n',
    );
  });
});
