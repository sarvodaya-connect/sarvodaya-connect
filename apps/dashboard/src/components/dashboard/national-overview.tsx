"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, TableSkeleton } from "./data-states";
import { NationalActivityBreakdown, NationalSocietyMap } from "./national-support";

type Overview = {
  asOf: string;
  registeredSocieties: number;
  activeSocieties: number;
  gradeCounts: { A: number; B: number; C: number };
  pendingGradeRequests: Array<{ id: string; societyId: string; societyName: string; societyCode: string; district: { id: string; nameEn: string }; currentGrade: "A" | "B" | "C"; proposedGrade: "A" | "B" | "C"; requestedByName: string; requestedAt: string }>;
  pendingGradeRequestCount: number;
  activeDdmDelegations: number;
  districts: Array<{ id: string; code: string; nameEn: string; active: number; grades: { A: number; B: number; C: number }; stale: number }>;
  latestChanges: Array<{ id: string; societyId: string; societyName: string; societyCode: string; districtName: string; eventType: string; summary: string; actorName: string; occurredAt: string }>;
  locations: Array<{ id: string; nameEn: string; societyCode: string; grade: "A" | "B" | "C"; latitude: number; longitude: number; districtName: string }>;
  staleSocieties: number;
  annualPlanCoverage: null;
  accountActivation: null;
  activeIncident: null | { title: string; districtName: string; activatedAt: string; assessmentCount: number; actionCount: number };
};

const gradeDescription = { A: "Strong", B: "Developing", C: "Needs strengthening" } as const;
const sections = ["Grades", "Grade requests", "Accounts", "Map by grade", "Districts", "Activity", "Latest changes"];

function Panel({ number, title, children, action }: { number: number; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="rounded-card border border-line bg-surface"><header className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3"><h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-brand-forest"><span className="grid size-5 place-items-center rounded-full bg-brand-forest text-[10px] text-white">{number}</span>{title}</h2>{action}</header><div className="p-4">{children}</div></section>;
}

export function NationalOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError(false);
    try {
      const response = await fetch("/api/dashboard/national-overview", { cache: "no-store" });
      if (!response.ok) throw new Error("National overview unavailable");
      setData(await response.json() as Overview);
    } catch { setError(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  if (loading) return <div className="space-y-4"><header><h2 className="text-xl font-bold">National overview</h2><p className="mt-1 text-xs text-muted">Society registry · All districts</p></header><TableSkeleton columns={5} label="Loading national overview" rows={6} /></div>;
  if (error || !data) return <section className="rounded-card border border-line bg-surface"><ErrorState onRetry={() => void load()} title="National overview unavailable" /></section>;

  const totalGrades = data.gradeCounts.A + data.gradeCounts.B + data.gradeCounts.C;
  const gradeRows = (["A", "B", "C"] as const).map((grade) => ({ grade, count: data.gradeCounts[grade] }));
  const oldestWaiting = data.pendingGradeRequests[0]?.requestedAt;
  return <>
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-ink">National overview</h2><p className="mt-1 text-xs text-ink-soft">All {data.districts.length} districts · Updated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.asOf))}</p></div><span className="rounded-md border border-[#e5d59f] bg-[#fff9e9] px-2.5 py-1 text-[11px] font-semibold text-[#755a08]">HQ · National</span></header>
    <nav aria-label="Dashboard sections" className="mb-4 flex flex-wrap gap-2">{sections.map((label, index) => <a className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:border-brand-leaf hover:text-brand-forest" href={`#national-section-${index + 1}`} key={label}>{index + 1} · {label}</a>)}</nav>
    {data.activeIncident && <section aria-label="Active incident" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-[#ead9a7] bg-[#fff9e9] px-4 py-3 text-sm"><p><strong>{data.activeIncident.title} · {data.activeIncident.districtName}.</strong> {data.activeIncident.assessmentCount} assessments · {data.activeIncident.actionCount} response actions.</p><Link className="font-semibold text-[#2d5c88] underline" href="/notifications">Open disaster response</Link></section>}
    <section aria-label="National summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
      { label: "Active societies", value: data.activeSocieties.toLocaleString("en-GB"), detail: `of ${data.registeredSocieties.toLocaleString("en-GB")} registered` },
      { label: "Grade requests waiting", value: String(data.pendingGradeRequestCount), detail: oldestWaiting ? `Oldest ${Math.max(0, Math.floor((Date.now() - Date.parse(oldestWaiting)) / 86400000))} days` : "No requests waiting" },
      { label: "Accounts not activated", value: "—", detail: "Account data unavailable" },
      { label: "Temporary DDM access", value: String(data.activeDdmDelegations), detail: "Active · view only" },
      { label: "Societies with a current plan", value: "—", detail: "Plan data unavailable" },
    ].map((item) => <div className="rounded-card border border-line bg-surface p-4" key={item.label}><p className="text-xs text-muted">{item.label}</p><strong className="mt-2 block text-3xl font-bold text-brand-forest">{item.value}</strong><p className="mt-1 text-xs text-ink-soft">{item.detail}</p></div>)}</section>
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <div id="national-section-1"><Panel number={1} title="Grades of active societies"><div className="grid gap-4 sm:grid-cols-[1fr_1.3fr]"><div><div aria-label={`Grade distribution across ${totalGrades} active societies`} className="flex h-4 overflow-hidden rounded-full" role="img">{gradeRows.map(({ grade, count }) => <span key={grade} style={{ width: `${totalGrades ? count / totalGrades * 100 : 0}%`, backgroundColor: grade === "A" ? "#268c43" : grade === "B" ? "#f0c328" : "#e88b2d" }} />)}</div><p className="mt-2 text-xs text-muted">{totalGrades.toLocaleString("en-GB")} societies with a recorded grade</p></div><ul className="grid grid-cols-3 gap-2">{gradeRows.map(({ grade, count }) => <li className="rounded-lg bg-surface-muted p-3" key={grade}><strong className="text-xl">{grade} · {count.toLocaleString("en-GB")}</strong><span className="mt-1 block text-[11px] text-ink-soft">{gradeDescription[grade]}</span></li>)}</ul></div></Panel></div>
      <div id="national-section-2"><Panel number={2} title="Waiting for HQ" action={<Link className="text-xs font-semibold text-[#2d5c88] underline" href="/grade-changes">Open queue ({data.pendingGradeRequestCount})</Link>}>{data.pendingGradeRequests.length ? <div className="space-y-3">{data.pendingGradeRequests.map((request) => <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-3" key={request.id}><div><p className="text-sm font-semibold">{request.currentGrade} → {request.proposedGrade} · {request.societyName}</p><p className="mt-1 text-xs text-muted">{request.district.nameEn} · {request.requestedByName}</p></div><Link className="rounded-button bg-brand-forest px-3 py-1.5 text-xs font-semibold text-white" href={`/grade-changes/${request.id}`}>Review</Link></div>)}</div> : <EmptyState title="No grade requests waiting" description="New requests from assigned Society Officers, SPCs and DDMs will appear here." />}</Panel></div>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <div id="national-section-3"><Panel number={3} title="Account activation"><p className="rounded-lg bg-surface-muted px-3 py-5 text-sm text-ink-soft">Account activation details aren&apos;t available in the connected identity service.</p></Panel></div>
      <div id="national-section-4"><Panel number={4} title="Map by grade"><NationalSocietyMap locations={data.locations} /></Panel></div>
    </div>
    <div id="national-section-5" className="mt-4"><Panel number={5} title="District overview"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-xs text-muted"><tr>{["District", "Active", "A / B / C", "Not updated 90+ days", "Annual plan"].map((label) => <th className="border-b border-line px-3 py-2 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{data.districts.map((district) => <tr key={district.id}><th className="border-b border-line-soft px-3 py-3 font-semibold">{district.nameEn}</th><td className="border-b border-line-soft px-3 py-3">{district.active}</td><td className="border-b border-line-soft px-3 py-3">{district.grades.A} / {district.grades.B} / {district.grades.C}</td><td className="border-b border-line-soft px-3 py-3">{district.stale}</td><td className="border-b border-line-soft px-3 py-3">—</td></tr>)}</tbody></table></div></Panel></div>
    <div id="national-section-6" className="mt-4"><Panel number={6} title="Activity status · done vs planned"><NationalActivityBreakdown /></Panel></div>
    <div id="national-section-7" className="mt-4"><Panel number={7} title="Latest changes">{data.latestChanges.length ? <ul className="divide-y divide-line-soft">{data.latestChanges.map((entry) => <li className="py-3 text-sm text-ink-soft" key={entry.id}><strong>{entry.summary}</strong> · {entry.societyName} · {entry.actorName} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.occurredAt))}</li>)}</ul> : <EmptyState title="No recorded changes" description="Society grade changes and requests will appear here." />}</Panel></div>
  </>;
}
