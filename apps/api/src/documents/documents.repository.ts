import { ConflictException, Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AccessLevel,
  DocumentScopeFilter,
} from './document-access.policy.js';
import type { DocumentStatusValue, DocumentTypeValue } from './upload-rules.js';

const include = {
  society: {
    select: { id: true, societyCode: true, nameEn: true, districtId: true },
  },
} as const;

export interface DocumentListFilters {
  scope: DocumentScopeFilter;
  societyId?: string;
  districtId?: string;
  documentType?: DocumentTypeValue;
  status?: DocumentStatusValue;
  page: number;
  pageSize: number;
}

export interface NewDocument {
  id: string;
  societyId: string;
  documentType: DocumentTypeValue;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  accessLevel: AccessLevel;
  uploadedById: string;
  uploadedByName: string;
  uploadedByRole?: string | null;
  financialYear?: number | null;
}

/** Who confirmed the upload, for the society change history. */
export interface UploadActor {
  id: string;
  displayName: string;
  role: string | null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/** PostgreSQL access for document metadata. No access rules live here. */
@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSociety(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.society.findUnique({
        where: { id },
        select: { id: true, nameEn: true, districtId: true },
      }),
    );
  }

  async list(filters: DocumentListFilters) {
    const { scope } = filters;
    const where: Prisma.SocietyDocumentWhereInput = {
      // Lists only show files that have been uploaded.
      uploadedAt: { not: null },
      ...(scope.includeRestricted ? {} : { accessLevel: 'STANDARD' }),
      ...(scope.kind === 'societies'
        ? { societyId: { in: scope.societyIds } }
        : {}),
      ...(scope.kind === 'mixed' ? { OR: [
        { societyId: { in: scope.societyIds } },
        { society: { districtId: { in: scope.districtIds } } },
      ] } : {}),
      ...(filters.societyId ? { AND: [{ societyId: filters.societyId }] } : {}),
      society: {
        ...(scope.kind === 'districts'
          ? { districtId: { in: scope.districtIds } }
          : {}),
        ...(filters.districtId
          ? { AND: [{ districtId: filters.districtId }] }
          : {}),
      },
      ...(filters.documentType ? { documentType: filters.documentType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [records, totalItems] = await executeDatabaseOperation(() =>
      this.prisma.$transaction([
        this.prisma.societyDocument.findMany({
          where,
          include,
          orderBy: [{ uploadedAt: 'desc' }, { id: 'asc' }],
          skip: (filters.page - 1) * filters.pageSize,
          take: filters.pageSize,
        }),
        this.prisma.societyDocument.count({ where }),
      ]),
    );
    return { records, totalItems };
  }

  findById(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.societyDocument.findUnique({ where: { id }, include }),
    );
  }

  /** Creates the next version of a document with the same society, type and title. */
  async create(document: NewDocument) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const latest = await tx.societyDocument.aggregate({
          where: {
            societyId: document.societyId,
            documentType: document.documentType,
            title: document.title,
          },
          _max: { version: true },
        });
        return tx.societyDocument.create({
          data: { ...document, version: (latest._max.version ?? 0) + 1 },
          include,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Another version of this document was added at the same time. Try again.',
        );
      }
      return executeDatabaseOperation(() => Promise.reject(error));
    }
  }

  /** Marks the file uploaded and adds it to the society change history. */
  markUploaded(id: string, uploadedAt: Date, actor?: UploadActor) {
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const record = await tx.societyDocument.update({
          where: { id },
          data: { uploadedAt, status: 'SUBMITTED' },
          include,
        });
        if (actor) {
          const isAuditReport = record.documentType === 'AUDIT_REPORT';
          await tx.platformAuditEvent.create({
            data: {
              actorId: actor.id,
              actorName: actor.displayName,
              actorRole: actor.role,
              action: isAuditReport ? 'AUDIT_REPORT_UPLOADED' : 'DOCUMENT_UPLOADED',
              targetId: record.id,
              societyId: record.societyId,
              districtId: record.society.districtId,
              detail: `${record.title} uploaded · ${record.fileName}`.slice(
                0,
                2000,
              ),
            },
          });
        }
        return record;
      }),
    );
  }
}

export type DocumentRecord = NonNullable<
  Awaited<ReturnType<DocumentsRepository['findById']>>
>;
