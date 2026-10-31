import Link from "next/link";
import { notFound } from "next/navigation";
import type { SocietyDetails } from "@sarvodaya-connect/api-contracts";
import { AccessDeniedState } from "@/components/dashboard/data-states";
import { DirectGradeChangeForm } from "@/components/dashboard/direct-grade-change-form";
import { getCurrentViewer } from "@/lib/current-viewer";
import { loadApiJson } from "@/lib/api-proxy";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export default async function SocietyPage({ params }: PageProps<"/societies/[id]">) {
  const [{ id }, viewer] = await Promise.all([params, getCurrentViewer()]);
  let society: SocietyDetails;
  try { society = await loadApiJson<SocietyDetails>(`/societies/${id}`, viewer); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("404")) notFound();
    if (message.includes("403") || message.includes("Forbidden")) return <AccessDeniedState role={viewer.roleLabel} description="This society is outside your assigned records or district." />;
    return <section className="rounded-card border border-line bg-surface p-6"><h2 className="font-semibold">Society record unavailable</h2><p className="mt-2 text-sm text-ink-soft">The record could not be loaded. Return to the directory and try again.</p><Link className="mt-4 inline-block text-sm text-[#2d5c88] underline" href="/societies">Back to societies</Link></section>;
  }
  return <>
    <nav aria-label="Breadcrumb" className="mb-3 flex gap-2 text-xs"><Link className="text-[#2d5c88] underline" href="/societies">Societies</Link><span aria-hidden="true">›</span><span aria-current="page">{society.nameEn}</span></nav>
    <header className="mb-5 rounded-card border border-line bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{society.nameEn}</h2><span className="rounded-full border border-line px-2 py-1 text-xs">{society.status.replaceAll("_", " ")}</span><span className="rounded-full border border-line px-2 py-1 text-xs font-semibold">Grade {society.grade ?? "Not recorded"}</span></div>{society.nameLocal && <p className="mt-1 text-sm text-ink-soft">{society.nameLocal}</p>}<p className="mt-1 text-xs text-muted">{society.societyCode} · {society.district.nameEn}{society.address.dsDivision ? ` · ${society.address.dsDivision} DS` : ""} · Updated {dateFormat.format(new Date(society.updatedAt))}</p></div>{viewer.role === "HQ_ADMIN" && <DirectGradeChangeForm grade={society.grade ?? "C"} societyId={society.id} />}{society.location && <a className="self-end text-sm text-[#2d5c88] underline" href={`https://www.google.com/maps?q=${society.location.latitude},${society.location.longitude}`} rel="noreferrer" target="_blank">View location</a>}</div></header>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-card border border-line bg-surface p-5"><h2 className="font-semibold">Society details</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{[["Established", society.establishedOn], ["Address", society.address.addressLine], ["Village", society.address.village], ["GN division", society.address.gnDivision], ["DS division", society.address.dsDivision]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1">{value ?? "Not recorded"}</dd></div>)}</dl></section>
      <section className="rounded-card border border-line bg-surface p-5"><h2 className="font-semibold">Contacts</h2>{society.contacts.length ? <ul className="mt-3 divide-y divide-line-soft">{society.contacts.map((contact) => <li className="py-3 text-sm" key={contact.id}><strong>{contact.fullName ?? contact.label ?? "Society contact"}</strong>{contact.position && ` · ${contact.position}`}{contact.phone && <p className="mt-1">{contact.phone}</p>}{contact.email && <p className="mt-1 text-ink-soft">{contact.email}</p>}</li>)}</ul> : <p className="mt-3 text-sm text-muted">No contacts are recorded.</p>}</section>
      <section className="rounded-card border border-line bg-surface p-5"><h2 className="font-semibold">Executive Council</h2>{society.committee.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">Name</th><th>Position</th><th>Status</th></tr></thead><tbody>{society.committee.map((member) => <tr className="border-t border-line-soft" key={member.id}><td className="py-2">{member.fullName}</td><td>{member.position}</td><td>{member.isActive ? "Active" : "Former"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-muted">No council members are recorded.</p>}</section>
      <section className="rounded-card border border-line bg-surface p-5"><h2 className="font-semibold">Membership</h2>{society.membership ? <><p className="mt-3 text-2xl font-bold">{society.membership.overallTotal.toLocaleString("en-GB")}</p><p className="text-xs text-muted">Recorded members · {society.membership.year}</p><ul className="mt-3 divide-y divide-line-soft">{society.membership.categories.map((row) => <li className="flex justify-between py-2 text-sm" key={row.category}><span>{row.category.replaceAll("_", " ")}</span><strong>{row.total.toLocaleString("en-GB")}</strong></li>)}</ul></> : <p className="mt-3 text-sm text-muted">Membership totals are not recorded.</p>}</section>
      <section className="rounded-card border border-line bg-surface p-5 xl:col-span-2"><h2 className="font-semibold">Grade history and audit</h2>{society.history.length ? <ol className="mt-4 space-y-3">{society.history.map((entry) => <li className="border-l-2 border-brand-leaf pl-3 text-sm" key={entry.id}><strong>{entry.summary}</strong><p className="mt-1 text-xs text-muted">{entry.actorDisplayName ?? "Staff member"} · {dateFormat.format(new Date(entry.occurredAt))}</p></li>)}</ol> : <p className="mt-3 text-sm text-muted">No grade changes are recorded.</p>}</section>
    </div>
  </>;
}
