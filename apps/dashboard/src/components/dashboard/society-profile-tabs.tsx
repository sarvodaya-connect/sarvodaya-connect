"use client";

import { useState } from "react";

import type { SocietyDetails } from "@sarvodaya-connect/api-contracts";

import { Pill } from "./ui/pill";
import { StatusPill } from "./status-pill";

const tabs = [
  "Overview",
  "Members",
  "Executive Council",
  "Submissions",
  "Documents",
  "Finance",
  "History",
] as const;
type Tab = (typeof tabs)[number];

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function SocietyProfileTabs({ society }: { society: SocietyDetails }) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const primaryContact = society.contacts.find((contact) => contact.isPrimary);
  const members = society.membership?.totalMembers ?? 612;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div
        className="flex overflow-x-auto border-b border-line-soft px-4"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={`whitespace-nowrap border-b-2 px-4 py-3.5 text-[13px] font-semibold transition ${
              activeTab === tab
                ? "border-brand-leaf text-brand-forest"
                : "border-transparent text-muted hover:text-ink-soft"
            }`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" && (
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
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Location</h3>
            <div className="relative mt-4 h-44 overflow-hidden rounded-card border border-line bg-brand-mint-soft">
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "linear-gradient(#b7cfb2 1px, transparent 1px), linear-gradient(90deg, #b7cfb2 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                  transform: "rotate(-8deg) scale(1.2)",
                }}
              />
              <div className="absolute left-[58%] top-[42%] grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand-action text-sm text-white shadow-lg ring-4 ring-white/80">
                ●
              </div>
              <span className="absolute bottom-3 left-3 rounded bg-white/90 px-2 py-1 text-[10px] font-medium text-ink-soft">
                {society.location?.latitude}, {society.location?.longitude}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Members" && (
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Total membership</h3>
            <p className="mt-2 text-[32px] font-bold text-ink">{members.toLocaleString("en-GB")}</p>
            <p className="mt-1 text-[12px] text-muted">Members across all categories · demonstration figures</p>
            <div className="mt-6 space-y-3">
              {[
                { label: "Child members (7–14)", pct: 20, value: Math.round(members * 0.2) },
                { label: "Youth members (15–25)", pct: 24, value: Math.round(members * 0.24) },
                { label: "Ordinary members (over 25)", pct: 46, value: Math.round(members * 0.46) },
                { label: "Life members", pct: 8, value: Math.round(members * 0.08) },
                { label: "Invited members", pct: 2, value: Math.round(members * 0.02) },
              ].map((row) => (
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_72px] items-center gap-3 text-[12px]" key={row.label}>
                  <span className="text-ink-soft">{row.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[#edf0e8]">
                    <span className="block h-full rounded-full bg-brand-leaf" style={{ width: `${row.pct}%` }} />
                  </span>
                  <strong className="text-right text-ink">{row.value.toLocaleString("en-GB")}</strong>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Gender distribution</h3>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full">
              <span className="w-[57%] bg-[#93458f]" />
              <span className="w-[43%] bg-[#28669a]" />
            </div>
            <div className="mt-2 flex justify-between text-[12px]">
              <span className="text-[#93458f]">● Female <strong>{Math.round(members * 0.57).toLocaleString("en-GB")} · 57%</strong></span>
              <span className="text-[#28669a]">● Male <strong>{Math.round(members * 0.43).toLocaleString("en-GB")} · 43%</strong></span>
            </div>
            <p className="mt-5 text-[11px] text-muted">Latest reported by the society on {formatDate(society.updatedAt)}.</p>
          </div>
        </div>
      )}

      {activeTab === "Executive Council" && (
        <div className="overflow-x-auto p-6">
          <table className="w-full min-w-[680px] text-left">
            <thead className="text-[11px] uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="pb-3">Position</th>
                <th className="pb-3">Name</th>
                <th className="pb-3">Phone</th>
                <th className="pb-3">Start date</th>
                <th className="pb-3">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {society.committee.map((member) => (
                <tr key={member.id}>
                  <td className="py-3 text-[13px] font-semibold text-ink">{member.position}</td>
                  <td className="py-3 text-[13px] text-ink-soft">{member.fullName}</td>
                  <td className="py-3 text-[13px] text-ink-soft">{member.phone}</td>
                  <td className="py-3 text-[13px] text-ink-soft">{formatDate(member.appointedOn)}</td>
                  <td className="py-3">
                    {primaryContact?.fullName === member.fullName ? (
                      <Pill dot={false} tone="approved">Primary contact</Pill>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "Submissions" && (
        <div className="p-6">
          <ul className="divide-y divide-line-soft">
            {society.history.slice(0, 5).map((event) => (
              <li className="flex items-center justify-between gap-3 py-3" key={event.id}>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{event.summary}</p>
                  <p className="text-[11px] text-muted">{event.actorDisplayName} · {formatDate(event.occurredAt)}</p>
                </div>
                <Pill tone="approved">Approved</Pill>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === "Documents" && (
        <div className="overflow-x-auto p-6">
          <table className="w-full min-w-[680px] text-left">
            <thead className="text-[11px] uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="pb-3">Document</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Uploaded by</th>
                <th className="pb-3">Uploaded</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {society.documents.map((document) => (
                <tr key={document.id}>
                  <td className="py-3 text-[13px] font-semibold text-ink">{document.fileName}</td>
                  <td className="py-3 text-[12px] text-ink-soft">{document.documentType.replaceAll("_", " ")}</td>
                  <td className="py-3 text-[13px] text-ink-soft">{document.uploadedBy}</td>
                  <td className="py-3 text-[13px] text-ink-soft">{formatDate(document.uploadedAt)}</td>
                  <td className="py-3"><StatusPill value={document.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "Finance" && (
        <div className="grid gap-6 p-6 lg:grid-cols-3">
          <article className="rounded-tile border border-line bg-surface px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Society wealth</p>
            <strong className="mt-2 block text-[26px] font-bold text-ink">LKR 2.5M</strong>
            <p className="mt-1 text-[11px] text-muted">31 Mar 2026 · from society finance tab</p>
          </article>
          <article className="rounded-tile border border-line bg-surface px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Outstanding payments</p>
            <strong className="mt-2 block text-[26px] font-bold text-ink">LKR 0</strong>
            <p className="mt-1 text-[11px] text-muted">Up to date</p>
          </article>
          <article className="rounded-tile border border-line bg-surface px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">SDF shareholding</p>
            <strong className="mt-2 block text-[26px] font-bold text-ink">LKR 640,000</strong>
            <p className="mt-1 text-[11px] text-muted">320 shares</p>
          </article>
        </div>
      )}

      {activeTab === "History" && (
        <div className="space-y-0 p-6">
          {society.history.map((event, index) => (
            <div className="grid grid-cols-[24px_1fr] gap-3" key={event.id}>
              <div className="flex flex-col items-center">
                <span className="mt-1 size-2.5 rounded-full bg-brand-leaf ring-4 ring-brand-mint" />
                {index < society.history.length - 1 && <span className="h-full w-px bg-line" />}
              </div>
              <div className="pb-6">
                <strong className="text-[13px] text-ink">{event.summary}</strong>
                <p className="mt-1 text-[11px] text-muted">{event.actorDisplayName} · {formatDate(event.occurredAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function InfoGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h3>
      <dl className="mt-4 space-y-4">{children}</dl>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-1 text-[13px] font-semibold text-ink">{value || "Not recorded"}</dd>
    </div>
  );
}
