import "server-only";

import type {
  EmergencyHelpingCandidate,
  EmergencyIncidentDetail,
  EmergencyIncidentList,
  EmergencySituationReport,
  EmergencySocietyPage,
  EmergencySocietyRef,
} from "@sarvodaya-connect/api-contracts";

import { platformApi } from "./platform-api";

/**
 * V5 PR 8: disaster response through the API. Every request is checked
 * against the signed-in user's own societies or district by the API.
 */
export function getIncidents(status: "ACTIVE" | "CLOSED"): Promise<EmergencyIncidentList> {
  return platformApi(`/emergencies/incidents?status=${status}`);
}

export function getIncident(id: string): Promise<EmergencyIncidentDetail> {
  return platformApi(`/emergencies/incidents/${encodeURIComponent(id)}`);
}

export function getIncidentSocieties(id: string, state: string, page: number): Promise<EmergencySocietyPage> {
  const query = new URLSearchParams({ state, page: String(page), pageSize: "50" });
  return platformApi(`/emergencies/incidents/${encodeURIComponent(id)}/societies?${query}`);
}

export function getSituationReport(id: string): Promise<EmergencySituationReport> {
  return platformApi(`/emergencies/situation-reports/${encodeURIComponent(id)}`);
}

export function getHelpingCandidates(actionId: string): Promise<EmergencyHelpingCandidate[]> {
  return platformApi(`/emergencies/actions/${encodeURIComponent(actionId)}/candidates`);
}

export type ReportOptions = {
  societies: (EmergencySocietyRef & { districtId: string })[];
  districts: { id: string; name: string }[];
};

/** The societies the user may report for (their own scope) and every district. */
export function getReportOptions(search?: string): Promise<ReportOptions> {
  const query = search ? `?${new URLSearchParams({ search: search.slice(0, 150) })}` : "";
  return platformApi(`/emergencies/report-options${query}`);
}

/** Message for a request that failed: the API's own words, or a general one. */
export function failureMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "The request could not be completed. Try again.";
}

/** The API answers "not found" for incidents outside the user's scope. */
export function isNotFound(error: unknown) {
  return error instanceof Error && /not found/i.test(error.message);
}
