import {
  actorReference,
  toAmount,
} from '../societies/society-record.mappers.js';

type DecimalValue = Parameters<typeof toAmount>[0];

/** A work_plan_activities row with its chosen UN SDGs. */
export interface ActivityRecord {
  id: string;
  societyId: string;
  year: number;
  month: number;
  name: string;
  description: string;
  sector: string | null;
  datesLabel: string | null;
  allocatedCost: DecimalValue;
  dimension: string | null;
  status: string;
  femaleParticipants: number | null;
  maleParticipants: number | null;
  youthParticipants: number | null;
  householdsBenefited: number | null;
  womenHeadedHouseholds: number | null;
  partners: string | null;
  resourcesNeeded: string | null;
  volunteerHours: number | null;
  createdByName: string | null;
  createdByRole: string | null;
  submittedAt: Date | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  sdgs: { sdg: number }[];
}

const optional = <K extends string, V>(key: K, value: V | null | undefined) =>
  (value == null ? {} : { [key]: value }) as Partial<Record<K, V>>;

/** The WorkPlanActivity contract in packages/api-contracts. */
export function toWorkPlanActivity(row: ActivityRecord) {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    name: row.name,
    description: row.description,
    ...optional('sector', row.sector),
    ...optional('datesLabel', row.datesLabel),
    allocatedCost: toAmount(row.allocatedCost) ?? 0,
    status: row.status,
    ...optional('dimension', row.dimension),
    sdgs: row.sdgs.map((entry) => entry.sdg),
    ...optional('femaleParticipants', row.femaleParticipants),
    ...optional('maleParticipants', row.maleParticipants),
    ...optional('youthParticipants', row.youthParticipants),
    ...optional('householdsBenefited', row.householdsBenefited),
    ...optional('womenHeadedHouseholds', row.womenHeadedHouseholds),
    ...optional('partners', row.partners),
    ...optional('resourcesNeeded', row.resourcesNeeded),
    ...optional('volunteerHours', row.volunteerHours),
    ...(row.createdByName
      ? { createdBy: actorReference(row.createdByName, row.createdByRole) }
      : {}),
    ...optional('submittedAt', row.submittedAt?.toISOString()),
    ...(row.reviewedAt && row.reviewedByName
      ? {
          review: {
            by: actorReference(row.reviewedByName, 'PROGRAMME_COORDINATOR'),
            at: row.reviewedAt.toISOString(),
            ...optional('comment', row.reviewComment),
          },
        }
      : {}),
  };
}

/** Female plus male participants; youth are counted inside these. */
export function totalParticipants(row: {
  femaleParticipants: number | null;
  maleParticipants: number | null;
}) {
  return (row.femaleParticipants ?? 0) + (row.maleParticipants ?? 0);
}

/** SP06 / M50 queue row. */
export function toQueueItem(
  row: ActivityRecord & {
    society: { id: string; nameEn: string; societyCode: string };
  },
) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    year: row.year,
    month: row.month,
    society: {
      id: row.society.id,
      name: row.society.nameEn,
      societyCode: row.society.societyCode,
    },
    ...(row.createdByName
      ? { sentBy: actorReference(row.createdByName, row.createdByRole) }
      : {}),
    ...optional('submittedAt', row.submittedAt?.toISOString()),
    totalParticipants: totalParticipants(row),
    ...optional('householdsBenefited', row.householdsBenefited),
    sdgs: row.sdgs.map((entry) => entry.sdg),
    ...(row.status === 'APPROVED'
      ? optional('approvedAt', row.reviewedAt?.toISOString())
      : {}),
  };
}
