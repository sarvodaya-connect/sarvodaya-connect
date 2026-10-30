import Link from "next/link";

import type { GradeChangeRequest, SocietyHistoryCategory, SocietyHistoryEvent } from "@sarvodaya-connect/api-contracts";

import { Pill } from "../ui/pill";
import type { RecordDocument } from "@/lib/society-record-api";
import { actorLabel, formatDate, ROLE_LABELS } from "@/lib/society-record-format";

const DOCUMENT_LABELS: Record<string, string> = {
  AUDIT_REPORT: "Audit report",
  AGM_MINUTES: "AGM minutes",
  OFFICE_BEARER_LIST: "Office-bearer list",
  MEMBERS_LIST: "Signed members list",
  REGISTRATION: "Registration",
  FINANCE: "Finance document",
  ACTIVITY_EVIDENCE: "Activity evidence",
  OTHER: "Document",
};

function Empty({ children }: { children: string }) {
  return <p className="mt-4 rounded-card border border-line bg-surface px-5 py-8 text-center text-[12px] text-muted">{children}</p>;
}

/** Documents tab: every uploaded file, with Open and Download through short-lived links. */
export function DocumentsList({ documents, societyId }: { documents: RecordDocument[]; societyId: string }) {
  if (documents.length === 0) return <Empty>No documents have been uploaded for this society yet.</Empty>;
  return (
    <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[720px] text-left text-[11px]">
        <thead className="bg-[#f6f7f4] text-[10px] text-muted">
          <tr>
            {["Document", "Type", "Year", "Uploaded", ""].map((heading) => (
              <th className="px-4 py-2 font-medium" key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {documents.map((document) => {
            const href = `/societies/${societyId}/documents/${document.id}/download`;
            return (
              <tr key={document.id}>
                <td className="px-4 py-2.5">
                  <span className="block font-bold text-ink">{document.title}</span>
                  <span className="text-[10px] text-muted">{document.fileName}</span>
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{DOCUMENT_LABELS[document.documentType] ?? document.documentType}</td>
                <td className="px-4 py-2.5 text-ink-soft">{document.financialYear?.label ?? "—"}</td>
                <td className="px-4 py-2.5 text-ink-soft">
                  {document.uploadedAt ? formatDate(document.uploadedAt) : "—"} by {document.uploadedBy}
                  {document.uploadedByRole && ` (${ROLE_LABELS[document.uploadedByRole as keyof typeof ROLE_LABELS] ?? document.uploadedByRole})`}
                </td>
                <td className="space-x-2 whitespace-nowrap px-4 py-2.5 text-right">
                  <a className="font-semibold text-brand-leaf underline underline-offset-2" href={href} rel="noopener" target="_blank">Open</a>
                  <a className="font-semibold text-brand-leaf underline underline-offset-2" download={document.fileName} href={href}>Download</a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const STATUS: Record<GradeChangeRequest["status"], { label: string; tone: "fast-target" | "on-time" | "overdue" }> = {
  PENDING: { label: "Waiting for HQ", tone: "fast-target" },
  APPROVED: { label: "Approved", tone: "on-time" },
  REJECTED: { label: "Rejected", tone: "overdue" },
};

/** Grade tab: the open request and earlier requests with each decision. */
export function GradeRequestList({ requests }: { requests: GradeChangeRequest[] }) {
  if (requests.length === 0) return <Empty>No grade-change requests have been sent for this society.</Empty>;
  return (
    <ul className="mt-4 space-y-3">
      {requests.map((request) => (
        <li className="rounded-card border border-line bg-surface px-4 py-3" key={request.id}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-bold text-ink">
              {request.fromGrade ?? "–"} → {request.toGrade}
            </p>
            <Pill tone={STATUS[request.status].tone}>{STATUS[request.status].label}</Pill>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">
            Sent by {actorLabel(request.requestedBy)} · {formatDate(request.requestedAt)}
          </p>
          <p className="mt-1 rounded bg-[#f4f5f2] px-2 py-1 text-[11px] text-ink-soft">“{request.reason}”</p>
          {request.decidedAt && request.decidedBy && (
            <p className="mt-1.5 text-[11px] text-ink-soft">
              {request.status === "APPROVED" ? "Approved" : "Rejected"} by {request.decidedBy.displayName} (HQ) ·{" "}
              {formatDate(request.decidedAt)}
              {request.decisionComment && ` · “${request.decisionComment}”`}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

const CATEGORIES: { label: string; value?: SocietyHistoryCategory }[] = [
  { label: "All" },
  { label: "Society", value: "SOCIETY" },
  { label: "Exco", value: "EXCO" },
  { label: "Work plan", value: "WORK_PLAN" },
  { label: "Annual summary", value: "ANNUAL_SUMMARY" },
  { label: "Grade", value: "GRADE" },
  { label: "Documents", value: "DOCUMENTS" },
];

/** History tab: every change with who made it and when (HQ's view of M06h). */
export function HistoryList({
  category,
  events,
  societyId,
}: {
  category?: SocietyHistoryCategory;
  events: SocietyHistoryEvent[];
  societyId: string;
}) {
  return (
    <>
      <nav aria-label="Filter history" className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map((item) => {
          const active = item.value === category;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`rounded-pill px-3 py-1.5 text-[11px] font-semibold ${
                active ? "bg-brand-forest text-white" : "border border-line bg-surface text-ink-soft hover:border-brand-leaf"
              }`}
              href={`/societies/${societyId}/history${item.value ? `?category=${item.value}` : ""}`}
              key={item.label}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {events.length === 0 ? (
        <Empty>No changes recorded here yet.</Empty>
      ) : (
        <ol className="mt-4 rounded-card border border-line bg-surface px-5 py-3">
          {events.map((event) => (
            <li className="relative border-l border-line py-2 pl-5" key={event.id}>
              <span aria-hidden="true" className={`absolute -left-[5px] top-3 size-2.5 rounded-full border-2 bg-surface ${event.category === "GRADE" ? "border-orange-changed" : "border-brand-forest"}`} />
              <p className="text-[12px] font-bold text-ink">{event.summary}</p>
              <p className="text-[10px] text-muted">
                {actorLabel(event.actor)} · {formatDate(event.occurredAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-center text-[10px] text-muted">Every change shows who made it and when.</p>
    </>
  );
}
