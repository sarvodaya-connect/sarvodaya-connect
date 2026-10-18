import Link from "next/link";

import { PageHeading } from "@/components/dashboard/page-heading";
import { StatusPill } from "@/components/dashboard/status-pill";

type Metric = { label: string; value: string; note: string; tone?: "gold" | "blue" };

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article className="rounded-xl border border-[#dfe5dc] bg-white p-5 shadow-sm" key={metric.label}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-medium text-[#738078]">{metric.label}</span>
            <span aria-hidden="true" className={`grid size-8 place-items-center rounded-lg text-sm ${metric.tone === "gold" ? "bg-[#fff4d6] text-[#946d08]" : metric.tone === "blue" ? "bg-[#e6f2f8] text-[#17628a]" : "bg-[#e6f0e7] text-[#26744b]"}`}>
              {metric.tone === "gold" ? "!" : metric.tone === "blue" ? "↗" : "✓"}
            </span>
          </div>
          <strong className="mt-3 block text-2xl font-semibold tracking-[-0.035em] text-[#174a32]">{metric.value}</strong>
          <span className="mt-1 block text-[11px] text-[#929c95]">{metric.note}</span>
        </article>
      ))}
    </div>
  );
}

function Panel({ children, className = "", title, eyebrow }: { children: React.ReactNode; className?: string; title: string; eyebrow?: string }) {
  return (
    <section className={`rounded-xl border border-[#dfe5dc] bg-white shadow-sm ${className}`}>
      <div className="border-b border-[#edf0eb] px-5 py-4">
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#26744b]">{eyebrow}</p>}
        <h2 className={`${eyebrow ? "mt-1" : ""} text-sm font-semibold text-[#28382f]`}>{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const districtRows = [
  { name: "Kurunegala", code: "KG", societies: 148, attention: 12, completeness: 82 },
  { name: "Kandy", code: "KD", societies: 132, attention: 9, completeness: 79 },
  { name: "Kegalle", code: "KE", societies: 126, attention: 7, completeness: 86 },
  { name: "Matale", code: "MT", societies: 84, attention: 5, completeness: 74 },
];

export function NationalOverview() {
  return (
    <>
      <PageHeading description="A national view of village societies, verification progress and items that need follow-up." title="National overview" />
      <MetricGrid metrics={[
        { label: "Societies in registry", value: "1,214", note: "Across 25 districts" },
        { label: "Verified profiles", value: "894", note: "74% of records" },
        { label: "Awaiting review", value: "148", note: "Across all districts", tone: "gold" },
        { label: "Registered members", value: "452,680", note: "Fictional demonstration total", tone: "blue" },
      ]} />
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Panel title="District profile completeness" eyebrow="National registry">
          <div className="space-y-5">
            {districtRows.map((district) => (
              <div key={district.code}>
                <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                  <Link className="font-semibold text-[#304038] hover:text-[#26744b]" href={`/districts/${district.name.toLowerCase()}`}>{district.name}</Link>
                  <span className="text-[#78857d]">{district.completeness}% <span className="text-[#a0a8a2]">· {district.societies} societies</span></span>
                </div>
                <div aria-label={`${district.name} profile completeness ${district.completeness}%`} className="h-2 overflow-hidden rounded-full bg-[#edf1ec]" role="img">
                  <div className="h-full rounded-full bg-[#38875a]" style={{ width: `${district.completeness}%` }} />
                </div>
              </div>
            ))}
          </div>
          <Link className="mt-6 inline-flex text-xs font-semibold text-[#26744b] hover:underline" href="/districts/kurunegala">Open district view <span aria-hidden="true" className="ml-1">→</span></Link>
        </Panel>
        <Panel title="Items needing attention" eyebrow="Follow-up">
          <ul className="divide-y divide-[#edf0eb]">
            {districtRows.slice(0, 3).map((district) => (
              <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={district.code}>
                <div><p className="text-xs font-semibold text-[#304038]">{district.name} District</p><p className="mt-1 text-[11px] text-[#78857d]">Incomplete or unverified records</p></div>
                <span className="rounded-full bg-[#fff4d6] px-2.5 py-1 text-[11px] font-semibold text-[#806718]">{district.attention} records</span>
              </li>
            ))}
          </ul>
          <Link className="mt-6 inline-flex text-xs font-semibold text-[#26744b] hover:underline" href="/reviews">Go to review queue <span aria-hidden="true" className="ml-1">→</span></Link>
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Registry status" eyebrow="Fictional summary">
          <div className="grid grid-cols-3 gap-3">
            {[{ label: "Active", value: "972", color: "bg-[#18804b]" }, { label: "Under review", value: "148", color: "bg-[#e4b40b]" }, { label: "Inactive", value: "94", color: "bg-[#d95145]" }].map((item) => (
              <div className="rounded-lg bg-[#f7f8f5] p-3" key={item.label}>
                <span className={`mr-2 inline-block size-2 rounded-full ${item.color}`} />
                <span className="text-[11px] text-[#68756c]">{item.label}</span>
                <strong className="mt-2 block text-lg text-[#24372d]">{item.value}</strong>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Recent activity" eyebrow="Latest updates">
          <ol className="space-y-4">
            {[
              ["Society profile submitted", "Pahala Kosgama SSS · 12 minutes ago"],
              ["District verification completed", "Kegalle District · 48 minutes ago"],
              ["New society record reviewed", "Galewela SSS · 2 hours ago"],
            ].map(([title, detail]) => <li className="flex gap-3" key={title}><span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-[#38875a]" /><div><p className="text-xs font-semibold text-[#304038]">{title}</p><p className="mt-1 text-[11px] text-[#78857d]">{detail}</p></div></li>)}
          </ol>
        </Panel>
      </div>
      <p className="mt-5 text-[11px] text-[#818c84]">Demonstration figures are fictional and will be replaced by authorised API data.</p>
    </>
  );
}

export function DistrictOverview() {
  return (
    <>
      <PageHeading description="Monitor society records, profile completeness and follow-ups for your assigned district." title="Kurunegala District" />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#68756c]"><span className="rounded-full bg-[#e6f0e7] px-3 py-1 font-semibold text-[#26744b]">District Manager view</span><span>Scope: Kurunegala District</span></div>
      <MetricGrid metrics={[
        { label: "Societies", value: "148", note: "In this district" },
        { label: "Active", value: "112", note: "Current status" },
        { label: "Awaiting review", value: "18", note: "Submitted updates", tone: "gold" },
        { label: "Follow-up needed", value: "12", note: "Incomplete profiles", tone: "blue" },
      ]} />
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Societies requiring follow-up" eyebrow="District work queue">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <caption className="sr-only">Societies requiring follow-up in Kurunegala District</caption>
              <thead><tr className="text-[10px] uppercase tracking-[0.1em] text-[#738078]"><th className="pb-3 font-medium">Society</th><th className="pb-3 font-medium">Completeness</th><th className="pb-3 font-medium">Status</th><th className="pb-3"><span className="sr-only">Open</span></th></tr></thead>
              <tbody className="divide-y divide-[#edf0eb]">
                {[{ id: "society-wellawa", name: "Wellawa Sarvodaya Shramadana Society", code: "SSS-KG-028", complete: 78, status: "PENDING" as const }, { id: "society-maho", name: "Maho Sarvodaya Shramadana Society", code: "SSS-KG-033", complete: 71, status: "PENDING" as const }, { id: "society-pahala-kosgama", name: "Pahala Kosgama Sarvodaya Shramadana Society", code: "SSS-KG-001", complete: 86, status: "VERIFIED" as const }].map((society) => (
                  <tr key={society.id}><td className="py-3 pr-3"><Link className="block text-xs font-semibold text-[#304038] hover:text-[#26744b]" href={`/societies/${society.id}`}>{society.name}</Link><span className="mt-1 block text-[10px] text-[#929c95]">{society.code}</span></td><td className="py-3 text-xs text-[#526057]">{society.complete}%</td><td className="py-3"><StatusPill value={society.status} /></td><td className="py-3 text-right"><Link aria-label={`Open ${society.name}`} className="text-xs font-semibold text-[#26744b] hover:underline" href={`/societies/${society.id}`}>View</Link></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link className="mt-5 inline-flex text-xs font-semibold text-[#26744b] hover:underline" href="/societies">View all district societies <span aria-hidden="true" className="ml-1">→</span></Link>
        </Panel>
        <Panel title="Review workload" eyebrow="This week">
          <div className="flex items-end justify-between gap-4"><div><strong className="text-4xl tracking-[-0.05em] text-[#174a32]">18</strong><p className="mt-1 text-xs text-[#78857d]">submissions waiting for review</p></div><span className="rounded-full bg-[#fff4d6] px-3 py-1.5 text-[11px] font-semibold text-[#806718]">Needs attention</span></div>
          <div className="mt-5 space-y-3 text-xs">
            {[{ label: "Committee updates", value: "11" }, { label: "Activity reports", value: "7" }].map((item) => <div className="flex justify-between rounded-lg bg-[#f7f8f5] px-3 py-2.5" key={item.label}><span className="text-[#68756c]">{item.label}</span><strong className="text-[#304038]">{item.value}</strong></div>)}
          </div>
          <Link className="mt-5 inline-flex text-xs font-semibold text-[#26744b] hover:underline" href="/reviews">Open review queue <span aria-hidden="true" className="ml-1">→</span></Link>
        </Panel>
      </div>
      <p className="mt-5 text-[11px] text-[#818c84]">Demonstration figures are fictional. Record access must be authorised by the live identity and API services.</p>
    </>
  );
}

const accessUsers = [
  { name: "K. Fernando", email: "k.fernando@example.invalid", role: "National Administrator", scope: "National", status: "Active" },
  { name: "S. Tharmalingam", email: "s.tharmalingam@example.invalid", role: "District Manager", scope: "Kurunegala", status: "Active" },
  { name: "N. Perera", email: "n.perera@example.invalid", role: "Society Officer", scope: "Pahala Kosgama", status: "Pending" },
];

export function PlatformAdminOverview() {
  return (
    <>
      <PageHeading description="Review dashboard accounts, assigned roles and access scopes. This screen uses fictional demonstration records." title="Platform administration" />
      <MetricGrid metrics={[
        { label: "User accounts", value: "38", note: "Across the demonstration system" },
        { label: "Active accounts", value: "32", note: "Currently enabled" },
        { label: "Access reviews", value: "6", note: "Require administrator follow-up", tone: "gold" },
        { label: "Suspended", value: "2", note: "Access disabled", tone: "blue" },
      ]} />
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <Panel title="Dashboard access" eyebrow="Accounts and assignments">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-left">
              <caption className="sr-only">Demonstration dashboard user accounts and assigned scopes</caption>
              <thead><tr className="text-[10px] uppercase tracking-[0.1em] text-[#738078]"><th className="pb-3 font-medium">User</th><th className="pb-3 font-medium">Role</th><th className="pb-3 font-medium">Scope</th><th className="pb-3 font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-[#edf0eb]">{accessUsers.map((user) => <tr key={user.email}><td className="py-3"><strong className="block text-xs text-[#304038]">{user.name}</strong><span className="mt-1 block text-[10px] text-[#929c95]">{user.email}</span></td><td className="py-3 text-xs text-[#526057]">{user.role}</td><td className="py-3 text-xs text-[#526057]">{user.scope}</td><td className="py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${user.status === "Active" ? "bg-[#e6f0e7] text-[#26744b]" : "bg-[#fff4d6] text-[#806718]"}`}>{user.status}</span></td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-5 rounded-lg bg-[#f4f8f3] px-4 py-3 text-xs leading-5 text-[#53645a]">Account creation and permission changes will be connected to the authorised identity and administration services.</p>
        </Panel>
        <Panel title="Role and scope overview" eyebrow="Access model">
          <ul className="space-y-3">
            {[{ role: "National Administrator", scope: "National registry and oversight", tone: "bg-[#e6f0e7] text-[#26744b]" }, { role: "District Manager", scope: "Assigned district records and reviews", tone: "bg-[#e6f2f8] text-[#17628a]" }, { role: "Society Officer", scope: "Assigned society profile and submissions", tone: "bg-[#fff4d6] text-[#806718]" }].map((item) => <li className="rounded-lg border border-[#edf0eb] p-3" key={item.role}><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.tone}`}>{item.role}</span><p className="mt-2 text-xs leading-5 text-[#68756c]">{item.scope}</p></li>)}
          </ul>
        </Panel>
      </div>
      <p className="mt-5 text-[11px] text-[#818c84]">This role preview uses fictional demonstration users; the “Viewing as” selector does not grant or enforce real permissions.</p>
    </>
  );
}
