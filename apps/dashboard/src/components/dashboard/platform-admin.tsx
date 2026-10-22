"use client";

import { useState } from "react";

import { Pill } from "./ui/pill";

const users = [
  { name: "R. Fernando", role: "District Manager", scope: "Kurunegala District", lastActive: "Today, 10:02", status: "Active" },
  { name: "M. Silva", role: "HQ Analyst", scope: "National", lastActive: "Today, 19:30", status: "Active" },
  { name: "S. Tharmalingam", role: "Social Programme Coordinator", scope: "Batticaloa District", lastActive: "Yesterday", status: "Active" },
  { name: "A. Navaratnam", role: "Emergency Response", scope: "National", lastActive: "08 Oct 2026", status: "Active" },
];

const roles = [
  { name: "HQ Administrator", scope: "National oversight and administration", people: "4 users" },
  { name: "District Manager", scope: "Assigned district records, reviews and reports", people: "25 users" },
  { name: "Society Officer", scope: "Assigned society profile and submissions", people: "1,240 users" },
  { name: "System Administrator", scope: "Platform access and technical settings only", people: "2 users" },
];

const auditEntries = [
  { actor: "K. Fernando", action: "Role assignment reviewed", target: "R. Fernando · District Manager", when: "Today, 10:02" },
  { actor: "T. Silva", action: "User account status changed", target: "S. Perera · Active", when: "Today, 09:41" },
  { actor: "K. Fernando", action: "Access review completed", target: "National user accounts", when: "Yesterday, 16:24" },
];

type AdminTab = "users" | "roles" | "master-data" | "workflow" | "data-import" | "security" | "audit";

const tabs: { id: AdminTab; label: string }[] = [
  { id: "users", label: "Users (4)" },
  { id: "roles", label: "Roles & permissions" },
  { id: "master-data", label: "Master data" },
  { id: "workflow", label: "Workflow" },
  { id: "data-import", label: "Data import" },
  { id: "security", label: "Security & privacy" },
  { id: "audit", label: "System audit log" },
];

export function PlatformAdminScreen() {
  const [tab, setTab] = useState<AdminTab>("users");
  const [notice, setNotice] = useState("");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-[-0.015em] text-ink md:text-2xl">Administration</h2>
        </div>
        <button
          className="rounded-button bg-brand-action px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-brand-action-pressed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0]"
          onClick={() => setNotice("User invitations will be available when the identity service is connected.")}
          type="button"
        >
          Invite user
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted">Users, roles and system records</p>
      {notice && (
        <p aria-live="polite" className="mt-3 rounded-button border border-[#d7e7d6] bg-brand-mint-soft px-4 py-3 text-[12px] text-brand-forest">
          {notice}
        </p>
      )}
      <section aria-label="Administration records" className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
        <div aria-label="Administration sections" className="flex overflow-x-auto border-b border-line-soft px-3" role="tablist">
          {tabs.map((item) => (
            <button
              aria-controls={`admin-panel-${item.id}`}
              aria-selected={tab === item.id}
              className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-[12px] font-semibold transition ${
                tab === item.id
                  ? "border-brand-leaf text-brand-forest"
                  : "border-transparent text-muted hover:text-ink-soft"
              }`}
              id={`admin-tab-${item.id}`}
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setNotice("");
              }}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div aria-labelledby={`admin-tab-${tab}`} className="overflow-x-auto" id={`admin-panel-${tab}`} role="tabpanel" tabIndex={0}>
          {tab === "users" && (
            <table className="w-full min-w-[740px] text-left">
              <caption className="sr-only">Demonstration platform users, roles and access scopes</caption>
              <thead className="bg-surface-muted">
                <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Last active</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {users.map((user) => (
                  <tr className="transition hover:bg-brand-mint-soft" key={user.name}>
                    <td className="px-4 py-3 text-[13px] font-semibold text-ink">{user.name}</td>
                    <td className="px-4 py-3 text-[12px] text-ink-soft">{user.role}</td>
                    <td className="px-4 py-3 text-[12px] text-ink-soft">{user.scope}</td>
                    <td className="px-4 py-3 text-[12px] text-muted">{user.lastActive}</td>
                    <td className="px-4 py-3"><Pill tone="on-time">{user.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "roles" && (
            <table className="w-full min-w-[620px] text-left">
              <caption className="sr-only">Demonstration role permissions and scopes</caption>
              <thead className="bg-surface-muted">
                <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Access scope</th>
                  <th className="px-4 py-3">Assigned users</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {roles.map((role) => (
                  <tr className="transition hover:bg-brand-mint-soft" key={role.name}>
                    <td className="px-4 py-3 text-[13px] font-semibold text-ink">{role.name}</td>
                    <td className="px-4 py-3 text-[12px] text-ink-soft">{role.scope}</td>
                    <td className="px-4 py-3 text-[12px] text-muted">{role.people}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(tab === "master-data" || tab === "workflow" || tab === "data-import" || tab === "security") && (
            <TabPlaceholder tab={tab} />
          )}
          {tab === "audit" && (
            <table className="w-full min-w-[620px] text-left">
              <caption className="sr-only">Recent platform administration audit events</caption>
              <thead className="bg-surface-muted">
                <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Date & time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {auditEntries.map((entry) => (
                  <tr className="transition hover:bg-brand-mint-soft" key={`${entry.actor}-${entry.when}`}>
                    <td className="px-4 py-3 text-[13px] text-ink">{entry.actor}</td>
                    <td className="px-4 py-3 text-[12px] text-ink-soft">{entry.action}</td>
                    <td className="px-4 py-3 text-[12px] text-ink-soft">{entry.target}</td>
                    <td className="px-4 py-3 text-[12px] text-muted">{entry.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      <p className="mt-3 text-[11px] text-muted">
        Fictional demonstration records only. User invitations and permission changes are not connected to a live identity service.
      </p>
    </>
  );
}

function TabPlaceholder({ tab }: { tab: AdminTab }) {
  const copy: Record<string, { title: string; description: string }> = {
    "master-data": {
      title: "Master data",
      description: "Districts, DS/GN divisions, sector catalogue and other reference lists maintained by HQ.",
    },
    workflow: {
      title: "Workflow",
      description: "Approval chains, review targets, and reminder cadences used across the registry.",
    },
    "data-import": {
      title: "Data import",
      description: "Bulk uploads for societies, members and historical records. Connected after the identity service is live.",
    },
    security: {
      title: "Security & privacy",
      description: "Two-step verification policy, session timeouts, data retention and personal-data placeholders.",
    },
  };
  const info = copy[tab]!;
  return (
    <div className="px-6 py-12 text-center">
      <h3 className="text-sm font-semibold text-ink">{info.title}</h3>
      <p className="mt-2 mx-auto max-w-md text-[12px] leading-5 text-muted">{info.description}</p>
      <p className="mt-4 text-[11px] text-muted">Available after the identity service is connected.</p>
    </div>
  );
}
