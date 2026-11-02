import { ForbiddenException } from '@nestjs/common';

import { hasRole, type Principal } from '../auth/principal.js';
import { canEditSocietyRecord } from '../societies/society-record.policy.js';

/**
 * V5 PR 4 rules for activities (SP06–SP08, M09a–M09d, M50–M52). They run on
 * the server for every request; the flags sent to the clients only decide
 * which buttons to show.
 *
 * - People who edit the society record add and change its activities: the
 *   assigned Society Officer, SPC and DDM, and HQ (V5 D05w "Edit plan").
 *   District Managers and DDMs on temporary district access only view.
 * - Only the SPC assigned to the society approves an activity, sends it back
 *   and chooses its UN SDGs. HQ does not approve activities.
 */

interface SocietyScope {
  id: string;
  districtId: string;
}

export function canAddActivities(principal: Principal, society: SocietyScope) {
  return canEditSocietyRecord(principal, society);
}

export function canReviewActivities(
  principal: Principal,
  society: { id: string },
) {
  return (
    hasRole(principal, 'PROGRAMME_COORDINATOR') &&
    principal.societyIds.includes(society.id)
  );
}

export function assertCanAddActivities(
  principal: Principal,
  society: SocietyScope,
) {
  if (!canAddActivities(principal, society)) {
    throw new ForbiddenException(
      'You can view this work plan but cannot add or change its activities',
    );
  }
}

export function assertCanReviewActivities(
  principal: Principal,
  society: { id: string },
) {
  if (!canReviewActivities(principal, society)) {
    throw new ForbiddenException(
      "Only the society's SPC can approve activities and choose their UN SDGs",
    );
  }
}
