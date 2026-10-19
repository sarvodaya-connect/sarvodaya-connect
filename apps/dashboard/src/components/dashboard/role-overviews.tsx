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

export function NationalOverview() {
  return (
    <>
      <nav aria-label="Dashboard sections" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {["1 · Societies", "2 · Membership", "3–4 · Audit & AGM", "5 · Wealth", "6 · Activities", "Map & emergency"].map((item, index) => (
          <a className="shrink-0 rounded-full border border-[#e1e5dc] bg-white px-3.5 py-2 text-[11px] font-medium text-[#344239] shadow-sm hover:border-[#9dbca2]" href={`#national-section-${index + 1}`} key={item}>{item}</a>
        ))}
      </nav>

      <section id="national-section-1">
        <Panel title="Latest Shramadana Societies status" eyebrow="1 · National registry">
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="flex flex-wrap items-end gap-x-7 gap-y-2">
                <div><p className="text-xs text-[#78857d]">Registered societies</p><strong className="mt-1 block text-4xl font-bold tracking-tight text-[#17211b]">5,340</strong></div>
                <span aria-hidden="true" className="pb-2 text-3xl text-[#38875a]">→</span>
                <div><p className="text-xs text-[#78857d]">Currently active</p><strong className="mt-1 block text-4xl font-bold tracking-tight text-[#26744b]">1,076</strong></div>
              </div>
              <p className="mt-3 text-[11px] text-[#78857d]">20% of registered societies are active · 4,264 registered but not active</p>
              <div aria-label="20 percent of registered societies are active" className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#edf0e8]" role="img"><div className="h-full w-[20%] bg-[#26744b]" /></div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[{ value: "50", label: "Active & to be registered" }, { value: "32", label: "Arth Dharma villages" }, { value: "331", label: "Model villages" }, { value: "1,179", label: "Share invested · People's Investment" }].map((item) => (
                  <div className="min-h-[92px] rounded-lg border border-[#e7eae3] bg-[#fdfdfa] p-3" key={item.label}><strong className="block text-2xl font-bold text-[#23362b]">{item.value}</strong><span className="mt-1 block text-[10px] leading-4 text-[#78857d]">{item.label}</span></div>
                ))}
              </div>
            </div>
            <div className="border-t border-[#edf0eb] pt-4 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <h3 className="text-sm font-semibold text-[#28382f]">Classification of active societies</h3>
              <div className="mt-4 flex items-center gap-5">
                <div aria-label="Society classification: A 144, B 172, C 760" className="flex w-28 shrink-0 flex-col items-center gap-0.5" role="img">
                  <div className="grid h-14 w-20 place-items-center bg-[#268c43] text-sm font-bold text-white" style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}>A</div>
                  <div className="grid h-14 w-28 place-items-center bg-[#f0c328] text-sm font-bold text-[#263329]" style={{ clipPath: "polygon(25% 0, 75% 0, 100% 100%, 0 100%)" }}>B</div>
                  <div className="grid h-14 w-36 place-items-center bg-[#e88b2d] text-sm font-bold text-[#263329]" style={{ clipPath: "polygon(17% 0, 83% 0, 100% 100%, 0 100%)" }}>C</div>
                </div>
                <ul className="min-w-0 space-y-3 text-[11px]">
                  {[{ key: "A", value: "144", label: "Strong", note: "Economically and institutionally stronger", color: "bg-[#268c43]" }, { key: "B", value: "172", label: "Developing", note: "Medium-level societies", color: "bg-[#f0c328]" }, { key: "C", value: "760", label: "Needs strengthening", note: "Require strengthening support", color: "bg-[#e88b2d]" }].map((item) => (
                    <li className="flex gap-2" key={item.key}><span className={`mt-1 size-2.5 shrink-0 rounded-full ${item.color}`} /><div><p className="font-semibold text-[#344239]">{item.value} &nbsp;{item.key} · {item.label}</p><p className="mt-0.5 leading-4 text-[#78857d]">{item.note}</p></div></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[1.15fr_1fr]">
        <section id="national-section-2">
          <Panel title="Total membership · male and female" eyebrow="2 · Membership">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><strong className="text-4xl font-bold tracking-tight text-[#17211b]">98,640</strong><p className="mt-1 text-[11px] text-[#78857d]">Members in 1,076 active societies</p></div><div className="flex gap-4 text-[11px]"><span className="text-[#8b3889]">● Female&nbsp; <strong>56,214 · 57%</strong></span><span className="text-[#28669a]">● Male&nbsp; <strong>42,426 · 43%</strong></span></div></div>
            <div aria-label="Female members 57 percent, male members 43 percent" className="mt-4 flex h-3 overflow-hidden rounded-full" role="img"><div className="w-[57%] bg-[#93458f]" /><div className="w-[43%] bg-[#28669a]" /></div>
            <div className="mt-5 grid grid-cols-[1fr_auto] gap-x-5 text-[10px] font-semibold uppercase tracking-wide text-[#78857d]"><span>Membership category · female / male</span><span>Total</span></div>
            <ul className="mt-2 divide-y divide-[#edf0eb]">
              {[{ label: "Child members", age: "7–14 yrs", female: 7900, male: 6220, total: "14,120" }, { label: "Youth members", age: "15–25 yrs", female: 10100, male: 8250, total: "18,350" }, { label: "Ordinary members", age: "over 25", female: 33800, male: 25140, total: "58,940" }, { label: "Life members", age: "", female: 3200, male: 2670, total: "5,870" }, { label: "Invited members", age: "honorary", female: 1214, male: 146, total: "1,360" }].map((item) => (
                <li className="grid grid-cols-[minmax(105px,1fr)_minmax(88px,1.1fr)_auto] items-center gap-3 py-2.5 text-[11px]" key={item.label}><span className="min-w-0"><strong className="block text-[#344239]">{item.label}</strong>{item.age && <span className="text-[10px] text-[#929c95]">{item.age}</span>}</span><span aria-label={`${item.label} female and male distribution`} className="flex h-2 overflow-hidden rounded-full bg-[#28669a]" role="img"><span className="bg-[#93458f]" style={{ width: `${Math.round(item.female / (item.female + item.male) * 100)}%` }} /></span><strong className="text-right text-[#526057]">{item.total}</strong></li>
              ))}
            </ul>
          </Panel>
        </section>

        <div className="grid gap-4">
          <section id="national-section-3">
            <Panel title="Audit compliance · Audit & AGM completion" eyebrow="3–4 · Annual registrar documents">
              <div className="flex flex-wrap items-center gap-5 border-b border-[#edf0eb] pb-4">
                <div aria-label="75 percent audit compliance" className="grid size-[92px] shrink-0 place-items-center rounded-full" role="img" style={{ background: "conic-gradient(#26744b 0 75%, #e9ede5 75% 100%)" }}><span className="grid size-[68px] place-items-center rounded-full bg-white text-lg font-bold text-[#344239]">75%</span></div>
                <div className="min-w-[150px] flex-1"><p className="text-[11px] leading-5 text-[#526057]"><strong className="text-[#344239]">812 of 1,076</strong> active societies have an audit report for FY 2025/26, certified by an auditor registered under the Companies Act.</p><p className="mt-1 text-[11px] font-semibold text-[#b33b36]">264 not yet approved, 128 of them overdue</p></div>
              </div>
              <div className="mt-4"><h3 className="text-xs font-semibold text-[#344239]">Annual documents to the Registrar · FY 2025/26</h3><ul className="mt-3 space-y-3">{[{ label: "Audit report", value: 812, percent: 75 }, { label: "AGM minutes", value: 905, percent: 84 }, { label: "Office bearers list", value: 948, percent: 88 }, { label: "Members list", value: 776, percent: 72 }, { label: "All four submitted", value: 702, percent: 65 }].map((item) => <li className="grid grid-cols-[minmax(110px,1fr)_auto_minmax(54px,0.8fr)] items-center gap-2 text-[10px]" key={item.label}><span className="text-[#526057]">{item.label}</span><strong className="text-right text-[#344239]">{item.value} · {item.percent}%</strong><span aria-label={`${item.label} ${item.percent}% complete`} className="h-2 overflow-hidden rounded-full bg-[#edf0e8]" role="img"><span className="block h-full rounded-full bg-[#26744b]" style={{ width: `${item.percent}%` }} /></span></li>)}</ul></div>
            </Panel>
          </section>
          <section className="grid gap-4 sm:grid-cols-2" id="national-section-5">
            <Panel title="Total wealth of all SSSs" eyebrow="5 · Wealth">
              <strong className="text-3xl font-bold tracking-tight text-[#174a32]">LKR 1.84 bn</strong><p className="mt-2 text-[10px] leading-4 text-[#78857d]">From the finance tab of 1,076 active societies · 31 Mar 2026</p><div aria-label="Society wealth composition" className="mt-4 flex h-2.5 overflow-hidden rounded-full"><span className="w-[42%] bg-[#26744b]" /><span className="w-[25%] bg-[#80b56f]" /><span className="w-[19%] bg-[#e4b40b]" /><span className="w-[14%] bg-[#d7ded4]" /></div>
            </Panel>
            <section id="national-section-6"><Panel title="Activity status · done vs planned (YTD)" eyebrow="6 · Activities"><div className="flex gap-2 text-[10px]"><span className="rounded-md bg-[#174a32] px-2 py-1 font-semibold text-white">10 sectors</span><span className="rounded-md bg-[#f3f5f0] px-2 py-1 text-[#526057]">Social · Economic · Governance</span></div><div className="mt-4 flex items-baseline gap-2"><strong className="text-3xl font-bold text-[#174a32]">3,460</strong><span className="text-[10px] text-[#78857d]">of 3,930 planned activities · 88%</span></div><div aria-label="88 percent of planned activities completed" className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#edf0e8]" role="img"><div className="h-full w-[88%] rounded-full bg-[#26744b]" /></div><p className="mt-3 text-[10px] text-[#78857d]">Female and male participation across all 25 districts</p></Panel></section>
          </section>
        </div>
      </div>
      <p className="mt-4 text-[10px] text-[#818c84]">Demonstration figures are fictional and will be replaced by authorised API data.</p>
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
      <p className="mt-5 text-[11px] text-[#818c84]">This role preview demonstrates layout only; URL-selected roles do not grant or enforce real permissions.</p>
    </>
  );
}
