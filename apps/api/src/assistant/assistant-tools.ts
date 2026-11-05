import type Anthropic from '@anthropic-ai/sdk';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service.js';
import { financialYear, latestCompletedFinancialYear } from '../societies/financial-year.js';
import {
  type FiguresBySociety,
  type Metric,
  missingAnnualFigures,
  profitAboveThreshold,
  type SocietyRef,
  summarizeMetric,
  THRESHOLD_MODES,
  type ThresholdMode,
} from './assistant-calculations.js';
import type { AssistantDetails, AssistantScope, AssistantTable } from './assistant.types.js';
import { AssistantInsights } from './assistant-insights.js';

/**
 * The only ways SarvoAI can read data. Each tool is read-only; national queues
 * cover active societies, while profile/search can show other statuses. Tools
 * select named fields: never NICs, phone numbers, emails or passwords, and
 * of the yearly figures only total profit and total expenses.
 */

const EARLIEST_YEAR = 2000;
const MAX_YEARS = 10;
const MODEL_ROWS = 25;
const ANSWER_ROWS = 50;

/** What the model reads, plus the figures the answer shows (never retyped by the model). */
export interface ToolOutcome {
  content: string;
  isError?: boolean;
  answer?: { scope?: AssistantScope; table?: AssistantTable; details: AssistantDetails };
}

const yearProperty = { type: 'integer', description: 'Start year of the financial year: 2025 means FY 2025/26 (1 Apr 2025 to 31 Mar 2026).' };
const districtProperty = { type: 'string', description: 'District name, e.g. "Kurunegala". Leave empty for all districts.' };

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_society_overview',
    description: 'Brief one society: status, grade, Exco seat count (no names), four annual Registrar upload gaps, yearly profit/expenses, five recent approved activities, pending grade decisions and overdue unanswered requests. Find its exact S number first. Requires a completed financial year; ask which year if unclear. Includes record timestamps and source links; missing values are not zero.',
    input_schema: { type: 'object', properties: { societyCode: { type: 'string', description: 'Exact S number from find_societies' }, financialYear: yearProperty }, required: ['societyCode', 'financialYear'], additionalProperties: false },
  },
  {
    name: 'find_compliance_gaps',
    description: 'Active societies missing one or more of the four Registrar uploads for a completed financial year. Returns total counts and up to 20 societies, ordered by S number, with missing types and source links. Upload presence does not establish approval or legal compliance; do not call missing files overdue without a recorded deadline.',
    input_schema: { type: 'object', properties: { financialYear: yearProperty, district: districtProperty }, required: ['financialYear', 'district'], additionalProperties: false },
  },
  {
    name: 'list_outstanding_work',
    description: 'HQ follow-up queues for active societies: overdue unanswered society-request pairs, HQ grade decisions pending, activities awaiting their SPC (HQ follow-up only), and profiles older than 90 days. Returns exact queue counts, five oldest examples per queue and source links. Counts overlap; never add them as unique societies. This is a rule-based list, not an AI risk score.',
    input_schema: { type: 'object', properties: { district: districtProperty }, required: ['district'], additionalProperties: false },
  },
  {
    name: 'list_districts',
    description: 'List the district names. Use it to check a district name before other tools.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'find_societies',
    description: 'Find societies by English or Sinhala name, or by S number. Returns up to 10 matches with district and status. Use it before looking up one society; if several match, ask which one.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Name, part of a name, or S number' } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'get_exco_member',
    description: 'Who holds a position on a society\'s current Exco (council), e.g. President, Secretary, Treasurer. Returns names, positions and appointment dates only.',
    input_schema: {
      type: 'object',
      properties: { societyCode: { type: 'string', description: 'S number from find_societies' }, position: { type: 'string', description: 'Position to look for, e.g. "President"' } },
      required: ['societyCode', 'position'],
      additionalProperties: false,
    },
  },
  {
    name: 'summarize_yearly_figure',
    description: 'Average and total of total profit or total expenses for one financial year, across active societies in one district or all districts. Societies that have not added the figure are left out and counted.',
    input_schema: {
      type: 'object',
      properties: { financialYear: yearProperty, metric: { type: 'string', enum: ['profit', 'expenses'] }, district: districtProperty },
      required: ['financialYear', 'metric', 'district'],
      additionalProperties: false,
    },
  },
  {
    name: 'societies_above_profit',
    description: 'Active societies whose total profit was above an amount (LKR) over a range of financial years. mode "each" = above in every year; "any" = above in at least one year; "combined" = the years added together.',
    input_schema: {
      type: 'object',
      properties: {
        amountLkr: { type: 'number' },
        fromYear: yearProperty,
        toYear: yearProperty,
        mode: { type: 'string', enum: [...THRESHOLD_MODES] },
        district: districtProperty,
      },
      required: ['amountLkr', 'fromYear', 'toYear', 'mode', 'district'],
      additionalProperties: false,
    },
  },
  {
    name: 'societies_missing_yearly_figures',
    description: 'Active societies that have not added their total profit, total expenses, or both, for one financial year.',
    input_schema: {
      type: 'object',
      properties: { financialYear: yearProperty, district: districtProperty },
      required: ['financialYear', 'district'],
      additionalProperties: false,
    },
  },
];

class ToolInputError extends Error {}

const text = (input: Record<string, unknown>, key: string, max = 150) => {
  const value = input[key];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) throw new ToolInputError(`${key} must be text of at most ${max} characters`);
  return value.trim();
};

const lkr = (value: number) => `LKR ${value.toLocaleString('en-US')}`;

@Injectable()
export class AssistantTools {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly config?: ConfigService) {}

  private get fictionalOnly(): boolean {
    return this.config?.get<string>('SARVOAI_FICTIONAL_ONLY') === 'true';
  }

  private get societyScope() {
    return this.fictionalOnly
      ? { societyCode: { startsWith: 'TEST-' }, district: { code: 'TEST-ONLY' } }
      : {};
  }

  async run(name: string, input: unknown, now = new Date()): Promise<ToolOutcome> {
    const args = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    try {
      switch (name) {
        case 'list_districts':
          return await this.listDistricts();
        case 'find_societies':
          return await this.findSocieties(text(args, 'query'));
        case 'get_exco_member':
          if (this.fictionalOnly) return { content: 'Exco personal details are not available in the fictional pilot.', isError: true };
          return await this.excoMember(text(args, 'societyCode', 20), text(args, 'position', 100));
        case 'summarize_yearly_figure':
          return await this.summarize(this.year(args.financialYear, now), this.metric(args.metric), text(args, 'district'));
        case 'societies_above_profit':
          return await this.aboveProfit(args, now);
        case 'societies_missing_yearly_figures':
          return await this.missing(this.year(args.financialYear, now), text(args, 'district'));
        case 'get_society_overview': {
          const code = text(args, 'societyCode', 20);
          if (!code) throw new ToolInputError('societyCode is required; use find_societies first');
          return await new AssistantInsights(this.prisma, this.fictionalOnly).overview(code, this.year(args.financialYear, now), now);
        }
        case 'find_compliance_gaps': {
          const year = this.year(args.financialYear, now);
          const district = await this.districtFilter(text(args, 'district'));
          return await new AssistantInsights(this.prisma, this.fictionalOnly).compliance(year, now, district.districtId, district.label);
        }
        case 'list_outstanding_work': {
          const district = await this.districtFilter(text(args, 'district'));
          return await new AssistantInsights(this.prisma, this.fictionalOnly).outstanding(now, district.districtId, district.label);
        }
        default:
          return { content: `Unknown tool ${name}`, isError: true };
      }
    } catch (error) {
      if (error instanceof ToolInputError) return { content: error.message, isError: true };
      throw error;
    }
  }

  private year(value: unknown, now: Date) {
    const latest = latestCompletedFinancialYear(now);
    if (typeof value !== 'number' || !Number.isInteger(value) || value < EARLIEST_YEAR || value > latest)
      throw new ToolInputError(`financialYear must be a whole year from ${EARLIEST_YEAR} to ${latest} (the latest completed year, ${financialYear(latest).label})`);
    return value;
  }

  private metric(value: unknown): Metric {
    if (value !== 'profit' && value !== 'expenses') throw new ToolInputError('metric must be "profit" or "expenses"');
    return value;
  }

  private async listDistricts(): Promise<ToolOutcome> {
    const districts = await this.prisma.district.findMany({ where: this.fictionalOnly ? { code: 'TEST-ONLY' } : {}, select: { nameEn: true }, orderBy: { nameEn: 'asc' } });
    return { content: JSON.stringify({ districts: districts.map((district) => district.nameEn) }) };
  }

  /** Resolves a district name; unknown names are an input error that lists the real ones. */
  private async districtFilter(name: string) {
    if (!name) return { districtId: undefined, label: undefined };
    const district = await this.prisma.district.findFirst({ where: { nameEn: { equals: name, mode: 'insensitive' }, ...(this.fictionalOnly ? { code: 'TEST-ONLY' } : {}) }, select: { id: true, nameEn: true } });
    if (!district) {
      const names = await this.prisma.district.findMany({ where: this.fictionalOnly ? { code: 'TEST-ONLY' } : {}, select: { nameEn: true }, orderBy: { nameEn: 'asc' } });
      throw new ToolInputError(`No district called "${name}". Districts: ${names.map((row) => row.nameEn).join(', ')}`);
    }
    return { districtId: district.id, label: district.nameEn };
  }

  private async activeSocieties(districtId?: string): Promise<SocietyRef[]> {
    const rows = await this.prisma.society.findMany({
      where: { ...this.societyScope, status: 'ACTIVE', ...(districtId ? { districtId } : {}) },
      select: { id: true, societyCode: true, nameEn: true, district: { select: { nameEn: true } } },
      orderBy: { nameEn: 'asc' },
    });
    return rows.map((row) => ({ id: row.id, code: row.societyCode, name: row.nameEn, district: row.district.nameEn }));
  }

  private async figures(societies: SocietyRef[], years: number[]): Promise<FiguresBySociety> {
    const rows = await this.prisma.annualFinancialSummary.findMany({
      where: { societyId: { in: societies.map((society) => society.id) }, financialYear: { in: years } },
      select: { societyId: true, financialYear: true, totalProfit: true, totalExpenses: true },
    });
    const map: FiguresBySociety = new Map();
    for (const row of rows) {
      if (!map.has(row.societyId)) map.set(row.societyId, new Map());
      map.get(row.societyId)!.set(row.financialYear, {
        profit: row.totalProfit === null ? null : Number(row.totalProfit),
        expenses: row.totalExpenses === null ? null : Number(row.totalExpenses),
      });
    }
    return map;
  }

  private async findSocieties(query: string): Promise<ToolOutcome> {
    if (query.length < 2) throw new ToolInputError('query must be at least 2 characters');
    const rows = await this.prisma.society.findMany({
      where: {
        ...this.societyScope,
        OR: [
          { nameEn: { contains: query, mode: 'insensitive' } },
          { nameLocal: { contains: query, mode: 'insensitive' } },
          { societyCode: { equals: query, mode: 'insensitive' } },
        ],
      },
      select: { societyCode: true, nameEn: true, status: true, dsDivision: true, district: { select: { nameEn: true } } },
      orderBy: { nameEn: 'asc' },
      take: 10,
    });
    return {
      content: JSON.stringify({
        matches: rows.map((row) => ({ societyCode: row.societyCode, name: row.nameEn, district: row.district.nameEn, dsDivision: row.dsDivision, status: row.status })),
      }),
    };
  }

  private async excoMember(societyCode: string, position: string): Promise<ToolOutcome> {
    if (!societyCode || !position) throw new ToolInputError('societyCode and position are required');
    const society = await this.prisma.society.findUnique({
      where: { societyCode },
      select: { nameEn: true, societyCode: true, district: { select: { nameEn: true } } },
    });
    if (!society) throw new ToolInputError(`No society with S number ${societyCode}`);
    const members = await this.prisma.societyCouncilMember.findMany({
      where: { society: { societyCode }, isActive: true, endedOn: null, position: { contains: position, mode: 'insensitive' } },
      select: { fullName: true, position: true, appointedOn: true, updatedAt: true },
      orderBy: { seatNumber: 'asc' },
    });
    const appointed = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);
    return {
      content: JSON.stringify({
        society: { name: society.nameEn, societyCode: society.societyCode, district: society.district.nameEn },
        members: members.map((member) => ({ name: member.fullName, position: member.position, appointedOn: appointed(member.appointedOn) })),
      }),
      answer: {
        table: members.length
          ? { columns: ['Name', 'Position', 'Appointed'], rows: members.map((member) => [member.fullName, member.position, appointed(member.appointedOn)]), totalRows: members.length }
          : undefined,
        details: {
          recordsUsed: [`Exco list of ${society.nameEn} (${society.societyCode}), current members only`],
          calculation: members.length
            ? `Last changed ${members.reduce((latest, member) => (member.updatedAt > latest ? member.updatedAt : latest), members[0].updatedAt).toISOString().slice(0, 10)}`
            : `No current Exco member with a position matching "${position}"`,
        },
      },
    };
  }

  private async summarize(year: number, metric: Metric, districtName: string): Promise<ToolOutcome> {
    const district = await this.districtFilter(districtName);
    const societies = await this.activeSocieties(district.districtId);
    const result = summarizeMetric(societies, await this.figures(societies, [year]), year, metric);
    const label = financialYear(year).label;
    const figureName = metric === 'profit' ? 'total profit' : 'total expenses';
    return {
      content: JSON.stringify({
        financialYear: label,
        district: district.label ?? 'All districts',
        figure: figureName,
        currency: 'LKR',
        activeSocieties: societies.length,
        included: result.included.length,
        excludedNotAdded: result.excluded.length,
        averagePerSociety: result.average,
        total: result.total,
        highest: result.included[0] ? { name: result.included[0].society.name, value: result.included[0].value } : null,
        lowest: result.included.at(-1) ? { name: result.included.at(-1)!.society.name, value: result.included.at(-1)!.value } : null,
        rows: result.included.slice(0, MODEL_ROWS).map((row) => ({ name: row.society.name, district: row.society.district, value: row.value })),
      }),
      answer: {
        scope: {
          financialYears: [label],
          district: district.label,
          currency: 'LKR',
          societiesIncluded: result.included.length,
          societiesExcluded: result.excluded.length,
          excludedReason: `${figureName} not added`,
        },
        table: result.included.length
          ? {
              columns: ['Society', 'District', `${metric === 'profit' ? 'Total profit' : 'Total expenses'} ${label} (LKR)`],
              rows: result.included.slice(0, ANSWER_ROWS).map((row) => [row.society.name, row.society.district, row.value]),
              totalRows: result.included.length,
            }
          : undefined,
        details: {
          recordsUsed: [`Annual summary: ${figureName} for ${label}, active societies`],
          calculation:
            result.average === null
              ? `No society in scope has added its ${figureName} for ${label}`
              : `${lkr(result.total!)} combined ÷ ${result.included.length} societies = ${lkr(result.average)} per society (rounded to the rupee). ${result.excluded.length} left out, not counted as zero.`,
        },
      },
    };
  }

  private async aboveProfit(args: Record<string, unknown>, now: Date): Promise<ToolOutcome> {
    const amount = args.amountLkr;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 1e12) throw new ToolInputError('amountLkr must be a positive number of rupees');
    const fromYear = this.year(args.fromYear, now);
    const toYear = this.year(args.toYear, now);
    if (fromYear > toYear || toYear - fromYear + 1 > MAX_YEARS) throw new ToolInputError(`fromYear must not be after toYear, and the range must be at most ${MAX_YEARS} years`);
    const mode = args.mode as ThresholdMode;
    if (!THRESHOLD_MODES.includes(mode)) throw new ToolInputError(`mode must be one of ${THRESHOLD_MODES.join(', ')}`);
    const district = await this.districtFilter(text(args, 'district'));
    const societies = await this.activeSocieties(district.districtId);
    const years = Array.from({ length: toYear - fromYear + 1 }, (_, index) => fromYear + index);
    const result = profitAboveThreshold(societies, await this.figures(societies, years), years, amount, mode);
    const labels = years.map((year) => financialYear(year).label);
    const rule = { each: 'in each year', any: 'in at least one year', combined: 'with the years added together' }[mode];
    return {
      content: JSON.stringify({
        rule: `total profit above ${lkr(amount)} ${rule}`,
        financialYears: labels,
        district: district.label ?? 'All districts',
        activeSocieties: societies.length,
        checked: result.checked,
        excludedMissingYears: result.excluded.length,
        matchCount: result.matches.length,
        matches: result.matches.slice(0, MODEL_ROWS).map((row) => ({ name: row.society.name, district: row.society.district, profitByYear: row.values, combined: row.combined })),
      }),
      answer: {
        scope: {
          financialYears: labels,
          district: district.label,
          currency: 'LKR',
          societiesIncluded: result.checked,
          societiesExcluded: result.excluded.length,
          excludedReason: 'a year\'s total profit not added',
        },
        table: result.matches.length
          ? {
              columns: ['Society', 'District', ...labels.map((label) => `${label} (LKR)`)],
              rows: result.matches.slice(0, ANSWER_ROWS).map((row) => [row.society.name, row.society.district, ...row.values]),
              totalRows: result.matches.length,
            }
          : undefined,
        details: {
          recordsUsed: [`Annual summary: total profit for ${labels[0]} to ${labels.at(-1)}, active societies`],
          calculation: `Rule: total profit above ${lkr(amount)} ${rule}. ${result.checked} societies could be checked; ${result.excluded.length} left out because a year is missing.`,
        },
      },
    };
  }

  private async missing(year: number, districtName: string): Promise<ToolOutcome> {
    const district = await this.districtFilter(districtName);
    const societies = await this.activeSocieties(district.districtId);
    const rows = missingAnnualFigures(societies, await this.figures(societies, [year]), year);
    const label = financialYear(year).label;
    const missingText = { both: 'Profit and expenses', profit: 'Profit', expenses: 'Expenses' };
    const byDistrict = [...rows.reduce((counts, row) => counts.set(row.society.district, (counts.get(row.society.district) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    return {
      content: JSON.stringify({
        financialYear: label,
        district: district.label ?? 'All districts',
        activeSocieties: societies.length,
        missingCount: rows.length,
        byDistrict: Object.fromEntries(byDistrict),
        societies: rows.slice(0, MODEL_ROWS).map((row) => ({ name: row.society.name, district: row.society.district, missing: row.missing })),
      }),
      answer: {
        scope: { financialYears: [label], district: district.label, societiesIncluded: societies.length },
        table: rows.length
          ? {
              columns: ['Society', 'S number', 'District', 'Not added'],
              rows: rows.slice(0, ANSWER_ROWS).map((row) => [row.society.name, row.society.code, row.society.district, missingText[row.missing]]),
              totalRows: rows.length,
            }
          : undefined,
        details: {
          recordsUsed: [`Annual summary submission status for ${label}, active societies`],
          calculation: `${rows.length} of ${societies.length} active societies are missing total profit, total expenses, or both.`,
        },
      },
    };
  }
}
