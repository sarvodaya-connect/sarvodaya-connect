"use client";

import { useState } from "react";

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

type AdminTab = "users" | "roles" | "audit";

export function PlatformAdminScreen() {
  const [tab, setTab] = useState<AdminTab>("users");
  const [notice, setNotice] = useState("");

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-[-0.025em] text-[#203329]">Administration</h2>
      <button className="rounded-lg bg-[#26744b] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#174a32] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0]" onClick={() => setNotice("User invitations will be available when the identity service is connected.")} type="button">Invite user</button>
    </div>
    {notice && <p aria-live="polite" className="mt-3 rounded-lg border border-[#d7e7d6] bg-[#f1f7ef] px-4 py-3 text-xs text-[#355b3e]">{notice}</p>}
    <section aria-label="Administration records" className="mt-3 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-sm">
      <div aria-label="Administration sections" className="flex overflow-x-auto border-b border-[#e6eae3] px-3" role="tablist">
        {[{ id: "users", label: "Users (4)" }, { id: "roles", label: "Roles & permissions" }, { id: "audit", label: "System audit log" }].map((item) => <button aria-controls={`admin-panel-${item.id}`} aria-selected={tab === item.id} className={`shrink-0 border-b-2 px-4 py-3 text-[11px] font-medium transition ${tab === item.id ? "border-[#26744b] text-[#174a32]" : "border-transparent text-[#68756c] hover:text-[#174a32]"}`} id={`admin-tab-${item.id}`} key={item.id} onClick={() => { setTab(item.id as AdminTab); setNotice(""); }} role="tab" type="button">{item.label}</button>)}
      </div>
      <div aria-labelledby={`admin-tab-${tab}`} className="overflow-x-auto" id={`admin-panel-${tab}`} role="tabpanel" tabIndex={0}>
        {tab === "users" && <table className="w-full min-w-[740px] text-left">
          <caption className="sr-only">Demonstration platform users, roles and access scopes</caption>
          <thead className="bg-[#f3f4ee]"><tr className="text-[10px] font-semibold text-[#526057]"><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Last active</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-[#edf0eb]">{users.map((user) => <tr key={user.name}><td className="px-4 py-3 text-xs font-medium text-[#344239]">{user.name}</td><td className="px-4 py-3 text-xs text-[#526057]">{user.role}</td><td className="px-4 py-3 text-xs text-[#526057]">{user.scope}</td><td className="px-4 py-3 text-xs text-[#526057]">{user.lastActive}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f0e7] px-2.5 py-1 text-[10px] font-semibold text-[#26744b]"><span aria-hidden="true" className="size-1.5 rounded-full bg-[#39864a]"/>{user.status}</span></td></tr>)}</tbody>
        </table>}
        {tab === "roles" && <table className="w-full min-w-[620px] text-left">
          <caption className="sr-only">Demonstration role permissions and scopes</caption>
          <thead className="bg-[#f3f4ee]"><tr className="text-[10px] font-semibold text-[#526057]"><th className="px-4 py-3">Role</th><th className="px-4 py-3">Access scope</th><th className="px-4 py-3">Assigned users</th></tr></thead>
          <tbody className="divide-y divide-[#edf0eb]">{roles.map((role) => <tr key={role.name}><td className="px-4 py-3 text-xs font-semibold text-[#344239]">{role.name}</td><td className="px-4 py-3 text-xs text-[#526057]">{role.scope}</td><td className="px-4 py-3 text-xs text-[#526057]">{role.people}</td></tr>)}</tbody>
        </table>}
        {tab === "audit" && <table className="w-full min-w-[620px] text-left">
          <caption className="sr-only">Recent platform administration audit events</caption>
          <thead className="bg-[#f3f4ee]"><tr className="text-[10px] font-semibold text-[#526057]"><th className="px-4 py-3">User</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Date & time</th></tr></thead>
          <tbody className="divide-y divide-[#edf0eb]">{auditEntries.map((entry) => <tr key={`${entry.actor}-${entry.when}`}><td className="px-4 py-3 text-xs text-[#344239]">{entry.actor}</td><td className="px-4 py-3 text-xs text-[#526057]">{entry.action}</td><td className="px-4 py-3 text-xs text-[#526057]">{entry.target}</td><td className="px-4 py-3 text-xs text-[#526057]">{entry.when}</td></tr>)}</tbody>
        </table>}
      </div>
    </section>
    <p className="mt-3 text-[10px] text-[#818c84]">Fictional demonstration records only. User invitations and permission changes are not connected to a live identity service.</p>
  </>;
}
