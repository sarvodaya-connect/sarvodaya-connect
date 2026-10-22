import { ACTIVITIES } from '@/lib/activity-data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ActivityOverview } from './activity-overview';
describe('SC-55 activity dashboard UI', () => {
 it('keeps sector results fixed after clearing or resetting filters', async () => {
   const user = userEvent.setup();
   render(<ActivityOverview records={ACTIVITIES} initialSector="education" />);
   expect(screen.getByRole('combobox', { name: 'Sector' })).toBeDisabled();
   await user.type(screen.getByRole('searchbox', { name: 'Search activities' }), 'no match xyz');
   await user.click(screen.getByRole('button', { name: 'Clear filters' }));
   await user.click(screen.getByRole('button', { name: 'Reset filters' }));
   for (const activity of ACTIVITIES) {
     expect(screen.queryByText(activity.id) !== null).toBe(activity.sectorId === 'education');
   }
 });
 it('shows summary, sectors and activity results',()=>{render(<ActivityOverview records={ACTIVITIES} />);expect(screen.getByText('Ten-sector overview')).toBeInTheDocument();expect(screen.getByText('Showing 40 of 40 fictional records')).toBeInTheDocument();expect(screen.getByRole('link',{name:/Education.*view sector/i})).toHaveAttribute('href','/activities/sector/education');});
 it('changes rows when status and district filters change',async()=>{const user=userEvent.setup();render(<ActivityOverview records={ACTIVITIES} />);await user.selectOptions(screen.getByRole('combobox',{name:'Status'}),'APPROVED');expect(screen.getByText('Showing 16 of 40 fictional records')).toBeInTheDocument();await user.selectOptions(screen.getByRole('combobox',{name:'District'}),'Kandy');expect(screen.getByText(`Showing ${ACTIVITIES.filter(a => a.status === 'APPROVED' && a.district === 'Kandy').length} of 40 fictional records`)).toBeInTheDocument();});
 it('resets filters after an empty result',async()=>{const user=userEvent.setup();render(<ActivityOverview records={ACTIVITIES} />);await user.type(screen.getByRole('searchbox',{name:'Search activities'}),'impossible query 12345');expect(screen.getByRole('heading',{name:'No activities match your filters'})).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Reset filters'}));expect(screen.getByText('Showing 40 of 40 fictional records')).toBeInTheDocument();});
 it('renders loading and error states',()=>{const {rerender}=render(<ActivityOverview records={ACTIVITIES} loadState="loading"/>);expect(screen.getByRole('status')).toHaveTextContent('Loading activities');rerender(<ActivityOverview records={ACTIVITIES} loadState="error"/>);expect(screen.getByRole('alert')).toHaveTextContent('Unable to load activities');});
});
