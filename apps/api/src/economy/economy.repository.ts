import { ConflictException, Injectable } from '@nestjs/common';

import type { Principal } from '../auth/principal.js';
import { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  BusinessStatusValue,
  ProductionMeasurementValue,
} from './economy.catalogue.js';
import { calendarDate, type Period } from './economy.periods.js';
import type { EconomyScope } from './economy.policy.js';

/** A society has a few businesses; these bound every list regardless. */
const MAX_BUSINESSES = 100;
const MAX_OTHER_ROWS = 200;
/** Society filter choices; past this, choose a district first. */
export const MAX_SCOPE_SOCIETIES = 500;

const SOCIETY_SELECT = {
  id: true,
  nameEn: true,
  societyCode: true,
  districtId: true,
} as const;

const OUTPUT_WITH_SOCIETY = {
  business: {
    select: {
      id: true,
      name: true,
      industry: true,
      otherIndustry: true,
      status: true,
      closedAt: true,
      society: { select: SOCIETY_SELECT },
    },
  },
} as const;

const RECORD_WITH_SOCIETY = {
  output: { include: OUTPUT_WITH_SOCIETY },
} as const;

export type BusinessRow = Prisma.SocietyBusinessGetPayload<{
  include: { outputs: true };
}>;
export type OutputRow = Prisma.BusinessOutputGetPayload<{
  include: typeof OUTPUT_WITH_SOCIETY;
}>;
export type RecordRow = Prisma.ProductionRecordGetPayload<{
  include: typeof RECORD_WITH_SOCIETY;
}>;
export type RevisionRow = Prisma.ProductionRecordRevisionGetPayload<object>;

export interface BusinessFields {
  name: string;
  industry: string;
  otherIndustry: string | null;
  description: string | null;
  status: BusinessStatusValue;
  closedAt: Date | null;
}

export interface RecordFields {
  clientRequestId?: string;
  measurement: ProductionMeasurementValue;
  quantity: number;
  note: string | null;
  source: string | null;
}

export interface CorrectionFields {
  quantity: number;
  seasonLabel: string | null;
  note: string | null;
  source: string | null;
}

export interface SummaryFilters {
  product?: string;
  /** The business's industry. */
  industry?: string;
  districtId?: string;
  societyId?: string;
}

export interface SummaryRow {
  product: string;
  unit: string;
  eligible: number;
  reported: number;
  zero: number;
  total: string | null;
  businesses: number;
}

export interface OtherRow {
  outputId: string;
  description: string;
  unit: string;
  quantity: string;
  societyId: string;
  societyName: string;
  businessName: string;
}

const actor = (principal: Principal) => ({
  name: principal.displayName,
  role: principal.roles[0] ?? null,
});

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

function staleConflict(): ConflictException {
  return new ConflictException(
    'Someone else changed this since you opened it. Reload to see the latest figures, then try again',
  );
}

/** Same quantity, compared at the stored precision. */
export function sameQuantity(stored: Prisma.Decimal, quantity: number) {
  return stored.equals(new Prisma.Decimal(quantity.toFixed(3)));
}

/** Prisma filter for societies in the caller's scope, narrowed by the filters. */
function societyWhere(
  scope: EconomyScope,
  filters: { districtId?: string; societyId?: string },
): Prisma.SocietyWhereInput {
  const and: Prisma.SocietyWhereInput[] = [];
  if (!scope.national)
    and.push({
      OR: [
        { districtId: { in: scope.districtIds } },
        { id: { in: scope.societyIds } },
      ],
    });
  if (filters.districtId) and.push({ districtId: filters.districtId });
  if (filters.societyId) and.push({ id: filters.societyId });
  return { AND: and };
}

/** SQL for the same scope. `s` is the societies alias. */
function societySql(
  scope: EconomyScope,
  filters: { districtId?: string; societyId?: string },
) {
  const parts: Prisma.Sql[] = [];
  if (!scope.national) {
    const any: Prisma.Sql[] = [];
    if (scope.districtIds.length)
      any.push(Prisma.sql`s.district_id = ANY(${scope.districtIds}::uuid[])`);
    if (scope.societyIds.length)
      any.push(Prisma.sql`s.id = ANY(${scope.societyIds}::uuid[])`);
    parts.push(
      any.length
        ? Prisma.sql`(${Prisma.join(any, ' OR ')})`
        : Prisma.sql`FALSE`,
    );
  }
  if (filters.districtId)
    parts.push(Prisma.sql`s.district_id = ${filters.districtId}::uuid`);
  if (filters.societyId)
    parts.push(Prisma.sql`s.id = ${filters.societyId}::uuid`);
  return parts.length ? Prisma.join(parts, ' AND ') : Prisma.sql`TRUE`;
}

/** Issue #145: storage for the Village Economic Profile. */
@Injectable()
export class EconomyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSociety(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.society.findUnique({
        where: { id },
        select: { ...SOCIETY_SELECT, businessDescription: true },
      }),
    );
  }

  listBusinesses(societyId: string) {
    return executeDatabaseOperation(() =>
      this.prisma.societyBusiness.findMany({
        where: { societyId },
        include: {
          outputs: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: MAX_BUSINESSES,
      }),
    );
  }

  findBusiness(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.societyBusiness.findUnique({
        where: { id },
        include: {
          outputs: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
          society: { select: SOCIETY_SELECT },
        },
      }),
    );
  }

  countBusinesses(societyId: string) {
    return executeDatabaseOperation(() =>
      this.prisma.societyBusiness.count({ where: { societyId } }),
    );
  }

  createBusiness(
    societyId: string,
    fields: BusinessFields,
    principal: Principal,
  ): Promise<BusinessRow> {
    const by = actor(principal);
    return executeDatabaseOperation(() =>
      this.prisma.societyBusiness.create({
        data: {
          societyId,
          ...fields,
          createdById: principal.id,
          createdByName: by.name,
          createdByRole: by.role,
        },
        include: { outputs: true },
      }),
    );
  }

  /** Applies the change only if nobody saved a newer version first. */
  async updateBusiness(
    id: string,
    version: number,
    fields: BusinessFields,
    principal: Principal,
  ): Promise<BusinessRow> {
    const by = actor(principal);
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const { count } = await tx.societyBusiness.updateMany({
          where: { id, version },
          data: {
            ...fields,
            version: { increment: 1 },
            updatedByName: by.name,
            updatedByRole: by.role,
          },
        });
        if (count === 0) throw staleConflict();
        return tx.societyBusiness.findUniqueOrThrow({
          where: { id },
          include: { outputs: true },
        });
      }),
    );
  }

  findOutput(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.businessOutput.findUnique({
        where: { id },
        include: OUTPUT_WITH_SOCIETY,
      }),
    );
  }

  async createOutput(
    businessId: string,
    fields: { product: string; otherDescription: string | null; unit: string },
    principal: Principal,
  ) {
    const by = actor(principal);
    try {
      return await this.prisma.businessOutput.create({
        data: {
          businessId,
          ...fields,
          createdById: principal.id,
          createdByName: by.name,
          createdByRole: by.role,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          'This business already records this product. Use the existing one',
        );
      return executeDatabaseOperation(() => Promise.reject(error));
    }
  }

  async updateOutput(id: string, version: number, archivedAt: Date | null) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.businessOutput.updateMany({
          where: { id, version },
          data: { archivedAt, version: { increment: 1 } },
        });
        if (count === 0) throw staleConflict();
        return tx.businessOutput.findUniqueOrThrow({ where: { id } });
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          'This business already records this product. Archive that one first',
        );
      return executeDatabaseOperation(() => Promise.reject(error));
    }
  }

  findRecord(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.productionRecord.findUnique({
        where: { id },
        include: RECORD_WITH_SOCIETY,
      }),
    );
  }

  listOutputRecords(outputId: string, page: number, pageSize: number) {
    return executeDatabaseOperation(async () => {
      const where = { outputId };
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.productionRecord.findMany({
          where,
          include: RECORD_WITH_SOCIETY,
          orderBy: [
            { periodStart: 'desc' },
            { measurement: 'asc' },
            { id: 'asc' },
          ],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.productionRecord.count({ where }),
      ]);
      return { rows, total };
    });
  }

  /**
   * Saves a new record, or returns the one a retry already saved
   * (`created: false`). The output row is locked so two saves for the same
   * output are checked one after the other: periods of one output and
   * measurement never overlap, so nothing is counted twice.
   */
  async createRecord(
    outputId: string,
    period: Period,
    fields: RecordFields,
    principal: Principal,
  ): Promise<{ record: RecordRow; created: boolean }> {
    const by = actor(principal);
    const sameIdentity = (row: {
      outputId: string;
      measurement: string;
      basis: string;
      periodStart: Date;
      periodEnd: Date;
    }) =>
      row.outputId === outputId &&
      row.measurement === fields.measurement &&
      row.basis === period.basis &&
      calendarDate(row.periodStart) === calendarDate(period.start) &&
      calendarDate(row.periodEnd) === calendarDate(period.end);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM business_outputs WHERE id = ${outputId}::uuid FOR UPDATE`;

        if (fields.clientRequestId) {
          const earlier = await tx.productionRecord.findUnique({
            where: { clientRequestId: fields.clientRequestId },
            include: RECORD_WITH_SOCIETY,
          });
          if (earlier) {
            if (sameIdentity(earlier))
              return { record: earlier, created: false };
            throw new ConflictException(
              'This request id was already used for a different record',
            );
          }
        }

        const overlapping = await tx.productionRecord.findFirst({
          where: {
            outputId,
            measurement: fields.measurement,
            periodStart: { lte: period.end },
            periodEnd: { gte: period.start },
          },
          include: RECORD_WITH_SOCIETY,
          orderBy: { periodStart: 'asc' },
        });
        if (overlapping) {
          // The same figure saved again (a retry without a request id) adds nothing.
          if (
            sameIdentity(overlapping) &&
            sameQuantity(overlapping.quantity, fields.quantity)
          )
            return { record: overlapping, created: false };
          throw new ConflictException(
            sameIdentity(overlapping)
              ? `This period already has a ${fields.measurement.toLowerCase()} figure (record ${overlapping.id}). Correct that record instead`
              : `This period overlaps the ${fields.measurement.toLowerCase()} figure for ${calendarDate(overlapping.periodStart)} to ${calendarDate(overlapping.periodEnd)} (record ${overlapping.id}). Periods of one output cannot overlap`,
          );
        }

        const record = await tx.productionRecord.create({
          data: {
            outputId,
            basis: period.basis,
            periodStart: period.start,
            periodEnd: period.end,
            seasonLabel: period.seasonLabel,
            measurement: fields.measurement,
            quantity: fields.quantity.toFixed(3),
            note: fields.note,
            source: fields.source,
            clientRequestId: fields.clientRequestId ?? null,
            createdById: principal.id,
            createdByName: by.name,
            createdByRole: by.role,
          },
          include: RECORD_WITH_SOCIETY,
        });
        await tx.productionRecordRevision.create({
          data: {
            recordId: record.id,
            version: 1,
            change: 'CREATED',
            quantity: record.quantity,
            seasonLabel: record.seasonLabel,
            note: record.note,
            source: record.source,
            changedById: principal.id,
            changedByName: by.name,
            changedByRole: by.role,
          },
        });
        return { record, created: true };
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          'This request id was already used for a different record',
        );
      return executeDatabaseOperation(() => Promise.reject(error));
    }
  }

  /**
   * A correction replaces the current figure and keeps the old one in the
   * history. Saving the figures that are already there changes nothing, so a
   * retried correction is harmless; a correction made from an older version
   * than the saved one is refused.
   */
  async correctRecord(
    id: string,
    version: number,
    fields: CorrectionFields,
    principal: Principal,
  ): Promise<{ record: RecordRow; changed: boolean }> {
    const by = actor(principal);
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM production_records WHERE id = ${id}::uuid FOR UPDATE`;
        const current = await tx.productionRecord.findUniqueOrThrow({
          where: { id },
          include: RECORD_WITH_SOCIETY,
        });
        if (
          sameQuantity(current.quantity, fields.quantity) &&
          current.seasonLabel === fields.seasonLabel &&
          current.note === fields.note &&
          current.source === fields.source
        )
          return { record: current, changed: false };
        if (current.version !== version) throw staleConflict();

        const record = await tx.productionRecord.update({
          where: { id },
          data: {
            quantity: fields.quantity.toFixed(3),
            seasonLabel: fields.seasonLabel,
            note: fields.note,
            source: fields.source,
            version: { increment: 1 },
            updatedByName: by.name,
            updatedByRole: by.role,
          },
          include: RECORD_WITH_SOCIETY,
        });
        await tx.productionRecordRevision.create({
          data: {
            recordId: id,
            version: record.version,
            change: 'CORRECTED',
            quantity: record.quantity,
            seasonLabel: record.seasonLabel,
            note: record.note,
            source: record.source,
            changedById: principal.id,
            changedByName: by.name,
            changedByRole: by.role,
          },
        });
        return { record, changed: true };
      }),
    );
  }

  revisions(recordId: string): Promise<RevisionRow[]> {
    return executeDatabaseOperation(() =>
      this.prisma.productionRecordRevision.findMany({
        where: { recordId },
        orderBy: { version: 'desc' },
      }),
    );
  }

  /** Records across the caller's societies, newest period first. Never totalled. */
  listRecords(
    scope: EconomyScope,
    filters: SummaryFilters & {
      from?: Date;
      to?: Date;
      /** Only records for exactly this period (issue #147). */
      exact?: Period;
      measurement?: ProductionMeasurementValue;
    },
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.ProductionRecordWhereInput = {
      ...(filters.measurement ? { measurement: filters.measurement } : {}),
      ...(filters.from ? { periodEnd: { gte: filters.from } } : {}),
      ...(filters.to ? { periodStart: { lte: filters.to } } : {}),
      ...(filters.exact
        ? {
            basis: filters.exact.basis,
            periodStart: filters.exact.start,
            periodEnd: filters.exact.end,
          }
        : {}),
      output: {
        ...(filters.product ? { product: filters.product } : {}),
        business: {
          ...(filters.industry ? { industry: filters.industry } : {}),
          society: societyWhere(scope, filters),
        },
      },
    };
    return executeDatabaseOperation(async () => {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.productionRecord.findMany({
          where,
          include: RECORD_WITH_SOCIETY,
          orderBy: [{ periodStart: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.productionRecord.count({ where }),
      ]);
      return { rows, total };
    });
  }

  /**
   * Reported production for one exact period and measurement, per standard
   * product, over the caller's societies.
   *
   * A society is eligible for a product when it is active and has a current
   * output of that product for the period (registered by the period's last
   * day, not archived and its business not closed before the first day), or
   * when it reported one anyway. Each society counts once, however many
   * businesses it has. Only records for exactly this period count: other
   * periods, other measurements and Other outputs are never added in.
   */
  async summary(
    scope: EconomyScope,
    filters: SummaryFilters,
    period: Period,
    measurement: ProductionMeasurementValue,
  ): Promise<{
    rows: SummaryRow[];
    others: OtherRow[];
    lastUpdatedAt: Date | null;
  }> {
    const inScope = societySql(scope, filters);
    const start = calendarDate(period.start);
    const end = calendarDate(period.end);
    // Product and industry narrow the totals and the eligible societies alike.
    const product = Prisma.sql`${
      filters.product
        ? Prisma.sql`AND o.product = ${filters.product}`
        : Prisma.empty
    } ${
      filters.industry
        ? Prisma.sql`AND b.industry = ${filters.industry}`
        : Prisma.empty
    }`;
    const reports = Prisma.sql`
      SELECT r.quantity, r.updated_at, o.id AS output_id, o.product, o.unit,
             o.other_description, b.id AS business_id, b.name AS business_name,
             s.id AS society_id, s.name_en AS society_name
      FROM production_records r
      JOIN business_outputs o ON o.id = r.output_id
      JOIN society_businesses b ON b.id = o.business_id
      JOIN societies s ON s.id = b.society_id
      WHERE ${inScope}
        AND r.basis = ${period.basis}::production_basis
        AND r.measurement = ${measurement}::production_measurement
        AND r.period_start = ${start}::date
        AND r.period_end = ${end}::date
        ${product}`;

    return executeDatabaseOperation(async () => {
      const rows = await this.prisma.$queryRaw<
        {
          product: string;
          unit: string;
          eligible: bigint;
          reported: bigint;
          zero: bigint;
          total: Prisma.Decimal | null;
          businesses: bigint;
        }[]
      >`
        WITH reports AS (${reports}),
        eligible_outputs AS (
          SELECT o.product, o.unit, s.id AS society_id
          FROM business_outputs o
          JOIN society_businesses b ON b.id = o.business_id
          JOIN societies s ON s.id = b.society_id
          WHERE ${inScope}
            AND s.status = 'ACTIVE'
            AND o.product <> 'OTHER'
            ${product}
            AND (o.created_at AT TIME ZONE 'Asia/Colombo')::date <= ${end}::date
            AND (o.archived_at IS NULL OR (o.archived_at AT TIME ZONE 'Asia/Colombo')::date >= ${start}::date)
            AND (b.closed_at IS NULL OR (b.closed_at AT TIME ZONE 'Asia/Colombo')::date >= ${start}::date)
        ),
        standard AS (SELECT * FROM reports WHERE product <> 'OTHER'),
        eligible AS (
          SELECT product, unit, society_id FROM eligible_outputs
          UNION
          SELECT product, unit, society_id FROM standard
        ),
        per_society AS (
          SELECT product, unit, society_id, SUM(quantity) AS quantity
          FROM standard GROUP BY product, unit, society_id
        ),
        totals AS (
          SELECT product, unit, SUM(quantity) AS total,
                 COUNT(DISTINCT business_id) AS businesses
          FROM standard GROUP BY product, unit
        )
        SELECT e.product, e.unit,
               COUNT(DISTINCT e.society_id) AS eligible,
               COUNT(DISTINCT p.society_id) AS reported,
               COUNT(DISTINCT p.society_id) FILTER (WHERE p.quantity = 0) AS zero,
               MAX(t.total) AS total,
               COALESCE(MAX(t.businesses), 0) AS businesses
        FROM eligible e
        LEFT JOIN per_society p
          ON p.product = e.product AND p.unit = e.unit AND p.society_id = e.society_id
        LEFT JOIN totals t ON t.product = e.product AND t.unit = e.unit
        GROUP BY e.product, e.unit
        ORDER BY e.product, e.unit`;

      const others = await this.prisma.$queryRaw<
        {
          output_id: string;
          other_description: string;
          unit: string;
          quantity: Prisma.Decimal;
          society_id: string;
          society_name: string;
          business_name: string;
        }[]
      >`
        WITH reports AS (${reports})
        SELECT output_id, other_description, unit, quantity, society_id,
               society_name, business_name
        FROM reports WHERE product = 'OTHER'
        ORDER BY society_name, business_name, output_id
        LIMIT ${MAX_OTHER_ROWS}`;

      const [latest] = await this.prisma.$queryRaw<{ at: Date | null }[]>`
        WITH reports AS (${reports}) SELECT MAX(updated_at) AS at FROM reports`;

      return {
        rows: rows.map((row) => ({
          product: row.product,
          unit: row.unit,
          eligible: Number(row.eligible),
          reported: Number(row.reported),
          zero: Number(row.zero),
          total: row.total === null ? null : row.total.toString(),
          businesses: Number(row.businesses),
        })),
        others: others.map((row) => ({
          outputId: row.output_id,
          description: row.other_description,
          unit: row.unit,
          quantity: row.quantity.toString(),
          societyId: row.society_id,
          societyName: row.society_name,
          businessName: row.business_name,
        })),
        lastUpdatedAt: latest?.at ?? null,
      };
    });
  }

  /**
   * Issue #147: the districts a caller may pick, and the societies in scope
   * that have registered a business (the only ones with anything to show),
   * optionally within one district.
   */
  async scopeOptions(scope: EconomyScope, districtId?: string) {
    const where = societyWhere(scope, {});
    return executeDatabaseOperation(async () => {
      const [districts, societies, societyCount] =
        await this.prisma.$transaction([
          this.prisma.district.findMany({
            where: scope.national ? {} : { societies: { some: where } },
            select: { id: true, nameEn: true },
            orderBy: { nameEn: 'asc' },
          }),
          this.prisma.society.findMany({
            where: {
              AND: [
                where,
                ...(districtId ? [{ districtId }] : []),
                { businesses: { some: {} } },
              ],
            },
            select: { id: true, nameEn: true, districtId: true },
            orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
            take: MAX_SCOPE_SOCIETIES,
          }),
          this.prisma.society.count({ where }),
        ]);
      return { districts, societies, societyCount };
    });
  }
}
