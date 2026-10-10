"use client";

import { useState } from "react";

import type { SocietyDetails } from "@sarvodaya-connect/api-contracts";

import { StatusPill } from "./status-pill";

const tabs = ["Profile", "Committee", "Documents", "History"] as const;
type Tab = (typeof tabs)[number];

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function SocietyProfileTabs({ society }: { society: SocietyDetails }) {
  const [activeTab, setActiveTab] = useState<Tab>("Profile");
  const primaryContact = society.contacts.find((contact) => contact.isPrimary);

  return (
    <section className="overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
      <div className="flex overflow-x-auto border-b border-[#e2e7e0] px-4">
        {tabs.map((tab) => (
          <button
            className={`border-b-2 px-4 py-3.5 text-sm font-medium transition ${activeTab === tab ? "border-[#26744b] text-[#174a32]" : "border-transparent text-[#6c7971] hover:text-[#304038]"}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Profile" && (
        <div className="grid gap-8 p-6 lg:grid-cols-[1fr_1fr_320px]">
          <InfoGroup title="Registration">
            <Info label="Society ID" value={society.societyCode} />
            <Info label="Established" value={formatDate(society.establishedOn)} />
            <Info label="Status" value={<StatusPill value={society.status} />} />
            <Info label="Verification" value={<StatusPill value={society.verificationStatus} />} />
          </InfoGroup>
          <InfoGroup title="Address and contact">
            <Info label="Address" value={[society.address.addressLine, society.address.village].filter(Boolean).join(", ")} />
            <Info label="District" value={society.district.nameEn} />
            <Info label="Primary contact" value={primaryContact?.fullName ?? "Not recorded"} />
            <Info label="Telephone" value={primaryContact?.phone ?? "Not recorded"} />
          </InfoGroup>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#68756c]">Location</h3>
            <div className="relative mt-4 h-44 overflow-hidden rounded-xl border border-[#d8e3d7] bg-[#e7f0df]">
              <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(#b7cfb2 1px, transparent 1px), linear-gradient(90deg, #b7cfb2 1px, transparent 1px)", backgroundSize: "28px 28px", transform: "rotate(-8deg) scale(1.2)" }} />
              <div className="absolute left-[58%] top-[42%] grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#1f6b43] text-sm text-white shadow-lg ring-4 ring-white/80">●</div>
              <span className="absolute bottom-3 left-3 rounded bg-white/90 px-2 py-1 text-[10px] font-medium text-[#53645a]">{society.location?.latitude}, {society.location?.longitude}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Committee" && (
        <div className="overflow-x-auto p-6">
          <table className="w-full min-w-[680px] text-left">
            <thead className="text-[10px] uppercase tracking-[0.1em] text-[#748078]"><tr><th className="pb-3">Position</th><th className="pb-3">Name</th><th className="pb-3">Phone</th><th className="pb-3">Start date</th><th className="pb-3">Contact</th></tr></thead>
            <tbody className="divide-y divide-[#edf0eb]">
              {society.committee.map((member) => (
                <tr key={member.id}><td className="py-3 text-sm font-medium text-[#2a3930]">{member.position}</td><td className="py-3 text-sm text-[#4f5d54]">{member.fullName}</td><td className="py-3 text-sm text-[#4f5d54]">{member.phone}</td><td className="py-3 text-sm text-[#4f5d54]">{formatDate(member.appointedOn)}</td><td className="py-3">{primaryContact?.fullName === member.fullName ? <span className="rounded-full bg-[#e5f3e8] px-2 py-1 text-[10px] font-semibold text-[#25643f]">Primary contact</span> : <span className="text-xs text-[#8a958e]">—</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "Documents" && (
        <div className="overflow-x-auto p-6">
          <table className="w-full min-w-[680px] text-left">
            <thead className="text-[10px] uppercase tracking-[0.1em] text-[#748078]"><tr><th className="pb-3">Document</th><th className="pb-3">Type</th><th className="pb-3">Uploaded by</th><th className="pb-3">Uploaded</th><th className="pb-3">Status</th></tr></thead>
            <tbody className="divide-y divide-[#edf0eb]">{society.documents.map((document) => <tr key={document.id}><td className="py-3 text-sm font-medium text-[#2a3930]">{document.fileName}</td><td className="py-3 text-xs text-[#59675e]">{document.documentType.replaceAll("_", " ")}</td><td className="py-3 text-sm text-[#59675e]">{document.uploadedBy}</td><td className="py-3 text-sm text-[#59675e]">{formatDate(document.uploadedAt)}</td><td className="py-3"><StatusPill value={document.status} /></td></tr>)}</tbody>
          </table>
        </div>
      )}

      {activeTab === "History" && (
        <div className="space-y-0 p-6">
          {society.history.map((event, index) => (
            <div className="grid grid-cols-[24px_1fr] gap-3" key={event.id}>
              <div className="flex flex-col items-center"><span className="mt-1 size-2.5 rounded-full bg-[#2f7c4f] ring-4 ring-[#e6f0e7]" />{index < society.history.length - 1 && <span className="h-full w-px bg-[#dce5db]" />}</div>
              <div className="pb-6"><strong className="text-sm text-[#2a3930]">{event.summary}</strong><p className="mt-1 text-xs text-[#758178]">{event.actorDisplayName} · {formatDate(event.occurredAt)}</p></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function InfoGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return <div><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#68756c]">{title}</h3><dl className="mt-4 space-y-4">{children}</dl></div>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs text-[#849087]">{label}</dt><dd className="mt-1 text-sm font-medium text-[#2b3a31]">{value || "Not recorded"}</dd></div>;
}
