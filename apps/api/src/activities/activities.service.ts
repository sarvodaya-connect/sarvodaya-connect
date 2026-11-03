import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { Principal } from '../auth/principal.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { canViewSociety } from '../societies/society-access.policy.js';
import type {
  ActivityInputDto,
  ApproveActivityDto,
  SendBackActivityDto,
} from './activities.dto.js';
import {
  ActivitiesRepository,
  type ActivityRow,
} from './activities.repository.js';
import { toQueueItem, toWorkPlanActivity } from './activity.mappers.js';
import {
  assertCanAddActivities,
  assertCanReviewActivities,
  canAddActivities,
  canReviewActivities,
} from './activity.policy.js';

const SRI_LANKA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Work plans can be made for last year, this year and the next two (Sri Lanka time). */
export function plannableYears(now = new Date()) {
  const year = new Date(now.getTime() + SRI_LANKA_OFFSET_MS).getUTCFullYear();
  return { first: year - 1, last: year + 2 };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** V5 PR 4: activities, SPC approval and UN SDGs. */
@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    private readonly repository: ActivitiesRepository,
    private readonly notifications: NotificationsService,
  ) {}

  /** Societies outside the user's scope are reported as not found. */
  private async visibleSociety(id: string, principal: Principal) {
    const society = await this.repository.findSociety(id);
    if (!society || !canViewSociety(principal, society)) {
      throw new NotFoundException('Society not found');
    }
    return society;
  }

  /** Activities of societies outside the user's scope are reported as not found. */
  private async visibleActivity(id: string, principal: Principal) {
    const activity = await this.repository.findActivity(id);
    if (!activity || !canViewSociety(principal, activity.society)) {
      throw new NotFoundException('Activity not found');
    }
    return activity;
  }

  private checkPlan(input: ActivityInputDto) {
    const { first, last } = plannableYears();
    if (input.year < first || input.year > last) {
      throw new BadRequestException(
        `Choose a work-plan year from ${first} to ${last}`,
      );
    }
    if (
      input.youthParticipants != null &&
      input.youthParticipants >
        (input.femaleParticipants ?? 0) + (input.maleParticipants ?? 0)
    ) {
      throw new BadRequestException(
        'Youth are counted inside the female and male participants, so they cannot be more than both together',
      );
    }
    if (
      input.womenHeadedHouseholds != null &&
      input.womenHeadedHouseholds > (input.householdsBenefited ?? 0)
    ) {
      throw new BadRequestException(
        'Women-headed households are part of the households benefited, so they cannot be more',
      );
    }
  }

  private detail(activity: ActivityRow, principal: Principal) {
    return {
      ...toWorkPlanActivity(activity),
      society: {
        id: activity.society.id,
        name: activity.society.nameEn,
        societyCode: activity.society.societyCode,
      },
      permissions: {
        canEdit:
          activity.status !== 'APPROVED' &&
          canAddActivities(principal, activity.society),
        canReview:
          activity.status === 'WAITING_FOR_SPC' &&
          canReviewActivities(principal, activity.society),
      },
    };
  }

  /** M09a–M09d: the Society Officer sends a new activity to the SPC. */
  async create(
    societyId: string,
    input: ActivityInputDto,
    principal: Principal,
  ) {
    const society = await this.visibleSociety(societyId, principal);
    assertCanAddActivities(principal, society);
    this.checkPlan(input);
    const activity = await this.repository.create(society, input, principal);
    await this.notify(
      () => this.repository.spcRecipientIds(society.id),
      principal,
      {
        category: 'APPROVAL',
        topic: 'ACTIVITY',
        title: `Activity to approve: ${activity.name} · ${society.nameEn}`,
        body: `${principal.displayName} planned it for ${MONTHS[activity.month - 1]} ${activity.year}. Choose its UN SDGs and approve it, or send it back.`,
        linkPath: `/activities-to-approve/${activity.id}`,
        societyId: society.id,
      },
      activity.id,
    );
    return this.detail(activity, principal);
  }

  /** Changes an activity that is waiting or was sent back, and sends it again. */
  async update(
    societyId: string,
    activityId: string,
    input: ActivityInputDto,
    principal: Principal,
  ) {
    const society = await this.visibleSociety(societyId, principal);
    const existing = await this.repository.findActivity(activityId);
    if (!existing || existing.societyId !== society.id) {
      throw new NotFoundException('Activity not found');
    }
    assertCanAddActivities(principal, society);
    this.checkPlan(input);
    const activity = await this.repository.update(
      activityId,
      society,
      input,
      principal,
    );
    return this.detail(activity, principal);
  }

  async get(activityId: string, principal: Principal) {
    return this.detail(
      await this.visibleActivity(activityId, principal),
      principal,
    );
  }

  /** SP06 / M50: the SPC's waiting activities and recent approvals. */
  async queue(principal: Principal) {
    const { waiting, approved } = await this.repository.queue(
      principal.societyIds,
    );
    return {
      waiting: waiting.map(toQueueItem),
      approvedRecently: approved.map(toQueueItem),
      societyCount: principal.societyIds.length,
    };
  }

  /** SP07 / M51: the SPC chooses the UN SDGs and approves. */
  async approve(
    activityId: string,
    input: ApproveActivityDto,
    principal: Principal,
  ) {
    const existing = await this.visibleActivity(activityId, principal);
    assertCanReviewActivities(principal, existing.society);
    const sdgs = [...input.sdgs].sort((a, b) => a - b);
    const activity = await this.repository.approve(
      activityId,
      { ...existing.society, name: existing.society.nameEn },
      sdgs,
      principal,
    );
    await this.notify(
      async () => (activity.createdById ? [activity.createdById] : []),
      principal,
      {
        category: 'APPROVAL',
        topic: 'ACTIVITY',
        title: `Activity approved: ${activity.name}`,
        body: `${principal.displayName} (SPC) approved it with UN SDG ${sdgs.join(', ')}. It now counts in the activity figures.`,
        linkPath: `/societies/${activity.societyId}/work-plan`,
        societyId: activity.societyId,
      },
      activity.id,
    );
    return this.detail(activity, principal);
  }

  /** M51b: the SPC sends the activity back to the Society Officer. */
  async sendBack(
    activityId: string,
    input: SendBackActivityDto,
    principal: Principal,
  ) {
    const existing = await this.visibleActivity(activityId, principal);
    assertCanReviewActivities(principal, existing.society);
    const activity = await this.repository.sendBack(
      activityId,
      existing.society,
      input.comment,
      principal,
    );
    await this.notify(
      async () => (activity.createdById ? [activity.createdById] : []),
      principal,
      {
        category: 'RETURNED',
        topic: 'ACTIVITY',
        title: `Activity sent back: ${activity.name}`,
        body: input.comment
          ? `${principal.displayName} (SPC): “${input.comment}”`
          : `${principal.displayName} (SPC) asked you to change it before approving.`,
        linkPath: `/societies/${activity.societyId}/work-plan`,
        societyId: activity.societyId,
      },
      activity.id,
    );
    return this.detail(activity, principal);
  }

  /** A failed notification must not undo a saved activity or decision. */
  private async notify(
    recipients: () => Promise<string[]>,
    principal: Principal,
    notification: Parameters<NotificationsService['notifyUsers']>[1],
    activityId: string,
  ) {
    try {
      const ids = (await recipients()).filter((id) => id !== principal.id);
      await this.notifications.notifyUsers(ids, notification);
    } catch (error) {
      this.logger.warn(
        `Could not send notifications for activity ${activityId}`,
        error as Error,
      );
    }
  }
}
