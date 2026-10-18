import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findDemoPrincipal } from '../auth/demo-principals.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import {
  type DocumentStorage,
  StorageUnavailableError,
} from '../storage/document-storage.js';
import type {
  DocumentRecord,
  DocumentsRepository,
} from './documents.repository.js';
import { DocumentsService } from './documents.service.js';

const NORTH = '29000000-0000-4000-8000-000000000001';
const SUNRISE_ID = '29000000-0000-4000-8000-000000000101';
const DOCUMENT_ID = '00000000-0000-4000-8000-0000000000d1';

const officer = findDemoPrincipal('demo-officer-sunrise')!;
const otherOfficer = findDemoPrincipal('demo-officer-lotus')!;
const northManager = findDemoPrincipal('demo-dm-north')!;
const centralManager = findDemoPrincipal('demo-dm-central')!;

function record(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: DOCUMENT_ID,
    societyId: SUNRISE_ID,
    society: {
      id: SUNRISE_ID,
      societyCode: 'DEMO-SOC-001',
      nameEn: 'Example Sunrise Society',
      districtId: NORTH,
    },
    documentType: 'AUDIT_REPORT',
    title: 'Audit report FY 2025/26',
    fileName: 'audit-report.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1_400_000,
    storageKey: `societies/${SUNRISE_ID}/documents/${DOCUMENT_ID}.pdf`,
    status: 'DRAFT',
    accessLevel: 'STANDARD',
    version: 1,
    uploadedById: officer.id,
    uploadedByName: officer.displayName,
    uploadedAt: null,
    createdAt: new Date('2026-10-18T10:00:00.000Z'),
    updatedAt: new Date('2026-10-18T10:00:00.000Z'),
    ...overrides,
  } as DocumentRecord;
}

describe('DocumentsService', () => {
  const repository = {
    findSociety: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    markUploaded: vi.fn(),
  };
  const storage = {
    driver: 'local' as const,
    createUploadRequest: vi.fn(),
    createDownloadRequest: vi.fn(),
    getObjectInfo: vi.fn(),
  };
  const notifications = { notifyReviewers: vi.fn() };
  let service: DocumentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentsService(
      repository as unknown as DocumentsRepository,
      storage as DocumentStorage,
      notifications as unknown as NotificationsService,
    );
    storage.createUploadRequest.mockResolvedValue({
      method: 'PUT',
      url: 'http://upload',
      headers: {},
      expiresAt: 'x',
    });
    storage.createDownloadRequest.mockResolvedValue({
      method: 'GET',
      url: 'http://download',
      headers: {},
      expiresAt: 'x',
    });
  });

  describe('create', () => {
    const input = {
      societyId: SUNRISE_ID,
      documentType: 'MEMBERS_LIST' as const,
      title: 'Members list 2026 (signed)',
      fileName: 'members-list.pdf',
      contentType: 'application/pdf' as const,
      sizeBytes: 960_000,
    };

    it('records the metadata with an API-generated storage key and returns an upload URL', async () => {
      repository.findSociety.mockResolvedValue({
        id: SUNRISE_ID,
        nameEn: 'Example Sunrise Society',
        districtId: NORTH,
      });
      repository.create.mockImplementation(
        async (data: Record<string, unknown>) =>
          record({ ...data, version: 1 } as never),
      );

      const result = await service.create(officer, input);

      const created = repository.create.mock.calls[0]![0] as Record<
        string,
        string
      >;
      expect(created).toMatchObject({
        societyId: SUNRISE_ID,
        documentType: 'MEMBERS_LIST',
        accessLevel: 'REVIEWERS_ONLY',
        uploadedById: 'demo-officer-sunrise',
      });
      expect(created['storageKey']).toBe(
        `societies/${SUNRISE_ID}/documents/${created['id']}.pdf`,
      );
      expect(created['storageKey']).not.toContain('members-list');
      expect(storage.createUploadRequest).toHaveBeenCalledWith({
        key: created['storageKey'],
        contentType: 'application/pdf',
        sizeBytes: 960_000,
      });
      expect(result.upload.url).toBe('http://upload');
      expect(result.document).not.toHaveProperty('storageKey');
    });

    it('reports societies outside the user scope as not found', async () => {
      repository.findSociety.mockResolvedValue({
        id: SUNRISE_ID,
        nameEn: 'Example Sunrise Society',
        districtId: NORTH,
      });

      await expect(service.create(otherOfficer, input)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        service.create(centralManager, input),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a file name that does not match the content type', async () => {
      repository.findSociety.mockResolvedValue({
        id: SUNRISE_ID,
        nameEn: 'Example Sunrise Society',
        districtId: NORTH,
      });

      await expect(
        service.create(officer, { ...input, fileName: 'members-list.docx' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('completeUpload', () => {
    it('submits the document once the stored file matches and notifies reviewers', async () => {
      repository.findById.mockResolvedValue(record());
      storage.getObjectInfo.mockResolvedValue({ sizeBytes: 1_400_000 });
      repository.markUploaded.mockResolvedValue(
        record({
          status: 'SUBMITTED',
          uploadedAt: new Date('2026-10-18T10:05:00.000Z'),
        }),
      );

      const result = await service.completeUpload(officer, DOCUMENT_ID);

      expect(result).toMatchObject({
        status: 'SUBMITTED',
        uploadedAt: '2026-10-18T10:05:00.000Z',
      });
      expect(notifications.notifyReviewers).toHaveBeenCalledWith(
        expect.objectContaining({
          districtId: NORTH,
          excludeUserId: officer.id,
          category: 'APPROVAL',
          title:
            'Audit report from Example Sunrise Society is waiting for review',
          documentId: DOCUMENT_ID,
        }),
      );
    });

    it('lets the uploader complete a members list they cannot open afterwards', async () => {
      repository.findById.mockResolvedValue(
        record({ documentType: 'MEMBERS_LIST', accessLevel: 'REVIEWERS_ONLY' }),
      );
      storage.getObjectInfo.mockResolvedValue({ sizeBytes: 1_400_000 });
      repository.markUploaded.mockResolvedValue(
        record({
          accessLevel: 'REVIEWERS_ONLY',
          status: 'SUBMITTED',
          uploadedAt: new Date(),
        }),
      );

      await expect(
        service.completeUpload(officer, DOCUMENT_ID),
      ).resolves.toMatchObject({ status: 'SUBMITTED' });
      await expect(service.get(officer, DOCUMENT_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuses to complete before the file is uploaded or when the size differs', async () => {
      repository.findById.mockResolvedValue(record());

      storage.getObjectInfo.mockResolvedValueOnce(null);
      await expect(
        service.completeUpload(officer, DOCUMENT_ID),
      ).rejects.toThrow('The file has not been uploaded yet');

      storage.getObjectInfo.mockResolvedValueOnce({ sizeBytes: 12 });
      await expect(
        service.completeUpload(officer, DOCUMENT_ID),
      ).rejects.toThrow('size does not match');

      repository.findById.mockResolvedValue(record({ uploadedAt: new Date() }));
      await expect(
        service.completeUpload(officer, DOCUMENT_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.markUploaded).not.toHaveBeenCalled();
    });

    it('keeps the upload when notifying reviewers fails', async () => {
      repository.findById.mockResolvedValue(record());
      storage.getObjectInfo.mockResolvedValue({ sizeBytes: 1_400_000 });
      repository.markUploaded.mockResolvedValue(
        record({ status: 'SUBMITTED', uploadedAt: new Date() }),
      );
      notifications.notifyReviewers.mockRejectedValue(
        new Error('database busy'),
      );

      await expect(
        service.completeUpload(officer, DOCUMENT_ID),
      ).resolves.toMatchObject({ status: 'SUBMITTED' });
    });

    it('turns a storage outage into a safe 503', async () => {
      repository.findById.mockResolvedValue(record());
      storage.getObjectInfo.mockRejectedValue(
        new StorageUnavailableError('bucket unreachable'),
      );

      await expect(
        service.completeUpload(officer, DOCUMENT_ID),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('get and download', () => {
    it('hides documents outside the user scope', async () => {
      repository.findById.mockResolvedValue(record({ uploadedAt: new Date() }));

      await expect(
        service.get(otherOfficer, DOCUMENT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.get(centralManager, DOCUMENT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.createDownload(centralManager, DOCUMENT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('opens restricted documents for reviewers only', async () => {
      repository.findById.mockResolvedValue(
        record({
          documentType: 'MEMBERS_LIST',
          accessLevel: 'REVIEWERS_ONLY',
          uploadedAt: new Date(),
          uploadedById: 'someone-else',
        }),
      );

      await expect(
        service.createDownload(officer, DOCUMENT_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.createDownload(northManager, DOCUMENT_ID),
      ).resolves.toMatchObject({ url: 'http://download' });
      expect(storage.createDownloadRequest).toHaveBeenCalledWith({
        key: `societies/${SUNRISE_ID}/documents/${DOCUMENT_ID}.pdf`,
        fileName: 'audit-report.pdf',
        contentType: 'application/pdf',
      });
    });

    it('does not create download links before the file exists', async () => {
      repository.findById.mockResolvedValue(record());

      await expect(
        service.createDownload(officer, DOCUMENT_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('lists with the scope of the signed-in user', async () => {
    repository.list.mockResolvedValue({
      records: [record({ uploadedAt: new Date() })],
      totalItems: 21,
    });

    const result = await service.list(northManager, { page: 2, pageSize: 20 });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: {
          kind: 'districts',
          districtIds: [NORTH],
          includeRestricted: true,
        },
        page: 2,
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 20,
      totalItems: 21,
      totalPages: 2,
    });
  });
});
