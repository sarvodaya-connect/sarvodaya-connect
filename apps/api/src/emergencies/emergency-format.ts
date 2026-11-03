/**
 * V5 PR 8: pure helpers for disaster response. Status and counts are worked
 * out from the database on every request; nothing here keeps state.
 */

/** "INC-2026-09": the year it was opened (Sri Lanka time) and its number. */
export function incidentReference(referenceNumber: number, openedAt: Date) {
  const year = new Date(openedAt.getTime() + 330 * 60_000).getUTCFullYear();
  return `INC-${year}-${String(referenceNumber).padStart(2, '0')}`;
}

export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  FLOOD: 'Floods',
  LANDSLIDE: 'Landslide',
  CYCLONE: 'Cyclone',
  DROUGHT: 'Drought',
  FIRE: 'Fire',
  PUBLIC_HEALTH: 'Public health',
  OTHER: 'Incident',
};

/** The default name when the opener gives none: "Floods — Kurunegala, Puttalam". */
export function defaultIncidentTitle(type: string, districtNames: string[]) {
  return `${INCIDENT_TYPE_LABELS[type] ?? 'Incident'} — ${districtNames.join(', ')}`.slice(
    0,
    160,
  );
}

export type HelperStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'DELIVERED';
export type ActionState = 'NEEDED' | HelperStatus;

/**
 * A need with no helper yet is Needed; when every helper has delivered it is
 * Delivered; once any delivery has started it is In progress; otherwise Assigned.
 */
export function actionState(
  helpers: { status: HelperStatus; deliveredQuantity: number }[],
): ActionState {
  if (!helpers.length) return 'NEEDED';
  if (helpers.every((h) => h.status === 'DELIVERED')) return 'DELIVERED';
  if (
    helpers.some(
      (h) =>
        h.status === 'IN_PROGRESS' ||
        h.status === 'DELIVERED' ||
        h.deliveredQuantity > 0,
    )
  )
    return 'IN_PROGRESS';
  return 'ASSIGNED';
}

/** Straight-line distance in whole kilometres, or null without both locations. */
export function distanceKm(
  from: { latitude: number | null; longitude: number | null },
  to: { latitude: number | null; longitude: number | null },
): number | null {
  if (
    from.latitude == null ||
    from.longitude == null ||
    to.latitude == null ||
    to.longitude == null
  )
    return null;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(to.latitude - from.latitude);
  const dLon = rad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.latitude)) *
      Math.cos(rad(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Assessments are due two days after the incident started unless the opener sets a time. */
export const DEFAULT_ASSESSMENT_WINDOW_MS = 48 * 3_600_000;

/** The start time may be up to an hour ahead (clock drift) and at most 30 days back. */
export function startedAtProblem(startedAt: Date, now: Date): string | null {
  if (startedAt.getTime() > now.getTime() + 3_600_000)
    return 'The start time cannot be in the future';
  if (startedAt.getTime() < now.getTime() - 30 * 86_400_000)
    return 'The start time must be within the last 30 days';
  return null;
}

/** Audit actions shown in the incident history (IR01) and the society change log. */
export const INCIDENT_EVENTS = [
  'INCIDENT_OPENED',
  'INCIDENT_ASSESSMENT_SENT',
  'INCIDENT_NEED_ADDED',
  'INCIDENT_HELPERS_ASSIGNED',
  'INCIDENT_DELIVERY_UPDATED',
  'INCIDENT_REMINDER_SENT',
  'INCIDENT_REPORT_CREATED',
  'INCIDENT_CLOSED',
] as const;
