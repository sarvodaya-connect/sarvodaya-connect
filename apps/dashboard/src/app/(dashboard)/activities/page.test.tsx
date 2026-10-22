import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getViewer } from '@/lib/access';
import { ACTIVITIES } from '@/lib/activity-data';

const { getCurrentViewer, redirect, notFound } = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
}));
vi.mock('@/lib/current-viewer', () => ({ getCurrentViewer }));
vi.mock('next/navigation', () => ({ redirect, notFound }));

import ActivitiesPage from './page';
import SectorActivityPage from './sector/[sectorId]/page';

describe('activity routes enforce viewer scope before rendering', () => {
  beforeEach(() => vi.clearAllMocks());

  for (const id of ['hq-admin', 'district-manager', 'programme-coordinator']) {
    it(`sends only authorized records and filter options for ${id}`, async () => {
      const viewer = getViewer(id);
      getCurrentViewer.mockResolvedValue(viewer);
      render(await ActivitiesPage());
      const allowed = ACTIVITIES.filter(a => viewer.role === 'HQ_ADMIN' ||
        (viewer.role === 'DISTRICT_MANAGER'
          ? viewer.districtIds.includes(a.districtId)
          : viewer.societyIds?.includes(a.societyId)));
      expect(allowed.length).toBeGreaterThan(0);
      expect(screen.getByText(`Showing ${allowed.length} of ${allowed.length} fictional records`)).toBeInTheDocument();
      for (const activity of ACTIVITIES) {
        expect(screen.queryByText(activity.id) !== null).toBe(allowed.includes(activity));
      }
      const districtOptions = within(screen.getByRole('combobox', { name: 'District' })).getAllByRole('option').map(o => o.textContent);
      expect(districtOptions.slice(1)).toEqual([...new Set(allowed.map(a => a.district))].sort());
      const societyOptions = within(screen.getByRole('combobox', { name: 'Society' })).getAllByRole('option').map(o => o.textContent);
      expect(societyOptions.slice(1)).toEqual([...new Set(allowed.map(a => a.society))].sort());
    });

    it(`keeps the education route scoped for ${id}`, async () => {
      const viewer = getViewer(id);
      getCurrentViewer.mockResolvedValue(viewer);
      render(await SectorActivityPage({ searchParams: Promise.resolve({}), params: Promise.resolve({ sectorId: 'education' }) }));
      expect(screen.getByRole('combobox', { name: 'Sector' })).toBeDisabled();
      for (const activity of ACTIVITIES) {
        const authorized = viewer.role === 'HQ_ADMIN' || (viewer.role === 'DISTRICT_MANAGER'
          ? viewer.districtIds.includes(activity.districtId)
          : viewer.societyIds?.includes(activity.societyId));
        expect(screen.queryByText(activity.id) !== null).toBe(authorized && activity.sectorId === 'education');
      }
    });
  }

  it('blocks direct activity URLs for system administrators', async () => {
    getCurrentViewer.mockResolvedValue(getViewer('system-admin'));
    await expect(ActivitiesPage()).rejects.toThrow('REDIRECT:/admin');
    await expect(SectorActivityPage({ searchParams: Promise.resolve({}), params: Promise.resolve({ sectorId: 'education' }) })).rejects.toThrow('REDIRECT:/admin');
  });

  it('rejects unknown sectors', async () => {
    getCurrentViewer.mockResolvedValue(getViewer('hq-admin'));
    await expect(SectorActivityPage({ searchParams: Promise.resolve({}), params: Promise.resolve({ sectorId: 'unknown' }) })).rejects.toThrow('NOT_FOUND');
  });
});
