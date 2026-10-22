import "server-only";

import type { EmergencyIncident, EmergencyIncidentDetail } from "@sarvodaya-connect/api-contracts";
import type { DemoViewer } from "./access";

export type IncidentRecord = EmergencyIncidentDetail;

export type EmergencyData =
  | { available: true; incidents: IncidentRecord[] }
  | { available: false; incidents: []; message: string };

const DEMO_API_USERS = {
  HQ_ADMIN: "demo-hq-admin",
  DISTRICT_MANAGER: "demo-dm-north",
  PROGRAMME_COORDINATOR: "demo-programme-coordinator",
} as const;

function demoApiUser(viewer: DemoViewer) {
  return DEMO_API_USERS[viewer.role as keyof typeof DEMO_API_USERS];
}

function apiUrl(path: string) {
  const base = process.env.API_BASE_URL?.trim() || "http://localhost:3001/api/v1";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function getEmergencyData(viewer: DemoViewer): Promise<EmergencyData> {
  const user = demoApiUser(viewer);
  if (!user) return { available: false, incidents: [], message: "This role does not have emergency-response access." };
  try {
    const response = await fetch(apiUrl("/emergencies/incidents"), {
      headers: { "X-Demo-User": user },
      cache: "no-store",
    });
    if (!response.ok) return { available: false, incidents: [], message: `The local API returned ${response.status}. Check its logs and sign-in role.` };
    const rows = (await response.json()) as EmergencyIncident[];
    const incidents = await Promise.all(rows.map(async (incident) => {
      const detail = await fetch(apiUrl(`/emergencies/incidents/${incident.id}`), {
        headers: { "X-Demo-User": user },
        cache: "no-store",
      });
      if (!detail.ok) throw new Error(`The local API returned ${detail.status} while loading incident details.`);
      const records = await detail.json() as Pick<EmergencyIncidentDetail, "assessments" | "actions" | "reports">;
      return { ...incident, ...records };
    }));
    return { available: true, incidents };
  } catch {
    return { available: false, incidents: [], message: "The local API is unavailable. Start the NestJS API and PostgreSQL, then refresh this page." };
  }
}

export function emergencyApiUrl(path: string) {
  return apiUrl(path);
}

export function emergencyApiDemoUser(viewer: DemoViewer) {
  return demoApiUser(viewer);
}
