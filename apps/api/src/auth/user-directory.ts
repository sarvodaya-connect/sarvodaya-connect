import { Injectable } from '@nestjs/common';

import { DEMO_PRINCIPALS } from './demo-principals.js';
import { hasRole } from './principal.js';

export const USER_DIRECTORY = Symbol('USER_DIRECTORY');

/** Looks up who should be told about society activity. */
export interface UserDirectory {
  /** District Managers for the district and HQ Administrators. */
  findReviewerIds(districtId: string): Promise<string[]>;
}

/** Directory of the fictional demo users. Replaced by the identity provider later. */
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
