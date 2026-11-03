import { Prisma } from '../generated/prisma/client.js';
import { auditReportDueDate } from '../documents/registrar-documents.service.js';
import { financialYear } from '../societies/financial-year.js';

const SRI_LANKA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** V5 D02 "Records not updated in 90+ days". */
export const STALE_AFTER_DAYS = 90;

export function staleCutoff(now = new Date()) {
  return new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS);
}

/** Months counted as year * 12 + month, in Sri Lanka time. */
export function monthIndex(now = new Date()) {
  const local = new Date(now.getTime() + SRI_LANKA_OFFSET_MS);
  return local.getUTCFullYear() * 12 + local.getUTCMonth() + 1;
}

export function calendarYear(now = new Date()) {
  return new Date(now.getTime() + SRI_LANKA_OFFSET_MS).getUTCFullYear();
}

export function period(startYear: number) {
  return financialYear(startYear);
}

/** The audit report is past due once the day after its due date starts in Sri Lanka. */
export function auditPastDue(startYear: number, now = new Date()) {
  return (
    now.getTime() >
    Date.parse(`${auditReportDueDate(startYear)}T23:59:59.999+05:30`)
  );
}

/**
 * A society record is complete when it has the eight fields the society list
 * has always counted (see `profileCompleteness` in the societies service):
 * founding date, address, village, GN and DS divisions, a primary contact's
 * name and phone, and its map position. `s` is the societies alias.
 */
export const RECORD_COMPLETE = Prisma.sql`(
  s.established_on IS NOT NULL AND s.address_line IS NOT NULL
  AND s.village IS NOT NULL AND s.gn_division IS NOT NULL
  AND s.ds_division IS NOT NULL
  AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM society_contacts c
    WHERE c.society_id = s.id AND c.is_primary
      AND c.full_name IS NOT NULL AND c.phone IS NOT NULL
  )
)`;

/**
 * Activities belong to the financial year their month falls in (April to
 * March). Only SPC-approved activities are counted. An approved activity
 * counts as completed once its month has ended; V5 has no separate
 * "completed" step (To Confirm). `a` is the work_plan_activities alias.
 */
export function approvedInYear(startYear: number) {
  return Prisma.sql`a.status = 'APPROVED'
    AND (CASE WHEN a.month >= 4 THEN a.year ELSE a.year - 1 END) = ${startYear}`;
}

export function completed(now = new Date()) {
  return Prisma.sql`(a.year * 12 + a.month) < ${monthIndex(now)}`;
}

export function percent(part: number, whole: number) {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export function pageMeta(page: number, pageSize: number, totalItems: number) {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
  };
}

/** "Kurunegala District"; names that already say "District" are kept as they are. */
export function districtLabel(name: string) {
  return /\bdistrict$/i.test(name) ? name : `${name} District`;
}
