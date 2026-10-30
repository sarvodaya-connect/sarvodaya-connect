import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { Principal } from '../auth/principal.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  DOCUMENT_STORAGE,
  type DocumentStorage,
  StorageUnavailableError,
} from '../storage/document-storage.js';
import {
  financialYear as financialYearOf,
  isSelectableFinancialYear,
} from '../societies/financial-year.js';
import {
  accessLevelFor,
  canAccessSociety,
  canCreateDocument,
  canViewDocument,
  documentScopeFilter,
} from './document-access.policy.js';
import {
  DocumentsRepository,
  type DocumentRecord,
} from './documents.repository.js';
import type { CreateDocumentDto } from './dto/create-document.dto.js';
import type { DocumentQueryDto } from './dto/document-query.dto.js';
import { extensionFor, storageKeyFor } from './upload-rules.js';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  AUDIT_REPORT: 'Audit report',
  AGM_MINUTES: 'AGM minutes',
  OFFICE_BEARER_LIST: 'Office-bearer list',
  MEMBERS_LIST: 'Members list',
  REGISTRATION: 'Registration document',
  FINANCE: 'Finance document',
  ACTIVITY_EVIDENCE: 'Activity evidence',
  OTHER: 'Document',
};

/**
 * Document metadata in the shape of SocietyDocument from packages/api-contracts,
 * plus title, version, access level and the society it belongs to.
 * The storage key is never returned.
 */
export function toDocumentResponse(record: DocumentRecord) {
  return {
    id: record.id,
    societyId: record.societyId,
    society: {
      id: record.society.id,
      societyCode: record.society.societyCode,
      nameEn: record.society.nameEn,
    },
    documentType: record.documentType,
    title: record.title,
    fileName: record.fileName,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    status: record.status,
    accessLevel: record.accessLevel,
    version: record.version,
    uploadedBy: record.uploadedByName,
    ...(record.uploadedByRole ? { uploadedByRole: record.uploadedByRole } : {}),
    ...(record.financialYear != null
      ? { financialYear: financialYearOf(record.financialYear) }
      : {}),
    ...(record.uploadedAt
      ? { uploadedAt: record.uploadedAt.toISOString() }
      : {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Business rules for documents. Storage details stay behind DocumentStorage. */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly repository: DocumentsRepository,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    private readonly notifications: NotificationsService,
  ) {}

  async list(principal: Principal, query: DocumentQueryDto) {
    const { records, totalItems } = await this.repository.list({
      scope: documentScopeFilter(principal),
      societyId: query.societyId,
      districtId: query.districtId,
      documentType: query.documentType,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: records.map(toDocumentResponse),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  /** Records the metadata and returns a short-lived URL for uploading the file. */
  async create(principal: Principal, input: CreateDocumentDto) {
    const society = await this.repository.findSociety(input.societyId);
    const scope = society && {
      societyId: society.id,
      districtId: society.districtId,
    };
    // Societies outside the user's scope are reported as not found.
    if (!society || !scope || !canAccessSociety(principal, scope)) {
      throw new NotFoundException('Society not found');
    }
    if (!canCreateDocument(principal, scope, input.documentType)) {
      throw new ForbiddenException(
        input.documentType === 'AUDIT_REPORT'
          ? "Only the society's Society Officer or assigned SPC can upload the audit report"
          : 'You can view this society but cannot add documents to it',
      );
    }
    const isAuditReport = input.documentType === 'AUDIT_REPORT';
    if (isAuditReport) {
      if (input.financialYear == null) {
        throw new BadRequestException(
          'Choose the financial year of the audit report',
        );
      }
      if (!isSelectableFinancialYear(input.financialYear)) {
        throw new BadRequestException(
          'Choose one of the last completed financial years',
        );
      }
    } else if (input.financialYear != null) {
      throw new BadRequestException('Only audit reports have a financial year');
    }
    const extension = extensionFor(input.fileName, input.contentType);
    if (!extension) {
      throw new BadRequestException(
        'The file name extension does not match the content type',
      );
    }

    const id = randomUUID();
    const record = await this.repository.create({
      id,
      societyId: society.id,
      documentType: input.documentType,
      // Each year's audit report keeps its own version history.
      title: isAuditReport
        ? `Audit report ${financialYearOf(input.financialYear!).label}`
        : input.title,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      storageKey: storageKeyFor({
        societyId: society.id,
        documentId: id,
        extension,
      }),
      accessLevel: accessLevelFor(input.documentType),
      uploadedById: principal.id,
      uploadedByName: principal.displayName,
      uploadedByRole: principal.roles[0] ?? null,
      financialYear: isAuditReport ? input.financialYear! : null,
    });
    const upload = await this.withStorage(() =>
      this.storage.createUploadRequest({
        key: record.storageKey,
        contentType: record.contentType,
        sizeBytes: record.sizeBytes,
      }),
    );
    return { document: toDocumentResponse(record), upload };
  }

  /**
   * Confirms the file reached storage with the declared size, then submits the
   * document for review and tells the reviewers.
   */
  async completeUpload(principal: Principal, id: string) {
    const record = await this.findVisible(principal, id, {
      allowUploader: true,
    });
    if (record.uploadedAt)
      throw new ConflictException('This document has already been uploaded');

    const stored = await this.withStorage(() =>
      this.storage.getObjectInfo(record.storageKey),
    );
    if (!stored)
      throw new ConflictException('The file has not been uploaded yet');
    if (stored.sizeBytes !== record.sizeBytes) {
      throw new ConflictException(
        'The uploaded file size does not match the document',
      );
    }

    const updated = await this.repository.markUploaded(record.id, new Date(), {
      id: principal.id,
      displayName: principal.displayName,
      role: principal.roles[0] ?? null,
    });
    await this.notifyReviewers(updated);
    return toDocumentResponse(updated);
  }

  async get(principal: Principal, id: string) {
    return toDocumentResponse(await this.findVisible(principal, id));
  }

  /** A short-lived URL for downloading the file. */
  async createDownload(principal: Principal, id: string) {
    const record = await this.findVisible(principal, id);
    if (!record.uploadedAt)
      throw new ConflictException('The file has not been uploaded yet');
    return this.withStorage(() =>
      this.storage.createDownloadRequest({
        key: record.storageKey,
        fileName: record.fileName,
        contentType: record.contentType,
      }),
    );
  }

  /**
   * Out-of-scope documents are reported as not found, so their existence is not
   * revealed. Restricted documents inside the user's scope are forbidden.
   */
  private async findVisible(
    principal: Principal,
    id: string,
    options: { allowUploader?: boolean } = {},
  ) {
    const record = await this.repository.findById(id);
    const scope = record && {
      societyId: record.societyId,
      districtId: record.society.districtId,
    };
    if (!record || !scope || !canAccessSociety(principal, scope)) {
      throw new NotFoundException('Document not found');
    }
    const isUploader =
      options.allowUploader === true && record.uploadedById === principal.id;
    if (
      !isUploader &&
      !canViewDocument(principal, { ...scope, accessLevel: record.accessLevel })
    ) {
      throw new ForbiddenException(
        'This document can only be opened by District Managers and HQ',
      );
    }
    return record;
  }

  private async notifyReviewers(record: DocumentRecord) {
    try {
      await this.notifications.notifyReviewers({
        districtId: record.society.districtId,
        excludeUserId: record.uploadedById,
        category: 'APPROVAL',
        title: `${DOCUMENT_TYPE_LABELS[record.documentType] ?? 'Document'} from ${record.society.nameEn} is waiting for review`,
        body: `${record.title} (version ${record.version}) was uploaded by ${record.uploadedByName}.`,
        linkPath: `/documents?society=${record.societyId}`,
        societyId: record.societyId,
        documentId: record.id,
      });
    } catch (error) {
      // The upload is already recorded; a failed notification must not undo it.
      this.logger.warn(
        `Could not notify reviewers about document ${record.id}`,
        error as Error,
      );
    }
  }

  private async withStorage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof StorageUnavailableError) {
        throw new ServiceUnavailableException(
          'Document storage temporarily unavailable',
          { cause: error },
        );
      }
      throw error;
    }
  }
}
