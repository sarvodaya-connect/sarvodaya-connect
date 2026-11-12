import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REGISTRAR_DOCUMENT_TYPES } from './upload-rules.js';

type RegistrarType = (typeof REGISTRAR_DOCUMENT_TYPES)[number];

const REGISTRAR_TYPE_LIST = Prisma.join(
  REGISTRAR_DOCUMENT_TYPES.map((type) => Prisma.sql`${type}::document_type`),
);

/**
 * PostgreSQL access for the four annual Registrar documents. National counts
 * run as a couple of grouped queries over the year's uploads, never a loop
 * over societies.
 */
@Injectable()
export class RegistrarDocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSociety(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.society.findUnique({
        where: { id },
        select: { id: true, nameEn: true, districtId: true },
      }),
    );
  }

  /** Uploaded Registrar documents of one society for the year, newest first. */
  societyDocuments(societyId: string, financialYear: number) {
    return executeDatabaseOperation(() =>
      this.prisma.societyDocument.findMany({
        where: {
          societyId,
          financialYear,
          documentType: { in: [...REGISTRAR_DOCUMENT_TYPES] },
          uploadedAt: { not: null },
        },
        orderBy: [{ uploadedAt: 'desc' }, { version: 'desc' }],
      }),
    );
  }

  /** Active societies with each document for the year, and with all four. */
  async nationalTotals(financialYear: number) {
    const [activeSocieties, byType, allFour] = await executeDatabaseOperation(
      () =>
        Promise.all([
          this.prisma.society.count({ where: { status: 'ACTIVE' } }),
          this.prisma.$queryRaw<{ type: RegistrarType; societies: number }[]>`
            SELECT d.document_type::text AS type,
                   COUNT(DISTINCT d.society_id)::int AS societies
            FROM society_documents d
            JOIN societies s ON s.id = d.society_id
            WHERE s.status = 'ACTIVE'
              AND d.financial_year_start = ${financialYear}
              AND d.uploaded_at IS NOT NULL
              AND d.document_type IN (${REGISTRAR_TYPE_LIST})
            GROUP BY d.document_type`,
          this.prisma.$queryRaw<{ societies: number }[]>`
            SELECT COUNT(*)::int AS societies FROM (
              SELECT d.society_id
              FROM society_documents d
              JOIN societies s ON s.id = d.society_id
              WHERE s.status = 'ACTIVE'
                AND d.financial_year_start = ${financialYear}
                AND d.uploaded_at IS NOT NULL
                AND d.document_type IN (${REGISTRAR_TYPE_LIST})
              GROUP BY d.society_id
              HAVING COUNT(DISTINCT d.document_type) = ${REGISTRAR_DOCUMENT_TYPES.length}
            ) complete`,
        ]),
    );
    return {
      activeSocieties,
      byType: new Map(byType.map((row) => [row.type, row.societies])),
      allFour: allFour[0]?.societies ?? 0,
    };
  }

  /**
   * Issue #119: the same counts as `nationalTotals`, for the societies in
   * `scope` only (a DM's district, or a user's assigned societies).
   */
  async scopedTotals(financialYear: number, scope: Prisma.SocietyWhereInput) {
    const active: Prisma.SocietyWhereInput = {
      AND: [scope, { status: 'ACTIVE' }],
    };
    const [activeSocieties, uploaded] = await executeDatabaseOperation(() =>
      Promise.all([
        this.prisma.society.count({ where: active }),
        this.prisma.societyDocument.findMany({
          where: {
            society: active,
            financialYear,
            uploadedAt: { not: null },
            documentType: { in: [...REGISTRAR_DOCUMENT_TYPES] },
          },
          select: { societyId: true, documentType: true },
          distinct: ['societyId', 'documentType'],
        }),
      ]),
    );
    const byType = new Map<RegistrarType, number>();
    const perSociety = new Map<string, number>();
    for (const row of uploaded) {
      const type = row.documentType as RegistrarType;
      byType.set(type, (byType.get(type) ?? 0) + 1);
      perSociety.set(row.societyId, (perSociety.get(row.societyId) ?? 0) + 1);
    }
    const allFour = [...perSociety.values()].filter(
      (types) => types === REGISTRAR_DOCUMENT_TYPES.length,
    ).length;
    return { activeSocieties, byType, allFour };
  }

  /** D12: every uploaded document by type, all years. */
  async documentCounts() {
    const rows = await executeDatabaseOperation(() =>
      this.prisma.societyDocument.groupBy({
        by: ['documentType'],
        where: { uploadedAt: { not: null } },
        _count: { _all: true },
      }),
    );
    return rows.map((row) => ({
      documentType: row.documentType,
      count: row._count._all,
    }));
  }

  /** D11: active societies without the document for the year, by name, one page at a time. */
  async missing(
    documentType: RegistrarType,
    financialYear: number,
    page: number,
    pageSize: number,
    /** Issue #119: limits the list to these societies; HQ passes nothing. */
    scope?: Prisma.SocietyWhereInput,
  ) {
    const where: Prisma.SocietyWhereInput = {
      ...(scope ? { AND: [scope] } : {}),
      status: 'ACTIVE' as const,
      documents: {
        none: { documentType, financialYear, uploadedAt: { not: null } },
      },
    };
    const [societies, totalItems] = await executeDatabaseOperation(() =>
      this.prisma.$transaction([
        this.prisma.society.findMany({
          where,
          select: {
            id: true,
            nameEn: true,
            societyCode: true,
            district: { select: { nameEn: true } },
          },
          orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.society.count({ where }),
      ]),
    );
    return { societies, totalItems };
  }
}
