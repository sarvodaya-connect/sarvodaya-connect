import { Injectable } from '@nestjs/common';

import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type NotificationCategoryValue =
  | 'APPROVAL'
  | 'RETURNED'
  | 'AUDIT'
  | 'REQUEST'
  | 'EMERGENCY'
  | 'STALE_DATA'
  | 'SYSTEM';

export interface NewNotification {
  recipientUserId: string;
  category: NotificationCategoryValue;
  title: string;
  body?: string;
  linkPath?: string;
  societyId?: string;
  documentId?: string;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForRecipient(
    recipientUserId: string,
    options: { unreadOnly: boolean; page: number; pageSize: number },
  ) {
    const where = {
      recipientUserId,
      ...(options.unreadOnly ? { readAt: null } : {}),
    };
    const [records, totalItems, unreadCount] = await executeDatabaseOperation(
      () =>
        this.prisma.$transaction([
          this.prisma.notification.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            skip: (options.page - 1) * options.pageSize,
            take: options.pageSize,
          }),
          this.prisma.notification.count({ where }),
          this.prisma.notification.count({
            where: { recipientUserId, readAt: null },
          }),
        ]),
    );
    return { records, totalItems, unreadCount };
  }

  createMany(notifications: NewNotification[]) {
    return executeDatabaseOperation(() =>
      this.prisma.notification.createMany({ data: notifications }),
    );
  }

  /** Marks one of the recipient's notifications read. Returns how many rows changed (0 or 1). */
  async markRead(
    id: string,
    recipientUserId: string,
    readAt: Date,
  ): Promise<number> {
    const result = await executeDatabaseOperation(() =>
      this.prisma.notification.updateMany({
        where: { id, recipientUserId, readAt: null },
        data: { readAt },
      }),
    );
    return result.count;
  }

  exists(id: string, recipientUserId: string) {
    return executeDatabaseOperation(() =>
      this.prisma.notification.count({ where: { id, recipientUserId } }),
    ).then((count) => count > 0);
  }

  async markAllRead(recipientUserId: string, readAt: Date): Promise<number> {
    const result = await executeDatabaseOperation(() =>
      this.prisma.notification.updateMany({
        where: { recipientUserId, readAt: null },
        data: { readAt },
      }),
    );
    return result.count;
  }
}

export type NotificationRecord = Awaited<
  ReturnType<NotificationsRepository['listForRecipient']>
>['records'][number];
