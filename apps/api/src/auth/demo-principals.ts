import type { Principal } from './principal.js';

/**
 * Fictional users for local development and tests, matching the SC-29 seed
 * districts and societies. They are selected with the `X-Demo-User` header
 * and are refused when NODE_ENV is production. Amazon Cognito replaces them.
 */
export const DEMO_PRINCIPALS: readonly Principal[] = [
  {
    id: 'demo-officer-sunrise',
    displayName: 'Demo Officer (Example Sunrise Society)',
    roles: ['SOCIETY_OFFICER'],
    districtIds: ['29000000-0000-4000-8000-000000000001'],
    societyIds: ['29000000-0000-4000-8000-000000000101'],
  },
  {
    id: 'demo-officer-lotus',
    displayName: 'Demo Officer (Example Lotus Society)',
    roles: ['SOCIETY_OFFICER'],
    districtIds: ['29000000-0000-4000-8000-000000000002'],
    societyIds: ['29000000-0000-4000-8000-000000000103'],
  },
  {
    id: 'demo-dm-north',
    displayName: 'Demo District Manager (Fictional North District)',
    roles: ['DISTRICT_MANAGER'],
    districtIds: ['29000000-0000-4000-8000-000000000001'],
    societyIds: [],
  },
  {
    id: 'demo-dm-central',
    displayName: 'Demo District Manager (Fictional Central District)',
    roles: ['DISTRICT_MANAGER'],
    districtIds: ['29000000-0000-4000-8000-000000000002'],
    societyIds: [],
  },
  {
    id: 'demo-hq-admin',
    displayName: 'Demo HQ Administrator',
    roles: ['HQ_ADMIN'],
    districtIds: [],
    societyIds: [],
  },
];

export function findDemoPrincipal(id: string): Principal | undefined {
  return DEMO_PRINCIPALS.find((principal) => principal.id === id);
}
