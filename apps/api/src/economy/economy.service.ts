import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Principal } from '../auth/principal.js';
import { canViewSociety } from '../societies/society-access.policy.js';
import {
  productDefinition,
  quantityError,
  outputUnit,
  type ProductionMeasurementValue,
} from './economy.catalogue.js';
import type {
  BusinessInputDto,
  BusinessUpdateDto,
  OutputInputDto,
  OutputUpdateDto,
  ProductionCorrectionDto,
  ProductionListQueryDto,
  ProductionRecordInputDto,
  ProductionSummaryQueryDto,
} from './economy.dto.js';
import {
  calendarDate,
  checkPeriod,
  parseCalendarDate,
  periodShape,
  sriLankaToday,
} from './economy.periods.js';
import {
  assertCanManageEconomy,
  canManageEconomy,
  economyScopeFor,
} from './economy.policy.js';
import {
  EconomyRepository,
  type BusinessFields,
  type BusinessRow,
  type RecordRow,
  type RevisionRow,
} from './economy.repository.js';

/** The most businesses one society can register. */
export const MAX_SOCIETY_BUSINESSES = 50;

type Output = BusinessRow['outputs'][number];

const iso = (date: Date | null) => (date ? date.toISOString() : null);
const toNumber = (value: { toString(): string }) => Number(value.toString());

function toOutput(output: Output) {
  return {
    id: output.id,
    businessId: output.businessId,
    product: output.product,
    otherDescription: output.otherDescription,
    unit: output.unit,
    kind: productDefinition(output.product)?.kind ?? null,
    archivedAt: iso(output.archivedAt),
    version: output.version,
    createdAt: output.createdAt.toISOString(),
    updatedAt: output.updatedAt.toISOString(),
  };
}

function toBusiness(business: BusinessRow) {
  return {
    id: business.id,
    societyId: business.societyId,
    name: business.name,
    industry: business.industry,
    otherIndustry: business.otherIndustry,
    description: business.description,
    status: business.status,
    closedAt: iso(business.closedAt),
    version: business.version,
    outputs: business.outputs.map(toOutput),
    createdBy: {
      displayName: business.createdByName,
      role: business.createdByRole ?? undefined,
    },
    updatedBy: business.updatedByName
      ? {
          displayName: business.updatedByName,
          role: business.updatedByRole ?? undefined,
        }
      : null,
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
}

export function toRecord(record: RecordRow) {
  return {
    id: record.id,
    outputId: record.outputId,
    basis: record.basis,
    startsOn: calendarDate(record.periodStart),
    endsOn: calendarDate(record.periodEnd),
    seasonLabel: record.seasonLabel,
    measurement: record.measurement,
    quantity: toNumber(record.quantity),
    unit: record.output.unit,
    note: record.note,
    source: record.source,
    version: record.version,
    createdBy: {
      displayName: record.createdByName,
      role: record.createdByRole ?? undefined,
    },
    updatedBy: record.updatedByName
      ? {
          displayName: record.updatedByName,
          role: record.updatedByRole ?? undefined,
        }
      : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toListItem(record: RecordRow) {
  const society = record.output.business.society;
  return {
    ...toRecord(record),
    product: record.output.product,
    otherDescription: record.output.otherDescription,
    business: {
      id: record.output.business.id,
      name: record.output.business.name,
    },
    society: { id: society.id, name: society.nameEn },
  };
}

function toRevision(revision: RevisionRow) {
  return {
    version: revision.version,
    change: revision.change,
    quantity: toNumber(revision.quantity),
    note: revision.note,
    source: revision.source,
    seasonLabel: revision.seasonLabel,
    changedBy: {
      displayName: revision.changedByName,
      role: revision.changedByRole ?? undefined,
    },
    changedAt: revision.changedAt.toISOString(),
  };
}

function page(query: { page?: number; pageSize?: number }) {
  return { page: query.page ?? 1, pageSize: query.pageSize ?? 25 };
}

/** The Sri Lanka day a timestamp falls on. */
const sriLankaDay = (at: Date) => calendarDate(sriLankaToday(at));

/**
 * Issue #145: the Village Economic Profile. Everything outside the caller's
 * societies is reported as not found, so ids from other districts reveal
 * nothing. Only the assigned Society Officer writes.
 */
@Injectable()
export class EconomyService {
  constructor(private readonly repository: EconomyRepository) {}

  private async visibleSociety(id: string, principal: Principal) {
    const society = await this.repository.findSociety(id);
    if (!society || !canViewSociety(principal, society))
      throw new NotFoundException('Society not found');
    return society;
  }

  private async visibleBusiness(id: string, principal: Principal) {
    const business = await this.repository.findBusiness(id);
    if (!business || !canViewSociety(principal, business.society))
      throw new NotFoundException('Business not found');
    return business;
  }

  private async visibleOutput(id: string, principal: Principal) {
    const output = await this.repository.findOutput(id);
    if (!output || !canViewSociety(principal, output.business.society))
      throw new NotFoundException('Output not found');
    return output;
  }

  private async visibleRecord(id: string, principal: Principal) {
    const record = await this.repository.findRecord(id);
    if (!record || !canViewSociety(principal, record.output.business.society))
      throw new NotFoundException('Production record not found');
    return record;
  }

  /** GET /societies/:id/economic-profile */
  async profile(societyId: string, principal: Principal) {
    const society = await this.visibleSociety(societyId, principal);
    const businesses = await this.repository.listBusinesses(society.id);
    return {
      society: {
        id: society.id,
        name: society.nameEn,
        societyCode: society.societyCode,
        districtId: society.districtId,
      },
      // Kept as typed on the society profile; never turned into businesses.
      businessDescription: society.businessDescription,
      businesses: businesses.map(toBusiness),
      permissions: { canManage: canManageEconomy(principal, society) },
    };
  }

  private businessFields(
    input: {
      name: string;
      industry: string;
      otherIndustry?: string | null;
      description?: string | null;
      status?: BusinessFields['status'];
    },
    current?: BusinessRow,
  ): BusinessFields {
    const otherIndustry =
      input.industry === 'OTHER' ? (input.otherIndustry ?? null) : null;
    if (input.industry === 'OTHER' && !otherIndustry)
      throw new BadRequestException(
        'Describe the industry when choosing Other',
      );
    const status = input.status ?? current?.status ?? 'OPERATING';
    return {
      name: input.name,
      industry: input.industry,
      otherIndustry,
      description: input.description ?? null,
      status,
      closedAt: status === 'CLOSED' ? (current?.closedAt ?? new Date()) : null,
    };
  }

  async createBusiness(
    societyId: string,
    input: BusinessInputDto,
    principal: Principal,
  ) {
    const society = await this.visibleSociety(societyId, principal);
    assertCanManageEconomy(principal, society);
    if (
      (await this.repository.countBusinesses(society.id)) >=
      MAX_SOCIETY_BUSINESSES
    )
      throw new BadRequestException(
        `A society can record at most ${MAX_SOCIETY_BUSINESSES} businesses`,
      );
    return toBusiness(
      await this.repository.createBusiness(
        society.id,
        this.businessFields(input),
        principal,
      ),
    );
  }

  /** Saving what is already saved changes nothing, so a retry is harmless. */
  async updateBusiness(
    businessId: string,
    input: BusinessUpdateDto,
    principal: Principal,
  ) {
    const business = await this.visibleBusiness(businessId, principal);
    assertCanManageEconomy(principal, business.society);
    const industry = input.industry ?? business.industry;
    const fields = this.businessFields(
      {
        name: input.name ?? business.name,
        industry,
        otherIndustry:
          input.otherIndustry !== undefined
            ? input.otherIndustry
            : business.otherIndustry,
        description:
          input.description !== undefined
            ? input.description
            : business.description,
        status: input.status,
      },
      business,
    );
    const unchanged =
      fields.name === business.name &&
      fields.industry === business.industry &&
      fields.otherIndustry === business.otherIndustry &&
      fields.description === business.description &&
      fields.status === business.status;
    if (unchanged) return toBusiness(business);
    return toBusiness(
      await this.repository.updateBusiness(
        business.id,
        input.version,
        fields,
        principal,
      ),
    );
  }

  async createOutput(
    businessId: string,
    input: OutputInputDto,
    principal: Principal,
  ) {
    const business = await this.visibleBusiness(businessId, principal);
    assertCanManageEconomy(principal, business.society);
    if (business.status === 'CLOSED')
      throw new BadRequestException(
        'This business is closed. Reopen it before adding products or services',
      );
    const otherDescription =
      input.product === 'OTHER' ? (input.otherDescription ?? null) : null;
    if (input.product === 'OTHER' && !otherDescription)
      throw new BadRequestException('Describe the output when choosing Other');
    const unit = outputUnit(input.product, input.unit);
    if ('error' in unit) throw new BadRequestException(unit.error);
    return toOutput(
      await this.repository.createOutput(
        business.id,
        { product: input.product, otherDescription, unit: unit.unit },
        principal,
      ),
    );
  }

  /** Archiving keeps every record; past totals do not change. */
  async updateOutput(
    outputId: string,
    input: OutputUpdateDto,
    principal: Principal,
  ) {
    const output = await this.visibleOutput(outputId, principal);
    assertCanManageEconomy(principal, output.business.society);
    if ((output.archivedAt !== null) === input.archived)
      return toOutput(output);
    return toOutput(
      await this.repository.updateOutput(
        output.id,
        input.version,
        input.archived ? new Date() : null,
      ),
    );
  }

  async outputRecords(
    outputId: string,
    query: { page?: number; pageSize?: number },
    principal: Principal,
  ) {
    const output = await this.visibleOutput(outputId, principal);
    const { page: current, pageSize } = page(query);
    const { rows, total } = await this.repository.listOutputRecords(
      output.id,
      current,
      pageSize,
    );
    return { items: rows.map(toRecord), page: current, pageSize, total };
  }

  /**
   * Saves a production figure. Returns `created: false` with the saved record
   * when the same save was already made (a retry), so nothing is counted twice.
   */
  async createRecord(
    outputId: string,
    input: ProductionRecordInputDto,
    principal: Principal,
  ) {
    const output = await this.visibleOutput(outputId, principal);
    assertCanManageEconomy(principal, output.business.society);
    const checked = checkPeriod(input, input.measurement);
    if ('error' in checked) throw new BadRequestException(checked.error);
    const { period } = checked;
    const error = quantityError(input.quantity, output.unit);
    if (error) throw new BadRequestException(error);

    // Late figures for days before an output was archived or its business
    // closed are still accepted; later periods are not.
    const startDay = calendarDate(period.start);
    if (output.archivedAt && startDay > sriLankaDay(output.archivedAt))
      throw new BadRequestException(
        'This output was archived before this period. Bring it back first',
      );
    if (
      output.business.closedAt &&
      startDay > sriLankaDay(output.business.closedAt)
    )
      throw new BadRequestException(
        'This business was closed before this period',
      );

    const { record, created } = await this.repository.createRecord(
      output.id,
      period,
      {
        clientRequestId: input.clientRequestId,
        measurement: input.measurement,
        quantity: input.quantity,
        note: input.note ?? null,
        source: input.source ?? null,
      },
      principal,
    );
    return { record: toRecord(record), created };
  }

  /** A correction replaces the current figure; the history keeps the old one. */
  async correctRecord(
    recordId: string,
    input: ProductionCorrectionDto,
    principal: Principal,
  ) {
    const record = await this.visibleRecord(recordId, principal);
    assertCanManageEconomy(principal, record.output.business.society);
    const error = quantityError(input.quantity, record.output.unit);
    if (error) throw new BadRequestException(error);
    const seasonLabel =
      input.seasonLabel !== undefined ? input.seasonLabel : record.seasonLabel;
    if (record.basis === 'SEASONAL' && !seasonLabel)
      throw new BadRequestException(
        'Name the season, for example Maha 2026/27',
      );
    if (record.basis !== 'SEASONAL' && seasonLabel)
      throw new BadRequestException('Only a seasonal period has a season name');
    const { record: saved, changed } = await this.repository.correctRecord(
      record.id,
      input.version,
      {
        quantity: input.quantity,
        seasonLabel,
        note: input.note !== undefined ? input.note : record.note,
        source: input.source !== undefined ? input.source : record.source,
      },
      principal,
    );
    return { record: toRecord(saved), changed };
  }

  async history(recordId: string, principal: Principal) {
    const record = await this.visibleRecord(recordId, principal);
    return {
      record: toRecord(record),
      revisions: (await this.repository.revisions(record.id)).map(toRevision),
    };
  }

  /** GET /economic-profile/production-records: a list, never a total. */
  async listRecords(query: ProductionListQueryDto, principal: Principal) {
    const from = query.from ? parseCalendarDate(query.from) : undefined;
    const to = query.to ? parseCalendarDate(query.to) : undefined;
    if (from === null || to === null)
      throw new BadRequestException('Enter dates as YYYY-MM-DD');
    if (from && to && to < from)
      throw new BadRequestException('The end date cannot be before the start');
    const { page: current, pageSize } = page(query);
    const { rows, total } = await this.repository.listRecords(
      economyScopeFor(principal),
      {
        product: query.product,
        districtId: query.districtId,
        societyId: query.societyId,
        measurement: query.measurement,
        from,
        to,
      },
      current,
      pageSize,
    );
    return { items: rows.map(toListItem), page: current, pageSize, total };
  }

  /** GET /economic-profile/production: totals for one exact period only. */
  async summary(query: ProductionSummaryQueryDto, principal: Principal) {
    const measurement: ProductionMeasurementValue =
      query.measurement ?? 'ACTUAL';
    // Any period can be asked about; only its shape is checked.
    const checked = periodShape(
      { basis: query.basis, startsOn: query.startsOn, endsOn: query.endsOn },
      { labelRequired: false },
    );
    if ('error' in checked) throw new BadRequestException(checked.error);
    const { period } = checked;
    const result = await this.repository.summary(
      economyScopeFor(principal),
      {
        product: query.product,
        districtId: query.districtId,
        societyId: query.societyId,
      },
      period,
      measurement,
    );
    return {
      period: {
        basis: period.basis,
        startsOn: calendarDate(period.start),
        endsOn: calendarDate(period.end),
        seasonLabel: null,
      },
      measurement,
      label: 'REPORTED_PRODUCTION' as const,
      products: result.rows.map((row) => ({
        product: row.product,
        unit: row.unit,
        reportedQuantity: row.reported === 0 ? null : Number(row.total ?? 0),
        contributingBusinesses: row.businesses,
        coverage: {
          eligibleSocieties: row.eligible,
          reportedSocieties: row.reported,
          zeroSocieties: row.zero,
          missingSocieties: row.eligible - row.reported,
        },
      })),
      otherOutputs: result.others.map((row) => ({
        outputId: row.outputId,
        description: row.description,
        unit: row.unit,
        quantity: Number(row.quantity),
        society: { id: row.societyId, name: row.societyName },
        businessName: row.businessName,
      })),
      lastUpdatedAt: iso(result.lastUpdatedAt),
    };
  }
}
