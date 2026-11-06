import Link from "next/link";

import { Pagination } from "@/components/dashboard/national/links";
import { count, first } from "@/components/dashboard/national/format";
import { DataTable, Tbody, Td, Th, Thead, Tr } from "@/components/dashboard/ui/data-table";
import { Pill } from "@/components/dashboard/ui/pill";
import { getT } from "@/i18n/server";
import { localeTag, type Translator } from "@/i18n/translate";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getDistrictOptions, getDistrictSummaries, getHqTasks, getInformationRequests } from "@/lib/national-api";

import { RequestForm } from "./request-form";

const STATUS = {
  OPEN: { label: "rq.open", tone: "fast-target" },
  OVERDUE: { label: "rq.overdue", tone: "overdue" },
  COMPLETE: { label: "rq.complete", tone: "on-time" },
} as const;

function day(value: string, t: Translator) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(localeTag(t.locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** V5 D13 Requests & Tasks (HQ only). */
export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  await getCurrentViewer();
  const t = await getT();
  const page = Math.max(1, Number(first((await searchParams).page)) || 1);
  const [requests, tasks, districts, summaries] = await Promise.all([
    getInformationRequests(page),
    getHqTasks(),
    getDistrictOptions(),
    getDistrictSummaries(),
  ]);
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <>
      <h1 className="text-[22px] font-bold text-ink">{t("rq.title")}</h1>
      <p className="text-[12px] text-ink-soft">{t("rq.description")}</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section aria-labelledby="new-request" className="h-fit rounded-card border border-line bg-surface p-4">
          <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("rq.new")}</p>
          <h2 className="mb-3 text-[15px] font-bold text-ink" id="new-request">{t("rq.newTitle")}</h2>
          <RequestForm activeSocieties={summaries.totals.active} districts={districts} fyLabel={summaries.financialYear.label} minDate={today} />
        </section>
        <div className="flex flex-col gap-4">
          <section aria-labelledby="tracker" className="rounded-card border border-line bg-surface p-4">
            <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("rq.tracker")}</p>
            <h2 className="text-[15px] font-bold text-ink" id="tracker">{t("rq.sent")}</h2>
            {requests.data.length === 0 ? (
              <p className="mt-3 rounded-lg bg-[#f4f5f1] px-3 py-6 text-center text-[12px] text-muted">{t("rq.none")}</p>
            ) : (
              <div className="mt-3">
                <DataTable>
                  <Thead>
                    <tr>{[t("rq.request"), t("rq.sentTo"), t("rq.due"), t("rq.responded"), t("m.status")].map((heading) => <Th key={heading} scope="col">{heading}</Th>)}</tr>
                  </Thead>
                  <Tbody>
                    {requests.data.map((request) => (
                      <Tr key={request.id}>
                        <Td className="font-semibold text-ink">{request.title}</Td>
                        <Td className="text-ink-soft">{request.audienceLabel}</Td>
                        <Td className="text-ink-soft">{day(request.dueOn, t)}</Td>
                        <Td className="text-ink">{count(request.responded)} / {count(request.societies)}</Td>
                        <Td><Pill tone={STATUS[request.status].tone}>{t(STATUS[request.status].label)}</Pill></Td>
                      </Tr>
                    ))}
                  </Tbody>
                </DataTable>
                <div className="mt-2 flex justify-end text-[11px] text-muted">
                  <Pagination href={(target) => `/requests?page=${target}`} page={page} totalPages={requests.meta.totalPages} />
                </div>
              </div>
            )}
          </section>
          <section aria-labelledby="tasks" className="rounded-card border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("rq.myTasks")}</p>
                <h2 className="text-[15px] font-bold text-ink" id="tasks">{t("rq.openCount", { count: tasks.data.length })}</h2>
              </div>
              <Link className="text-[11px] font-semibold text-brand-forest underline" href="/reviews">{t("rq.goQueue")}</Link>
            </div>
            {tasks.data.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted">{t("rq.nothing")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line-soft">
                {tasks.data.map((task) => (
                  <li key={task.id}>
                    <Link className="flex items-center justify-between gap-3 py-3 text-[12px] text-ink hover:text-brand-forest" href={task.href}>
                      <span>{task.title}</span>
                      <span className="shrink-0 text-[11px] text-muted">{task.due ? day(task.due, t) : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[10px] text-muted">{t("rq.tasksNote")}</p>
          </section>
        </div>
      </div>
    </>
  );
}
