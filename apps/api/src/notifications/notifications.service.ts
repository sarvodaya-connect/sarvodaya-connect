import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { Principal } from '../auth/principal.js';
import { USER_DIRECTORY, type UserDirectory } from '../auth/user-directory.js';
import type { NotificationQueryDto } from './dto/notification-query.dto.js';
import {
  type NewNotification,
  type NotificationRecord,
  NotificationsRepository,
} from './notifications.repository.js';

export function toNotificationResponse(record: NotificationRecord) {
  return {
    id: record.id,
    category: record.category,
    title: record.title,
    ...(record.body ? { body: record.body } : {}),
    ...(record.linkPath ? { linkPath: record.linkPath } : {}),
    ...(record.societyId ? { societyId: record.societyId } : {}),
    ...(record.documentId ? { documentId: record.documentId } : {}),
    read: record.readAt !== null,
    ...(record.readAt ? { readAt: record.readAt.toISOString() } : {}),
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  /** The signed-in user's own notifications, newest first. */
  async list(principal: Principal, query: NotificationQueryDto) {
    const { records, totalItems, unreadCount } =
      await this.repository.listForRecipient(principal.id, {
        unreadOnly: query.unreadOnly,
        page: query.page,
        pageSize: query.pageSize,
      });
    return {
      data: records.map(toNotificationResponse),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
        unreadCount,
      },
    };
  }

  /** Users can only change their own notifications; others are reported as not found. */
  async markRead(principal: Principal, id: string) {
    const changed = await this.repository.markRead(
      id,
      principal.id,
      new Date(),
    );
    if (changed === 0 && !(await this.repository.exists(id, principal.id))) {
      throw new NotFoundException('Notification not found');
    }
    return { id, read: true };
  }

  async markAllRead(principal: Principal) {
    return {
      updated: await this.repository.markAllRead(principal.id, new Date()),
    };
  }

  /** Sends one notification to every reviewer of the district (District Managers and HQ). */
  async notifyReviewers(
    input: Omit<NewNotification, 'recipientUserId'> & {
      districtId: string;
      excludeUserId?: string;
    },
  ): Promise<number> {
    const { districtId, excludeUserId, ...notification } = input;
    const recipients = (await this.users.findReviewerIds(districtId)).filter(
      (id) => id !== excludeUserId,
    );
    if (recipients.length === 0) return 0;
    const result = await this.repository.createMany(
      recipients.map((recipientUserId) => ({
        ...notification,
        recipientUserId,
      })),
    );
    return result.count;
  }
}
