import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service.js';

import { DEMO_PRINCIPALS } from './demo-principals.js';
import { hasRole } from './principal.js';

export const USER_DIRECTORY = Symbol('USER_DIRECTORY');

/** Looks up who should be told about society activity. */
export interface UserDirectory {
  /** District Managers for the district and HQ Administrators. */
  findReviewerIds(districtId: string): Promise<string[]>;
}

/** Directory of the fictional demo users (development and tests only). */
@Injectable()
export class DemoUserDirectory implements UserDirectory {
  findReviewerIds(districtId: string): Promise<string[]> {
    return Promise.resolve(
      DEMO_PRINCIPALS.filter(
        (principal) =>
          hasRole(principal, 'HQ_ADMIN') ||
          (hasRole(principal, 'DISTRICT_MANAGER') &&
            principal.districtIds.includes(districtId)),
      ).map((principal) => principal.id),
    );
  }
}

/**
 * V5 PR 10: reviewers from the database (active HQ administrators, and active
 * District Managers of the district), so production notifications reach real
 * accounts. The fictional demo users are added only in development and tests.
 */
@Injectable()
export class PlatformUserDirectory implements UserDirectory {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findReviewerIds(districtId: string): Promise<string[]> {
    const accounts = await this.db.platformAccount.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { role: 'HQ_ADMIN' },
          { role: 'DISTRICT_MANAGER', districtId },
        ],
      },
      select: { id: true },
    });
    const environment = this.config.get<string>('NODE_ENV');
    const demo =
      environment === 'development' || environment === 'test'
        ? await new DemoUserDirectory().findReviewerIds(districtId)
        : [];
    return [...new Set([...accounts.map((account) => account.id), ...demo])];
  }
}
