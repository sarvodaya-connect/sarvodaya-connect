import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findDemoPrincipal } from '../auth/demo-principals.js';
import { DemoUserDirectory } from '../auth/user-directory.js';
import type { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';

const NORTH = '29000000-0000-4000-8000-000000000001';
const NOTIFICATION_ID = '00000000-0000-4000-8000-0000000000a1';

describe('NotificationsService', () => {
  const repository = {
    listForRecipient: vi.fn(),
    createMany: vi.fn(),
    markRead: vi.fn(),
    exists: vi.fn(),
    markAllRead: vi.fn(),
  };
  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationsService(
      repository as unknown as NotificationsRepository,
      new DemoUserDirectory(),
    );
  });

  it('notifies the District Managers of the district and HQ, but not the uploader', async () => {
    repository.createMany.mockImplementation(async (rows: unknown[]) => ({
      count: rows.length,
    }));

    const sent = await service.notifyReviewers({
      districtId: NORTH,
      excludeUserId: 'demo-hq-admin',
      category: 'APPROVAL',
      title: 'Audit report from Example Sunrise Society is waiting for review',
    });

    expect(sent).toBe(1);
    expect(repository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientUserId: 'demo-dm-north',
        category: 'APPROVAL',
      }),
    ]);
  });

  it('returns the signed-in user notifications with the unread count', async () => {
    repository.listForRecipient.mockResolvedValue({
      records: [
        {
          id: NOTIFICATION_ID,
          category: 'APPROVAL',
          title: 'Waiting for review',
          body: null,
          linkPath: '/documents',
          societyId: null,
          documentId: null,
          readAt: null,
          createdAt: new Date('2026-10-18T10:00:00.000Z'),
        },
      ],
      totalItems: 1,
      unreadCount: 1,
    });

    const result = await service.list(findDemoPrincipal('demo-dm-north')!, {
      page: 1,
      pageSize: 20,
      unreadOnly: false,
    });

    expect(repository.listForRecipient).toHaveBeenCalledWith('demo-dm-north', {
      unreadOnly: false,
      page: 1,
      pageSize: 20,
    });
    expect(result.data).toEqual([
      {
        id: NOTIFICATION_ID,
        category: 'APPROVAL',
        title: 'Waiting for review',
        linkPath: '/documents',
        read: false,
        createdAt: '2026-10-18T10:00:00.000Z',
      },
    ]);
    expect(result.meta.unreadCount).toBe(1);
  });

  it("does not let users change someone else's notification", async () => {
    repository.markRead.mockResolvedValue(0);
    repository.exists.mockResolvedValue(false);

    await expect(
      service.markRead(findDemoPrincipal('demo-dm-central')!, NOTIFICATION_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats marking an already read notification as success', async () => {
    repository.markRead.mockResolvedValue(0);
    repository.exists.mockResolvedValue(true);

    await expect(
      service.markRead(findDemoPrincipal('demo-dm-north')!, NOTIFICATION_ID),
    ).resolves.toEqual({
      id: NOTIFICATION_ID,
      read: true,
    });
  });
});
