import { ACTIVITIES } from './activity-data';
import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, SECTORS, filterActivities, summarizeActivities } from './activity-demo';
describe('SC-55 fictional activity dataset and filters', () => {
 it('provides ten distinct demo sectors and stable activities', () => { expect(SECTORS).toHaveLength(10); expect(new Set(SECTORS.map(s=>s.id)).size).toBe(10); expect(ACTIVITIES).toHaveLength(40); expect(ACTIVITIES[0].id).toBe('ACT-2026-0001'); });
 it('filters by district and dependent society', () => {const a=filterActivities(ACTIVITIES,{...EMPTY_FILTERS,district:'Kurunegala',society:'Pahala Kosgama Sarvodaya Shramadana Society'});expect(a.length).toBeGreaterThan(0); expect(a.every(x=>x.district==='Kurunegala'&&x.society==='Pahala Kosgama Sarvodaya Shramadana Society')).toBe(true); });
 it('filters sector, date boundaries and status', () => {const a=filterActivities(ACTIVITIES,{...EMPTY_FILTERS,sector:'education',status:'APPROVED',from:'2026-01-01',to:'2026-06-30'});expect(a.length).toBeGreaterThan(0);expect(a.every(x=>x.sectorId==='education'&&x.status==='APPROVED'&&x.date>='2026-01-01'&&x.date<='2026-06-30')).toBe(true);});
 it('searches case insensitively and returns an empty array for impossible matches',()=>{expect(filterActivities(ACTIVITIES,{...EMPTY_FILTERS,search:'ACT-2026-0001'})).toHaveLength(1);expect(filterActivities(ACTIVITIES,{...EMPTY_FILTERS,search:'NO MATCH XYZ'})).toEqual([]);});
 it('only counts approved participants in approved totals',()=>{const stats=summarizeActivities(ACTIVITIES);expect(stats.approved).toBe(ACTIVITIES.filter(a=>a.status==='APPROVED').length);expect(stats.participantsApproved).toBe(ACTIVITIES.filter(a=>a.status==='APPROVED').reduce((sum,a)=>sum+a.participants,0));expect(stats.byDimension.reduce((sum,d)=>sum+d.count,0)).toBe(ACTIVITIES.length);});
});
