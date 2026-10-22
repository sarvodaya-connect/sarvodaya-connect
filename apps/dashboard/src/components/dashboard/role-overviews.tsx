import { DistrictCatalogueOverview } from "@/components/dashboard/district-overview";
import { NationalActivityBreakdown, NationalMapAndEmergency } from "@/components/dashboard/national-support";
import { PlatformAdminScreen } from "@/components/dashboard/platform-admin";
import { ChangedInV2Badge } from "@/components/dashboard/ui/changed-in-v2-badge";

/**
 * Panel chrome used across the National Overview — matches Screen Catalogue
 * v3 D02 card style: white surface, 1px #DFE5DC border, 14px radius, flat.
 */
function Panel({ action, children, className = "", title, eyebrow }: { action?: React.ReactNode; children: React.ReactNode; className?: string; title: string; eyebrow?: string }) {
  return (
    <section className={`rounded-card border border-line bg-surface ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4 md:px-6">
        <div className="min-w-0">
          {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-leaf">{eyebrow}</p>}
          <h2 className={`${eyebrow ? "mt-1" : ""} text-sm font-semibold text-ink md:text-base`}>{title}</h2>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <div className="px-5 py-5 md:px-6">{children}</div>
    </section>
  );
}

export function NationalOverview() {
  return (
    <>
      <section id="national-section-1">
        <Panel action={<ChangedInV2Badge />} title="Latest Shramadana Societies status" eyebrow="1 · National registry">
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
<section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <section id="national-section-5">
              <Panel title="Total wealth of all SSSs" eyebrow="5 · Wealth">
                <strong className="text-3xl font-bold tracking-tight text-[#174a32]">LKR 1.84 bn</strong>
                <p className="mt-2 text-[10px] leading-4 text-[#78857d]">From the finance tab of 1,076 active societies · 31 Mar 2026</p>
                <div aria-label="Society wealth composition" className="mt-4 flex h-2.5 overflow-hidden rounded-full" role="img"><span className="w-[40%] bg-[#183c2b]" /><span className="w-[34%] bg-[#26744b]" /><span className="w-[14%] bg-[#8ab875]" /><span className="w-[12%] bg-[#f0c328]" /></div>
                <ul className="mt-4 space-y-2.5 text-[10px]">{[{ label: "Loans given to members", value: "LKR 718.6M", color: "#183c2b" }, { label: "Savings & deposits", value: "LKR 612.4M", color: "#26744b" }, { label: "Fixed assets (land, buildings)", value: "LKR 262.1M", color: "#8ab875" }, { label: "SDF shares", value: "LKR 245.3M", color: "#f0c328" }].map((item) => <li className="flex items-center justify-between gap-2 text-[#526057]" key={item.label}><span className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: item.color }}/>{item.label}</span><strong className="text-[#344239]">{item.value}</strong></li>)}</ul>
                <p className="mt-3 text-[10px] font-semibold text-[#39864a]">↑ 9% vs. last year</p>
              </Panel>
            </section>
            <section id="national-section-6">
              <Panel title="3,460 of 3,930 planned activities done · 88%" eyebrow="6 · Activities">
                <NationalActivityBreakdown />
              </Panel>
            </section>
          </section>
        </div>
      </div>
      <NationalMapAndEmergency />
      <p className="mt-4 text-[10px] text-[#818c84]">Demonstration figures are fictional and will be replaced by authorised API data.</p>
    </>
  );
}

export function DistrictOverview() {
  return <DistrictCatalogueOverview />;
}

export function PlatformAdminOverview() {
  return <PlatformAdminScreen />;
}
