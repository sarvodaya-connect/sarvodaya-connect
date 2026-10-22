"use client";

import { useState } from "react";

import type { SocietyDetails } from "@sarvodaya-connect/api-contracts";

import { Pill } from "./ui/pill";
import { StatusPill } from "./status-pill";

const tabs = [
  "Overview",
  "Village profile",
  "Executive Council",
  "Membership",
  "Activities",
  "Finance",
  "SDF Shares",
  "Audits",
  "Documents",
  "History",
] as const;
type Tab = (typeof tabs)[number];

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

const villageFigures = [
  { value: "680", label: "Families" },
  { value: "2,540", label: "Population" },
  { value: "16%", label: "Women-headed households" },
  { value: "29%", label: "On Aswesuma" },
];

const activitySectors = [
  { label: "Community Education & Mobilization", done: 4, plan: 4, color: "#e88b2d" },
  { label: "New Economy – Youth, MSME", done: 3, plan: 4, color: "#28669a" },
  { label: "Health & Nutrition", done: 3, plan: 4, color: "#15887a" },
  { label: "Agriculture & Food Security", done: 3, plan: 3, color: "#568b40" },
];

export function SocietyProfileTabs({
  missingCount = 0,
  president,
  society,
}: {
  missingCount?: number;
  president?: string;
  society: SocietyDetails;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const primaryContact = society.contacts.find((contact) => contact.isPrimary);
  const secretary = society.committee.find((member) => member.position === "Secretary");
  const members = society.membership?.overallTotal ?? 412;

  return (
    <section>
      <div
        className="flex overflow-x-auto border-b border-line"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[12px] transition ${
              activeTab === tab
                ? "border-brand-forest font-semibold text-ink"
                : "border-transparent text-ink-soft hover:text-brand-forest"
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
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Members" note={<>415 of 680 village families · <strong className="text-brand-leaf">61%</strong></>} value={members.toLocaleString("en-GB")} />
            <Kpi label="Society wealth" note="Savings, loans, assets & shares" value="LKR 2.94M" />
            <Kpi label="SDF shares" note="320 shares" value="LKR 640,000" />
            <Kpi
              label="Data complete"
              note={missingCount === 0 ? "Registry ready" : `${missingCount} field${missingCount === 1 ? "" : "s"} missing`}
              value={`${society.profileCompleteness}%`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card
              action={<SmallButton onClick={() => setActiveTab("Village profile")}>Village profile</SmallButton>}
              title="Village at a glance"
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {villageFigures.map((item) => (
                  <div className="rounded-lg border border-line px-3 py-2" key={item.label}>
                    <strong className="block text-[17px] text-ink">{item.value}</strong>
                    <span className="text-[10px] leading-4 text-muted">{item.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-ink-soft">Main livelihoods: paddy &amp; agriculture 41% · daily wage 19% · small business 13%</p>
              <p className="mt-1.5 text-[11px] text-ink-soft">
                Priority issues: <strong className="text-ink">1 Drinking water · 2 Youth unemployment · 3 Elephant–human conflict</strong>
              </p>
            </Card>
            <Card
              action={<SmallButton onClick={() => setActiveTab("Activities")}>All activities</SmallButton>}
              title="Activity status · FY 2025/26"
            >
              <ActivityStatus />
            </Card>
          </div>

          <Card title="Basic information">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
              <Info label="Founded" value={society.establishedOn?.slice(0, 4)} />
              <Info label="Registration no." value={society.societyCode} />
              <Info label="GPS" value={society.location ? `${society.location.latitude}° N, ${society.location.longitude}° E` : undefined} />
              <Info label="Phone" value={primaryContact?.phone} />
              <Info label="President" value={president} />
              <Info label="Secretary" value={secretary?.fullName} />
            </dl>
          </Card>

          {primaryContact && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-brand-forest bg-surface px-5 py-3">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-brand-forest text-[11px] font-bold text-white">
                  {primaryContact.fullName?.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Current authorised contact</p>
                  <p className="text-[13px] font-bold text-ink">
                    {primaryContact.fullName}
                    {primaryContact.position && ` · ${primaryContact.position}`}
                  </p>
                  <p className="text-[11px] text-muted">
                    {primaryContact.phone} · verified {formatDate(society.updatedAt)}
                  </p>
                </div>
              </div>
              <button className="rounded-button bg-brand-action px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-action-pressed" type="button">
                Log a call
              </button>
            </section>
          )}
        </div>
      )}

      {activeTab === "Village profile" && (
        <div className="mt-4">
          <Card title="Village profile 2026 · Approved">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {villageFigures.map((item) => (
                <div className="rounded-lg border border-line px-3 py-2" key={item.label}>
                  <strong className="block text-[17px] text-ink">{item.value}</strong>
                  <span className="text-[10px] leading-4 text-muted">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-ink-soft">Main livelihoods: paddy &amp; agriculture 41% · daily wage 19% · small business 13%</p>
            <p className="mt-1.5 text-[11px] text-ink-soft">Priority issues: 1 Drinking water · 2 Youth unemployment · 3 Elephant–human conflict</p>
          </Card>
        </div>
      )}

      {activeTab === "Activities" && (
        <div className="mt-4">
          <Card title="Activity status · FY 2025/26">
            <ActivityStatus />
          </Card>
        </div>
      )}

      {activeTab === "Audits" && (
        <div className="mt-4">
          <Card title="Audits">
            <ul className="divide-y divide-line-soft text-[12px]">
              <li className="flex items-center justify-between py-2.5"><span className="text-ink">FY 2025/26 audit report</span><Pill tone="overdue">Overdue</Pill></li>
              <li className="flex items-center justify-between py-2.5"><span className="text-ink">FY 2024/25 audit report</span><Pill tone="approved">Approved</Pill></li>
            </ul>
          </Card>
        </div>
      )}

      {activeTab === "SDF Shares" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Kpi label="SDF shares" note="320 shares · value at 30 Sep 2026" value="LKR 640,000" />
          <Kpi label="Latest purchase" note="+20 shares · 02 Jul 2026" value="LKR 40,000" />
        </div>
      )}

      {activeTab === "Membership" && (
        <div className="mt-4 grid gap-6 rounded-card border border-line bg-surface p-6 lg:grid-cols-[1.2fr_1fr]">
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
        <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface p-6">
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

      {activeTab === "Documents" && (
        <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface p-6">
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
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
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
        <div className="mt-4 space-y-0 rounded-card border border-line bg-surface p-6">
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

function Card({ action, children, title }: { action?: React.ReactNode; children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-card border border-line bg-surface px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-bold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, note, value }: { label: string; note: React.ReactNode; value: string }) {
  return (
    <article className="rounded-card border border-line bg-surface px-4 py-3.5">
      <p className="text-[11px] text-muted">{label}</p>
      <strong className="mt-1 block text-[20px] font-bold tracking-[-0.01em] text-ink">{value}</strong>
      <p className="mt-0.5 text-[11px] text-muted">{note}</p>
    </article>
  );
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="rounded-button border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-brand-mint-soft" onClick={onClick} type="button">
      {children}
    </button>
  );
}

function ActivityStatus() {
  return (
    <>
      <p className="flex items-baseline gap-2 text-[11px] text-muted">
        <strong className="text-[22px] text-ink">22</strong> of 26 planned activities done · 85%
      </p>
      <ul className="mt-2 space-y-2">
        {activitySectors.map((sector) => (
          <li className="grid grid-cols-[minmax(0,1fr)_96px_32px] items-center gap-3 text-[11px]" key={sector.label}>
            <span className="flex min-w-0 items-center gap-2 text-ink-soft">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: sector.color }} />
              <span className="truncate">{sector.label}</span>
            </span>
            <span aria-label={`${sector.done} of ${sector.plan} done`} className="h-1.5 overflow-hidden rounded-full bg-[#edf0e8]" role="img">
              <span className="block h-full rounded-full" style={{ width: `${(sector.done / sector.plan) * 100}%`, backgroundColor: sector.color }} />
            </span>
            <span className="text-right text-muted">{sector.done} / {sector.plan}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Info({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[12.5px] text-ink">{value || "Not recorded"}</dd>
    </div>
  );
}
