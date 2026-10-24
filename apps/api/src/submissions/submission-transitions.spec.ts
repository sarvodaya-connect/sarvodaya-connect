import { describe, expect, it } from 'vitest';

import {
  SUBMISSION_ACTIONS,
  SUBMISSION_STATUSES,
  allowedActions,
  applyTransition,
  type SubmissionAction,
  type SubmissionStatus,
} from './submission-transitions.js';

type Role = 'SOCIETY_OFFICER' | 'DISTRICT_MANAGER';

const VALID: [SubmissionStatus, SubmissionAction, SubmissionStatus, Role][] = [
  ['DRAFT', 'SUBMIT', 'SUBMITTED', 'SOCIETY_OFFICER'],
  ['SUBMITTED', 'START_REVIEW', 'UNDER_REVIEW', 'DISTRICT_MANAGER'],
  ['RESUBMITTED', 'START_REVIEW', 'UNDER_REVIEW', 'DISTRICT_MANAGER'],
  ['UNDER_REVIEW', 'REQUEST_CHANGES', 'CHANGES_REQUESTED', 'DISTRICT_MANAGER'],
  ['UNDER_REVIEW', 'APPROVE', 'APPROVED', 'DISTRICT_MANAGER'],
  ['UNDER_REVIEW', 'REJECT', 'REJECTED', 'DISTRICT_MANAGER'],
  ['CHANGES_REQUESTED', 'RESUBMIT', 'RESUBMITTED', 'SOCIETY_OFFICER'],
];

describe('submission transitions', () => {
  it.each(VALID)('%s + %s -> %s', (from, action, to, role) => {
    expect(applyTransition(from, action, [role])).toBe(to);
  });

  it('rejects every pair that is not in the table (409)', () => {
    for (const status of SUBMISSION_STATUSES) {
      for (const action of SUBMISSION_ACTIONS) {
        const valid = VALID.some(([f, a]) => f === status && a === action);
        if (valid) continue;
        const role: Role =
          action === 'SUBMIT' || action === 'RESUBMIT'
            ? 'SOCIETY_OFFICER'
            : 'DISTRICT_MANAGER';
        expect(() => applyTransition(status, action, [role])).toThrow(
          /Cannot/,
        );
      }
    }
  });

  it('rejects the wrong role (403)', () => {
    expect(() =>
      applyTransition('UNDER_REVIEW', 'APPROVE', ['SOCIETY_OFFICER']),
    ).toThrow(/cannot perform/);
    expect(() =>
      applyTransition('DRAFT', 'SUBMIT', ['DISTRICT_MANAGER']),
    ).toThrow(/cannot perform/);
  });

  it('treats APPROVED and REJECTED as terminal', () => {
    for (const status of ['APPROVED', 'REJECTED'] as const) {
      expect(
        allowedActions(status, ['DISTRICT_MANAGER', 'SOCIETY_OFFICER']),
      ).toEqual([]);
    }
  });

  it('offers each role only its own actions', () => {
    expect(allowedActions('UNDER_REVIEW', ['DISTRICT_MANAGER'])).toEqual([
      'REQUEST_CHANGES',
      'APPROVE',
      'REJECT',
    ]);
    expect(allowedActions('UNDER_REVIEW', ['SOCIETY_OFFICER'])).toEqual([]);
    expect(allowedActions('CHANGES_REQUESTED', ['SOCIETY_OFFICER'])).toEqual([
      'RESUBMIT',
    ]);
  });
});
