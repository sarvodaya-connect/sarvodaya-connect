import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Principal } from '../auth/principal.js';
import {
  financialYear,
  isSelectableFinancialYear,
  latestCompletedFinancialYear,
} from '../societies/financial-year.js';
import { actorReference } from '../societies/society-record.mappers.js';
import { canViewSociety } from '../societies/society-access.policy.js';
import { canViewDocument } from './document-access.policy.js';
import { RegistrarDocumentsRepository } from './registrar-documents.repository.js';
import { REGISTRAR_DOCUMENT_TYPES } from './upload-rules.js';

type RegistrarType = (typeof REGISTRAR_DOCUMENT_TYPES)[number];

/**
 * The audit report for a financial year is due on 30 September after the
 * year ends (V5 D11 "Due 30 Sep 2026" for FY 2025/26). To be confirmed.
 */
export function auditReportDueDate(startYear: number) {
  return `${startYear + 1}-09-30`;
}

/** The financial year asked for, or the latest completed one; refuses others. */
export function registrarYear(value: number | undefined) {
  const startYear = value ?? latestCompletedFinancialYear();
  if (!isSelectableFinancialYear(startYear)) {
    throw new BadRequestException(
      'Choose one of the last completed financial years',
    );
  }
  return startYear;
}

export function yearOf(startYear: number) {
  const { label } = financialYear(startYear);
  return { startYear, label };
}

/** V5 M13, D05 Documents, D11 and D12: submitted and missing Registrar documents. */
@Injectable()
export class RegistrarDocumentsService {
  constructor(private readonly repository: RegistrarDocumentsRepository) {}

  private year(value: number | undefined) {
    return registrarYear(value);
  }

  /** M13 / D05: the society's four documents for the year. */
  async forSociety(
    societyId: string,
    year: number | undefined,
    principal: Principal,
  ) {
    const society = await this.repository.findSociety(societyId);
    if (!society || !canViewSociety(principal, society)) {
      throw new NotFoundException('Society not found');
    }
    const startYear = this.year(year);
    const uploaded = await this.repository.societyDocuments(
      society.id,
      startYear,
    );
    const documents = REGISTRAR_DOCUMENT_TYPES.map((documentType) => {
      const latest = uploaded.find((doc) => doc.documentType === documentType);
      return {
        documentType,
        document: latest?.uploadedAt
          ? {
              id: latest.id,
              fileName: latest.fileName,
              contentType: latest.contentType,
              sizeBytes: latest.sizeBytes,
              version: latest.version,
              uploadedAt: latest.uploadedAt.toISOString(),
              uploadedBy: actorReference(
                latest.uploadedByName,
                latest.uploadedByRole,
              ),
              canOpen: canViewDocument(principal, {
                societyId: society.id,
                districtId: society.districtId,
                accessLevel: latest.accessLevel,
              }),
            }
          : null,
      };
    });
    const submitted = documents.filter((entry) => entry.document).length;
    return {
      societyId: society.id,
      financialYear: yearOf(startYear),
      documents,
      submitted,
      missing: documents.length - submitted,
    };
  }

  /** D11 / D12 (HQ only): national counts for the year. */
  async totals(year: number | undefined) {
    const startYear = this.year(year);
    const [totals, documentCounts] = await Promise.all([
      this.repository.nationalTotals(startYear),
      this.repository.documentCounts(),
    ]);
    return {
      financialYear: yearOf(startYear),
      activeSocieties: totals.activeSocieties,
      byType: REGISTRAR_DOCUMENT_TYPES.map((documentType) => {
        const submitted = totals.byType.get(documentType) ?? 0;
        return {
          documentType,
          submitted,
          missing: Math.max(totals.activeSocieties - submitted, 0),
        };
      }),
      allFour: totals.allFour,
      auditReportDueOn: auditReportDueDate(startYear),
      documentCounts,
    };
  }

  /** D11 (HQ only): active societies still missing a document. */
  async missing(
    documentType: RegistrarType,
    year: number | undefined,
    page: number,
    pageSize: number,
    now = new Date(),
  ) {
    const startYear = this.year(year);
    const dueOn = auditReportDueDate(startYear);
    const { societies, totalItems } = await this.repository.missing(
      documentType,
      startYear,
      page,
      pageSize,
    );
    const pastDue =
      documentType === 'AUDIT_REPORT' &&
      now.getTime() > Date.parse(`${dueOn}T23:59:59+05:30`);
    return {
      financialYear: yearOf(startYear),
      documentType,
      ...(documentType === 'AUDIT_REPORT' ? { dueOn, pastDue } : {}),
      data: societies.map((society) => ({
        id: society.id,
        name: society.nameEn,
        societyCode: society.societyCode,
        district: society.district.nameEn,
      })),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }
}
