import { redirect } from "next/navigation";
import { PageHeading } from "@/components/dashboard/page-heading";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getEmergencyData } from "@/lib/emergency-api";
import { activateIncident, createResponseAction, submitSituationReport, updateActionStatus, updateIncidentStatus } from "./actions";

const districts = [
  ["29000000-0000-4000-8000-000000000001", "Fictional North District"],
  ["29000000-0000-4000-8000-000000000002", "Fictional Central District"],
  ["29000000-0000-4000-8000-000000000003", "Fictional South District"],
] as const;

const fieldClass = "mt-1 block w-full rounded-lg border border-[#cfdbce] bg-white px-3 py-2.5 text-sm";
const buttonClass = "rounded-lg bg-[#1f6b43] px-4 py-2.5 text-sm font-semibold text-white";

export default async function EmergencyResponsePage() {
  const viewer = await getCurrentViewer();
  if (viewer.role === "SYSTEM_ADMIN") redirect("/admin");
  const result = await getEmergencyData(viewer);
  const canCoordinate = viewer.role === "HQ_ADMIN" || viewer.role === "DISTRICT_MANAGER";
  const canAssignActions = canCoordinate || viewer.role === "PROGRAMME_COORDINATOR";
  const districtChoices = viewer.role === "DISTRICT_MANAGER" ? districts.slice(0, 1) : districts;

  return <div className="space-y-6">
    <PageHeading title="Emergency response" description="Activate incidents, collect scoped impact assessments, coordinate response actions and submit situation reports." />
    <div className="rounded-xl border border-[#eed9a8] bg-[#fff8e8] p-4 text-sm text-[#705519]">
      Local development workflow · fictional data only · role and record scope are enforced by the NestJS API.
    </div>

    {canCoordinate && <section className="rounded-2xl border border-[#dfe5dc] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#123d29]">Activate an incident</h2>
      <p className="mt-1 text-sm text-[#68756c]">Creates a durable incident record for the selected district.</p>
      <form action={activateIncident} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">District<select className={fieldClass} name="districtId">{districtChoices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-sm font-medium">Incident type<select className={fieldClass} name="type"><option>FLOOD</option><option>LANDSLIDE</option><option>CYCLONE</option><option>DROUGHT</option><option>FIRE</option><option>PUBLIC_HEALTH</option><option>OTHER</option></select></label>
        <label className="text-sm font-medium">Title<input className={fieldClass} name="title" maxLength={160} required /></label>
        <label className="text-sm font-medium">Severity<select className={fieldClass} name="severity"><option>MODERATE</option><option>LOW</option><option>HIGH</option><option>CRITICAL</option></select></label>
        <label className="text-sm font-medium sm:col-span-2">Location<input className={fieldClass} name="location" maxLength={200} required /></label>
        <label className="text-sm font-medium sm:col-span-2">Situation overview<textarea className={fieldClass} name="description" maxLength={4000} rows={3} required /></label>
        <div><button className={buttonClass} type="submit">Activate incident</button></div>
      </form>
    </section>}

    <section aria-label="Emergency incidents">
      <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#123d29]">Incidents in your scope</h2><p className="text-sm text-[#68756c]">Live records from the local API and PostgreSQL.</p></div><span className="rounded-full bg-[#edf4e9] px-3 py-1 text-xs font-semibold text-[#275f3a]">{result.available ? `${result.incidents.length} incidents` : "API unavailable"}</span></div>
      {!result.available ? <div role="alert" className="rounded-xl border border-amber-200 bg-white p-5"><h3 className="font-semibold text-[#123d29]">Can’t load emergency records</h3><p className="mt-1 text-sm text-[#68756c]">{result.message}</p></div> : result.incidents.length === 0 ? <div role="status" className="rounded-xl border border-[#dfe5dc] bg-white p-8 text-center"><h3 className="font-semibold">No incidents in your scope</h3><p className="mt-1 text-sm text-[#68756c]">Active incidents will appear here when they are reported or activated.</p></div> : <div className="space-y-4">
        {result.incidents.map((incident) => <article key={incident.id} className="rounded-2xl border border-[#dfe5dc] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-[#123d29]">{incident.title}</h3><span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">{incident.severity}</span><span className="rounded-full bg-[#edf4e9] px-2.5 py-1 text-xs font-semibold text-[#275f3a]">{incident.status}</span></div><p className="mt-1 text-sm text-[#68756c]">{incident.type.replaceAll("_", " ")} · {incident.district.nameEn} · {incident.location}</p><p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm">{incident.description}</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#53645a]"><span className="rounded-lg bg-[#f5f8f3] px-3 py-2">{incident._count.assessments} assessments</span><span className="rounded-lg bg-[#f5f8f3] px-3 py-2">{incident._count.actions} response actions</span><span className="rounded-lg bg-[#f5f8f3] px-3 py-2">{incident._count.reports} situation reports</span><span className="rounded-lg bg-[#f5f8f3] px-3 py-2">Activated {new Date(incident.activatedAt).toLocaleString("en-GB", { timeZone: "Asia/Colombo" })}</span></div>
          {canCoordinate && <form action={updateIncidentStatus} className="mt-4 flex flex-wrap items-center gap-2"><input type="hidden" name="incidentId" value={incident.id} /><label className="text-sm">Incident status<select className="ml-2 rounded-lg border border-[#cfdbce] bg-white px-3 py-2" name="status" defaultValue={incident.status}><option>ACTIVE</option><option>CONTAINED</option><option>CLOSED</option></select></label><button className="rounded-lg border border-[#cfdbce] px-3 py-2 text-sm font-semibold text-[#1f6b43]" type="submit">Update status</button></form>}
          <div className="mt-4 grid gap-4 border-t border-[#e8ede6] pt-4 lg:grid-cols-3">
            <section><h4 className="font-semibold text-[#123d29]">Rapid assessments</h4>{incident.assessments.length === 0 ? <p className="mt-2 text-sm text-[#68756c]">No assessments yet.</p> : <ul className="mt-2 space-y-2">{incident.assessments.map((assessment) => <li key={assessment.id} className="rounded-lg bg-[#f8faf7] p-3 text-sm"><p className="font-medium">{assessment.society?.nameEn ?? "Scoped society"} · {assessment.status}</p><p className="mt-1 text-[#53645a]">{assessment.peopleAffected} people · {assessment.householdsAffected} households · {assessment.displacedPeople} displaced</p>{assessment.urgentNeeds && <p className="mt-1 text-[#53645a]">Needs: {assessment.urgentNeeds}</p>}</li>)}</ul>}</section>
            <section><h4 className="font-semibold text-[#123d29]">Response actions</h4>{incident.actions.length === 0 ? <p className="mt-2 text-sm text-[#68756c]">No actions yet.</p> : <ul className="mt-2 space-y-2">{incident.actions.map((action) => <li key={action.id} className="rounded-lg bg-[#f8faf7] p-3 text-sm"><p className="font-medium">{action.title} · {action.status}</p>{action.description && <p className="mt-1 text-[#53645a]">{action.description}</p>}{canCoordinate && <form action={updateActionStatus} className="mt-2 flex items-center gap-2"><input type="hidden" name="actionId" value={action.id} /><select className="rounded-lg border border-[#cfdbce] bg-white px-2 py-1" name="status" defaultValue={action.status}><option>PLANNED</option><option>IN_PROGRESS</option><option>COMPLETED</option><option>CANCELLED</option></select><button className="rounded-lg border border-[#cfdbce] px-2 py-1 font-semibold text-[#1f6b43]" type="submit">Update</button></form>}</li>)}</ul>}</section>
            <section><h4 className="font-semibold text-[#123d29]">Situation reports</h4>{incident.reports.length === 0 ? <p className="mt-2 text-sm text-[#68756c]">No reports yet.</p> : <ul className="mt-2 space-y-2">{incident.reports.map((report) => <li key={report.id} className="rounded-lg bg-[#f8faf7] p-3 text-sm"><p className="font-medium">{report.status} · {new Date(report.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" })}</p><p className="mt-1 text-[#53645a]">{report.summary}</p>{report.needs && <p className="mt-1 text-[#53645a]">Needs: {report.needs}</p>}</li>)}</ul>}</section>
          </div>
          <div className="mt-4 grid gap-4 border-t border-[#e8ede6] pt-4 lg:grid-cols-2">
            {canAssignActions && <form action={createResponseAction} className="space-y-3 rounded-xl bg-[#f8faf7] p-4"><h4 className="font-semibold text-[#123d29]">Assign a response action</h4><input type="hidden" name="incidentId" value={incident.id} />{viewer.role === "PROGRAMME_COORDINATOR" && <input type="hidden" name="societyId" value="29000000-0000-4000-8000-000000000101" />}<label className="block text-sm">Action title<input className={fieldClass} name="title" maxLength={160} required /></label><label className="block text-sm">Details<textarea className={fieldClass} name="description" maxLength={2000} rows={2} /></label><button className={buttonClass} type="submit">Add action</button></form>}
            <form action={submitSituationReport} className="space-y-3 rounded-xl bg-[#f8faf7] p-4"><h4 className="font-semibold text-[#123d29]">Submit situation report</h4><input type="hidden" name="incidentId" value={incident.id} />{viewer.role === "PROGRAMME_COORDINATOR" && <input type="hidden" name="societyId" value="29000000-0000-4000-8000-000000000101" />}<label className="block text-sm">Current situation<textarea className={fieldClass} name="summary" maxLength={4000} rows={2} required /></label><label className="block text-sm">Urgent needs<textarea className={fieldClass} name="needs" maxLength={2000} rows={2} /></label><button className={buttonClass} type="submit">Submit report</button></form>
          </div>
        </article>)}
      </div>}
    </section>
  </div>;
}
