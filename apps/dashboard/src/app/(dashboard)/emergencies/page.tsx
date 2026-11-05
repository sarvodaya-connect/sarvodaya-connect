import Link from "next/link";

import type { EmergencyIncidentList } from "@sarvodaya-connect/api-contracts";

import { primaryButtonClass } from "@/components/dashboard/data-states";
import { OpenIncidentPanel } from "@/components/dashboard/emergencies/open-incident-panel";
import { Badge } from "@/components/dashboard/emergencies/incident-view";
import { Icon } from "@/components/dashboard/icon";
import { getDesktopViewer } from "@/lib/current-viewer";
import { failureMessage, getIncidents } from "@/lib/emergency-api";
import { closedLine, dueLine, INCIDENT_TYPE_LABELS } from "@/lib/emergency-format";
import { shortDateTime } from "@/lib/home-format";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * V5 D30 (with "Open an incident" as `?panel=open`): incidents that cover the
 * user's societies, active or closed. Every desktop role opens this page;
 * the API decides which incidents each user sees.
 */
export default async function DisasterResponsePage({ searchParams }: PageProps<"/emergencies">) {
  const viewer = await getDesktopViewer();
  const params = await searchParams;
  const status = first(params.status) === "CLOSED" ? "CLOSED" : "ACTIVE";
  const panel = first(params.panel);
  const now = new Date();
  let list: EmergencyIncidentList | null = null;
  let error: string | null = null;
  try {
    list = await getIncidents(status);
  } catch (failure) {
    error = failureMessage(failure);
  }
  const th = "px-4 py-3 text-left text-[11px] font-medium text-muted";
  const td = "px-4 py-3.5 text-[12.5px] text-ink";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">Disaster Response</h1>
          <p className="text-[12.5px] text-ink-soft">Incidents, rapid assessments, response actions and situation reports · kept separate from society records</p>
        </div>
        <Link className={primaryButtonClass} href={`/emergencies?${status === "CLOSED" ? "status=CLOSED&" : ""}panel=open`}>
          <Icon className="size-4" name="alert" strokeWidth={2} />
          {viewer.role === "HQ_ADMIN" ? "Open an incident" : "Report an incident"}
        </Link>
      </div>

      <nav aria-label="Incident Status" className="flex gap-6 border-b border-line">
        {(["ACTIVE", "CLOSED"] as const).map((tab) => (
          <Link
            aria-current={tab === status ? "page" : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-[13px] ${tab === status ? "border-brand-forest font-bold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
            href={tab === "ACTIVE" ? "/emergencies" : "/emergencies?status=CLOSED"}
            key={tab}
          >
            {tab === "ACTIVE" ? "Active" : "Closed"}
            {list && <span className="rounded-pill bg-surface-muted px-1.5 text-[10px] font-semibold text-ink-soft">{tab === "ACTIVE" ? list.counts.active : list.counts.closed}</span>}
          </Link>
        ))}
      </nav>

      {error ? (
        <section className="rounded-card border border-[#efc4bd] bg-surface p-6" role="alert">
          <h2 className="text-[15px] font-bold text-ink">We Couldn’t Load the Incidents</h2>
          <p className="mt-1 text-[12.5px] text-ink-soft">{error}</p>
          <Link className="mt-3 inline-block text-[12.5px] font-semibold text-brand-forest underline underline-offset-2" href={`/emergencies${status === "CLOSED" ? "?status=CLOSED" : ""}`}>
            Try again
          </Link>
        </section>
      ) : !list?.data.length ? (
        <section className="rounded-card border border-line bg-surface p-8 text-center" role="status">
          <h2 className="text-[15px] font-bold text-ink">{status === "ACTIVE" ? "No active incidents" : "No closed incidents"}</h2>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            {status === "ACTIVE" ? "Incidents covering your societies appear here as soon as someone opens one." : "Closed incidents covering your societies appear here."}
          </p>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface-muted">
              <tr>
                <th className={th} scope="col">Incident</th>
                <th className={th} scope="col">Area</th>
                <th className={th} scope="col">Opened</th>
                <th className={th} scope="col">Assessed</th>
                <th className={th} scope="col">{status === "ACTIVE" ? "Assessments" : "Closed"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {list.data.map((incident) => (
                <tr key={incident.id}>
                  <td className={td}>
                    <Link className="font-semibold text-brand-forest underline underline-offset-2" href={`/emergencies/${incident.id}`}>{incident.title}</Link>
                    <span className="block text-[11px] text-ink-soft">{incident.reference} · {INCIDENT_TYPE_LABELS[incident.type]}</span>
                  </td>
                  <td className={td}>{incident.areaDistricts.map((d) => d.name).join(", ")}</td>
                  <td className={td}>
                    {shortDateTime(incident.openedAt)}
                    <span className="block text-[11px] text-ink-soft">{incident.openedBy.name ?? "—"}</span>
                  </td>
                  <td className={td}>{incident.assessed} of {incident.societiesInArea}</td>
                  <td className={td}>
                    {status === "ACTIVE" ? (
                      incident.assessmentsDueAt ? (dueLine(incident, now) ?? "").replace(/^assessments due /, "Due ") : "—"
                    ) : (
                      <>
                        <Badge tone="grey">Closed</Badge>
                        <span className="mt-1 block text-[11px] text-ink-soft">{closedLine(incident)}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {panel === "open" && (
        <OpenIncidentPanel closeHref={`/emergencies${status === "CLOSED" ? "?status=CLOSED" : ""}`} search={first(params.q)} viewer={viewer} />
      )}
    </div>
  );
}
