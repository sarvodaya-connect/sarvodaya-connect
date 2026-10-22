import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { reportRecordsFor } from '@/lib/report-data';
import { getViewer } from '@/lib/access';
import { ReportBuilder } from './report-builder';

describe('report catalogue and builder', () => {
  it('runs predefined reports and displays consistent results', async () => {
    const user = userEvent.setup();
    render(<ReportBuilder records={reportRecordsFor(getViewer('hq-admin'))} />);
    await user.click(screen.getAllByRole('button', { name: 'Run report' })[2]);
    expect(await screen.findByRole('heading', { name: 'Report results' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
      'Activity ID', 'Activity', 'Society', 'District', 'Sector', 'Date', 'Status', 'Participants', 'Planned value (LKR)',
    ]);
  });

  it('builds a custom membership report from selected fields', async () => {
    const user = userEvent.setup();
    render(<ReportBuilder records={reportRecordsFor(getViewer('hq-admin'))} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Report type' }), 'membership');
    await user.click(screen.getByRole('checkbox', { name: 'Society code' }));
    await user.click(screen.getByRole('button', { name: 'Run custom report' }));
    expect(await screen.findByRole('heading', { name: 'Report results' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Female members' })).toBeInTheDocument();
  });

  it('shows an empty report when the scoped dataset has no records', async () => {
    const user = userEvent.setup();
    render(<ReportBuilder records={[]} />);
    await user.click(screen.getByRole('button', { name: 'Run custom report' }));
    expect(await screen.findByText('No results for these filters')).toBeInTheDocument();
  });

  it('shows loading feedback and supports CSV export', async () => {
    const user = userEvent.setup();
    render(<ReportBuilder records={reportRecordsFor(getViewer('hq-admin'))} />);
    await user.click(screen.getAllByRole('button', { name: 'Run report' })[0]);
    expect(screen.getByRole('status')).toHaveTextContent('Preparing report');
    await screen.findByRole('heading', { name: 'Report results' });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });
});
