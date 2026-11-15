import { describe, expect, it, vi } from 'vitest';

import type { Principal } from '../auth/principal.js';
import type { EconomyRepository } from './economy.repository.js';
import { EconomyService } from './economy.service.js';

const HQ: Principal = {
  id: 'p',
  displayName: 'Fictional person',
  roles: ['HQ_ADMIN'],
  districtIds: [],
  societyIds: [],
};

function serviceWithRepository() {
  const listRecords = vi.fn().mockResolvedValue({ rows: [], total: 0 });
  const repository = { listRecords } as unknown as EconomyRepository;
  return { service: new EconomyService(repository), listRecords };
}

const EXACT = {
  basis: 'MONTHLY',
  startsOn: '2026-09-01',
  endsOn: '2026-09-30',
} as const;

describe('production record lists (issue #147)', () => {
  it('lists only actual figures for an exact period when no measurement is sent, as the summary counts', async () => {
    const { service, listRecords } = serviceWithRepository();
    await service.listRecords({ ...EXACT }, HQ);
    expect(listRecords.mock.calls[0]?.[1]).toMatchObject({
      measurement: 'ACTUAL',
    });
  });

  it('keeps an explicitly requested measurement for an exact period', async () => {
    const { service, listRecords } = serviceWithRepository();
    await service.listRecords({ ...EXACT, measurement: 'ESTIMATED' }, HQ);
    expect(listRecords.mock.calls[0]?.[1]).toMatchObject({
      measurement: 'ESTIMATED',
    });
  });

  it('leaves an ordinary history list unfiltered by measurement', async () => {
    const { service, listRecords } = serviceWithRepository();
    await service.listRecords({}, HQ);
    expect(listRecords.mock.calls[0]?.[1].measurement).toBeUndefined();
  });
});
