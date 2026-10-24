import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { UserRole } from '../auth/principal.js';

/** Mirrors SUBMISSION_STATUSES in packages/api-contracts. */
export const SUBMISSION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'RESUBMITTED',
  'APPROVED',
  'REJECTED',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_ACTIONS = [
  'SUBMIT',
  'START_REVIEW',
  'REQUEST_CHANGES',
  'APPROVE',
  'REJECT',
  'RESUBMIT',
] as const;
export type SubmissionAction = (typeof SUBMISSION_ACTIONS)[number];

type Actor = 'OFFICER' | 'REVIEWER';

const RULES: Record<
  SubmissionAction,
  { from: readonly SubmissionStatus[]; to: SubmissionStatus; actor: Actor }
> = {
  SUBMIT: { from: ['DRAFT'], to: 'SUBMITTED', actor: 'OFFICER' },
  START_REVIEW: {
    from: ['SUBMITTED', 'RESUBMITTED'],
    to: 'UNDER_REVIEW',
    actor: 'REVIEWER',
  },
  REQUEST_CHANGES: {
    from: ['UNDER_REVIEW'],
    to: 'CHANGES_REQUESTED',
    actor: 'REVIEWER',
  },
  APPROVE: { from: ['UNDER_REVIEW'], to: 'APPROVED', actor: 'REVIEWER' },
  REJECT: { from: ['UNDER_REVIEW'], to: 'REJECTED', actor: 'REVIEWER' },
  RESUBMIT: {
    from: ['CHANGES_REQUESTED'],
    to: 'RESUBMITTED',
    actor: 'OFFICER',
  },
};

/** Officers act as OFFICER; District Managers and HQ admins act as REVIEWER. */
function actorsFor(roles: readonly UserRole[]): Actor[] {
  const actors: Actor[] = [];
  if (roles.includes('SOCIETY_OFFICER')) actors.push('OFFICER');
  if (roles.includes('DISTRICT_MANAGER') || roles.includes('HQ_ADMIN')) {
    actors.push('REVIEWER');
  }
  return actors;
}

/** Locked while waiting for or in review: the officer cannot edit. */
export function isLocked(status: SubmissionStatus): boolean {
  return (
    status === 'SUBMITTED' ||
    status === 'UNDER_REVIEW' ||
    status === 'RESUBMITTED'
  );
}

export function allowedActions(
  status: SubmissionStatus,
  roles: readonly UserRole[],
): SubmissionAction[] {
  const actors = actorsFor(roles);
  return SUBMISSION_ACTIONS.filter((action) => {
    const rule = RULES[action];
    return rule.from.includes(status) && actors.includes(rule.actor);
  });
}

/** Returns the next status, or throws 403 (wrong role) / 409 (wrong state). */
export function applyTransition(
  status: SubmissionStatus,
  action: SubmissionAction,
  roles: readonly UserRole[],
): SubmissionStatus {
  const rule = RULES[action];
  if (!actorsFor(roles).includes(rule.actor)) {
    throw new ForbiddenException('Your account cannot perform this action');
  }
  if (!rule.from.includes(status)) {
    throw new ConflictException(
      `Cannot ${action} a submission that is ${status}`,
    );
  }
  return rule.to;
}
