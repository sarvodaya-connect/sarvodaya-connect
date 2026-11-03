import { Injectable, NotFoundException } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

import { REGISTRAR_DOCUMENT_TYPES } from '../documents/upload-rules.js';
import { YearQueryDto } from './directory.dto.js';
import { districtLabel, percent, period } from './national-rules.js';
import { NationalRepository } from './national.repository.js';
import { NationalService, chosenYear } from './national.service.js';

export const REPORT_TYPE_VALUES = [
  'national-summary',
  'society-status',
  'membership',
  'registrar-documents',
  'activities',
  'profit-expenses',
  'data-quality',
] as const;
export type ReportTypeValue = (typeof REPORT_TYPE_VALUES)[number];

export class ReportQueryDto extends YearQueryDto {
  @IsOptional()
  @IsUUID()
  districtId?: string;
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}

const TITLES: Record<ReportTypeValue, string> = {
  'national-summary': 'National summary for the Board',
  'society-status': 'Society status summary',
  membership: 'Membership report',
  'registrar-documents': 'Audit & Registrar documents',
  activities: 'Activities summary',
  'profit-expenses': 'Profit and expenses for the year',
  'data-quality': 'Data quality',
};

export const MEMBERSHIP_LABELS: Record<string, string> = {
  CHILDREN: 'Child members',
  YOUTH: 'Youth members',
  MOTHERS: 'Mothers',
  ORDINARY: 'Ordinary members',
  ELDERS_COUNCIL: 'Elders’ council',
};

const DOCUMENT_LABELS: Record<string, string> = {
  AUDIT_REPORT: 'Audit report',
  AGM_MINUTES: 'AGM minutes',
  OFFICE_BEARER_LIST: 'Office-bearer list',
  MEMBERS_LIST: 'Members list',
};

type Row = Record<string, string | number>;
type Column = { key: string; label: string; numeric?: boolean };

/** Writes a report as CSV that Excel opens directly (UTF-8 with a byte order mark). */
export function toCsv(columns: Column[], rows: Row[]) {
  const cell = (value: string | number | undefined) => {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return (
    '﻿' +
    [columns.map((column) => cell(column.label)).join(',')]
      .concat(
        rows.map((row) =>
          columns.map((column) => cell(row[column.key])).join(','),
        ),
      )
      .join('\r\n') +
    '\r\n'
  );
}

/**
 * V5 D15 standard reports (HQ only). Each report is a small table worked out
 * from approved records: per district (25 rows), per category or per sector.
 * The dashboard previews it, prints it to PDF and downloads it for Excel.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly repository: NationalRepository,
    private readonly national: NationalService,
  ) {}

  async report(type: ReportTypeValue, query: ReportQueryDto, now = new Date()) {
    const startYear = chosenYear(query.year, now);
    const districts = await this.repository.districts(startYear);
    const district = query.districtId
      ? districts.find((row) => row.id === query.districtId)
      : undefined;
    if (query.districtId && !district)
      throw new NotFoundException('District not found');
    const inScope = (id: string) => !district || id === district.id;
    const table = await this.build(
      type,
      startYear,
      districts.filter((row) => inScope(row.id)),
      inScope,
      now,
    );
    return {
      type,
      title: TITLES[type],
      scope: district ? districtLabel(district.name) : 'National',
      financialYear: period(startYear),
      columns: table.columns,
      rows: table.rows,
      generatedAt: now.toISOString(),
    };
  }

  private async build(
    type: ReportTypeValue,
    startYear: number,
    districts: Awaited<ReturnType<NationalRepository['districts']>>,
    inScope: (id: string) => boolean,
    now: Date,
  ): Promise<{ columns: Column[]; rows: Row[] }> {
    const name: Column = { key: 'district', label: 'District' };
    const active: Column = { key: 'active', label: 'Active', numeric: true };
    switch (type) {
      case 'society-status':
        return {
          columns: [
            name,
            active,
            { key: 'a', label: 'Class A', numeric: true },
            { key: 'b', label: 'Class B', numeric: true },
            { key: 'c', label: 'Class C', numeric: true },
            { key: 'complete', label: 'Records complete', numeric: true },
          ],
          rows: districts.map((row) => ({
            district: row.name,
            active: row.active,
            a: row.a,
            b: row.b,
            c: row.c,
            complete: `${percent(row.complete, row.active)}%`,
          })),
        };
      case 'membership': {
        const membership = await this.national.membership();
        const rows = membership.districts.filter((row) => inScope(row.id));
        return {
          columns: [
            name,
            { key: 'female', label: 'Female', numeric: true },
            { key: 'male', label: 'Male', numeric: true },
            { key: 'total', label: 'Total', numeric: true },
          ],
          rows: [
            ...rows.map((row) => ({
              district: row.name,
              female: row.female,
              male: row.male,
              total: row.total,
            })),
            ...membership.categories.map((row) => ({
              district: `All districts · ${MEMBERSHIP_LABELS[row.category] ?? row.category}`,
              female: row.female,
              male: row.male,
              total: row.total,
            })),
          ],
        };
      }
      case 'registrar-documents': {
        const counts = await this.repository.districtDocuments(startYear);
        const count = (id: string, documentType: string) =>
          counts.find((row) => row.id === id && row.type === documentType)
            ?.societies ?? 0;
        return {
          columns: [
            name,
            active,
            ...REGISTRAR_DOCUMENT_TYPES.map((documentType) => ({
              key: documentType,
              label: DOCUMENT_LABELS[documentType],
              numeric: true,
            })),
          ],
          rows: districts.map((row) => ({
            district: row.name,
            active: row.active,
            ...Object.fromEntries(
              REGISTRAR_DOCUMENT_TYPES.map((documentType) => [
                documentType,
                count(row.id, documentType),
              ]),
            ),
          })),
        };
      }
      case 'activities': {
        const programmes = await this.national.programmes(startYear, now);
        return {
          columns: [
            { key: 'sector', label: 'Sector' },
            { key: 'planned', label: 'Planned', numeric: true },
            { key: 'completed', label: 'Completed', numeric: true },
            { key: 'societies', label: 'Societies', numeric: true },
          ],
          rows: [
            ...programmes.sectors.map((row) => ({ ...row })),
            ...programmes.byDimension.map((row) => ({
              sector: `Dimension · ${row.dimension.charAt(0)}${row.dimension.slice(1).toLowerCase()}`,
              planned: row.planned,
              completed: row.completed,
              societies: '',
            })),
            ...programmes.sdgs
              .filter((row) => row.completed > 0)
              .map((row) => ({
                sector: `UN SDG ${row.sdg}`,
                planned: '',
                completed: row.completed,
                societies: '',
              })),
          ],
        };
      }
      case 'profit-expenses': {
        const finance = await this.repository.districtFinance(startYear);
        return {
          columns: [
            name,
            active,
            { key: 'both', label: 'Both figures added', numeric: true },
            { key: 'missing', label: 'Not added', numeric: true },
            { key: 'profit', label: 'Total profit (LKR)', numeric: true },
            { key: 'expenses', label: 'Total expenses (LKR)', numeric: true },
          ],
          rows: districts.map((row) => {
            const entry = finance.find((item) => item.id === row.id);
            const both = entry?.both ?? 0;
            return {
              district: row.name,
              active: row.active,
              both,
              missing: Math.max(0, row.active - both),
              profit: entry?.profit ?? '0',
              expenses: entry?.expenses ?? '0',
            };
          }),
        };
      }
      case 'data-quality': {
        const quality = await this.repository.districtDataQuality(now);
        return {
          columns: [
            name,
            active,
            { key: 'complete', label: 'Records complete', numeric: true },
            { key: 'stale', label: 'Not updated in 90+ days', numeric: true },
            { key: 'noLocation', label: 'No map position', numeric: true },
          ],
          rows: districts.map((row) => {
            const entry = quality.find((item) => item.id === row.id);
            return {
              district: row.name,
              active: row.active,
              complete: `${percent(row.complete, row.active)}%`,
              stale: entry?.stale ?? 0,
              noLocation: entry?.no_location ?? 0,
            };
          }),
        };
      }
      default: {
        const overview = await this.national.overview(startYear, now);
        const section = (
          label: string,
          figure: string,
          value: string | number,
        ) => ({ section: label, figure, value });
        const audit = overview.registrarDocuments.byType.find(
          (row) => row.documentType === 'AUDIT_REPORT',
        );
        return {
          columns: [
            { key: 'section', label: 'Section' },
            { key: 'figure', label: 'Figure' },
            { key: 'value', label: 'Value', numeric: true },
          ],
          rows: [
            section(
              '1 · Society status',
              'Registered societies',
              overview.societies.registered,
            ),
            section(
              '1 · Society status',
              'Active societies',
              overview.societies.active,
            ),
            section(
              '1 · Society status',
              'Grade A · B · C',
              `${overview.societies.grades.A} · ${overview.societies.grades.B} · ${overview.societies.grades.C}`,
            ),
            section(
              '2 · Members',
              'Female · male',
              `${overview.membership.female} · ${overview.membership.male}`,
            ),
            section('2 · Members', 'Total members', overview.membership.total),
            section('3 · Audit reports', 'Uploaded', audit?.submitted ?? 0),
            section(
              '4 · Registrar documents',
              'All four documents',
              overview.registrarDocuments.allFour,
            ),
            section(
              '5 · Profit and expenses',
              'Total profit (LKR)',
              overview.finance.totalProfit,
            ),
            section(
              '5 · Profit and expenses',
              'Total expenses (LKR)',
              overview.finance.totalExpenses,
            ),
            section(
              '6 · Activities',
              'Completed of planned',
              `${overview.activities.completed} of ${overview.activities.planned}`,
            ),
            section(
              'Disaster & emergency',
              'Open incidents',
              overview.incidents.length,
            ),
          ],
        };
      }
    }
  }
}
