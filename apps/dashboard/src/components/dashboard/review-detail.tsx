"use client";

import type { SubmissionAction, SubmissionDetail } from "@sarvodaya-connect/api-contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ReviewActionInput, ReviewActionResult } from "@/lib/review-actions";
import { submissionTypeLabel } from "@/lib/submission-view";

type Mode = "REJECT" | "REQUEST_CHANGES" | null;

const STATUS_LABEL: Record<SubmissionDetail["status"], string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  CHANGES_REQUESTED: "Changes requested",
  RESUBMITTED: "Resubmitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const EVENT_LABEL: Record<SubmissionAction, string> = {
  SUBMIT: "Submitted",
  START_REVIEW: "Review started",
  REQUEST_CHANGES: "Changes requested",
  APPROVE: "Approved",
  REJECT: "Rejected",
  RESUBMIT: "Resubmitted",
};

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

const buttonBase =
  "rounded-button px-3 py-1.5 text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0] disabled:opacity-60";
const primary = `${buttonBase} bg-brand-action text-white hover:bg-brand-action-pressed`;
const secondary = `${buttonBase} border border-line bg-surface text-ink hover:bg-surface-muted`;

export function ReviewDetail({
  performAction,
  submission,
}: {
  performAction: (input: ReviewActionInput) => Promise<ReviewActionResult>;
  submission: SubmissionDetail;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [comment, setComment] = useState("");
  const [returned, setReturned] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState(false);

  const allowed = new Set<SubmissionAction>(submission.allowedActions);

  async function send(input: Omit<ReviewActionInput, "id" | "version">) {
    setPending(true);
    setError(null);
    setConflict(false);
    try {
      const result = await performAction({ id: submission.id, version: submission.version, ...input });
      if (result.ok) {
        setMode(null);
        setComment("");
        setReturned({});
        router.refresh();
      } else {
        setError(result.message);
        setConflict(Boolean(result.conflict));
      }
    } finally {
      setPending(false);
    }
  }

  function confirmReject() {
    if (!comment.trim()) {
      setError("Give a reason for rejecting this submission.");
      return;
    }
    void send({ action: "REJECT", comment });
  }

  function confirmRequestChanges() {
    const fields = Object.entries(returned);
    if (fields.length === 0) {
      setError("Select at least one field to return.");
      return;
    }
    if (fields.some(([, text]) => !text.trim())) {
      setError("Add a comment for each returned field.");
      return;
    }
    void send({
      action: "REQUEST_CHANGES",
      fields: fields.map(([field, text]) => ({ field, comment: text })),
    });
  }

  function toggleField(field: string, on: boolean) {
    setReturned((current) => {
      const next = { ...current };
      if (on) next[field] = next[field] ?? "";
      else delete next[field];
      return next;
    });
  }

  const hasActions = allowed.size > 0;

  return (
    <div className="mt-5 grid gap-5">
      <section className="rounded-card border border-line bg-surface px-5 py-4">
        <dl className="grid gap-3 text-[12.5px] sm:grid-cols-4">
          <div><dt className="text-muted">Status</dt><dd className="mt-0.5 font-semibold text-ink">{STATUS_LABEL[submission.status]}</dd></div>
          <div><dt className="text-muted">Type</dt><dd className="mt-0.5 text-ink">{submissionTypeLabel(submission.type)}</dd></div>
          <div><dt className="text-muted">Sent by</dt><dd className="mt-0.5 text-ink">{submission.submittedByName ?? submission.submittedBy}</dd></div>
          <div><dt className="text-muted">Reviewer</dt><dd className="mt-0.5 text-ink">{submission.reviewerDisplayName ?? "—"}</dd></div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <h2 className="border-b border-line-soft px-5 py-3 text-[13px] font-semibold text-ink">Changes</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <caption className="sr-only">Current and proposed values</caption>
            <thead className="bg-surface-muted text-[12px] font-medium text-ink-soft">
              <tr>
                {mode === "REQUEST_CHANGES" && <th className="px-5 py-3" scope="col">Return</th>}
                <th className="px-5 py-3" scope="col">Field</th>
                <th className="px-5 py-3" scope="col">Current</th>
                <th className="px-5 py-3" scope="col">Proposed</th>
                <th className="px-5 py-3" scope="col">Officer correction</th>
                <th className="px-5 py-3" scope="col">Reviewer comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {submission.changes.map((change) => (
                <tr key={change.field}>
                  {mode === "REQUEST_CHANGES" && (
                    <td className="px-5 py-2.5 align-top">
                      <input
                        aria-label={`Return ${change.label}`}
                        checked={change.field in returned}
                        onChange={(event) => toggleField(change.field, event.target.checked)}
                        type="checkbox"
                      />
                    </td>
                  )}
                  <td className="px-5 py-2.5 text-[12.5px] text-ink">{change.label}</td>
                  <td className="px-5 py-2.5 text-[12.5px] text-ink-soft">{show(change.previousValue)}</td>
                  <td className="px-5 py-2.5 text-[12.5px] text-ink">{show(change.proposedValue)}</td>
                  <td className="px-5 py-2.5 text-[12.5px] text-ink">{show(change.correctedValue)}</td>
                  <td className="px-5 py-2.5 text-[12.5px] text-ink-soft">
                    {change.field in returned ? (
                      <textarea
                        aria-label={`Comment for ${change.label}`}
                        className="w-full rounded-button border border-line px-2 py-1 text-[12px]"
                        maxLength={1000}
                        onChange={(event) => setReturned((current) => ({ ...current, [change.field]: event.target.value }))}
                        rows={2}
                        value={returned[change.field]}
                      />
                    ) : (
                      show(change.reviewerComment)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {hasActions && (
        <section aria-label="Review decision" className="rounded-card border border-line bg-surface px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {allowed.has("START_REVIEW") && (
              <button className={primary} disabled={pending} onClick={() => void send({ action: "START_REVIEW" })} type="button">
                Start review
              </button>
            )}
            {allowed.has("REQUEST_CHANGES") && (
              <button className={secondary} disabled={pending} onClick={() => { setMode("REQUEST_CHANGES"); setError(null); }} type="button">
                Request changes
              </button>
            )}
            {allowed.has("APPROVE") && (
              <button className={primary} disabled={pending} onClick={() => void send({ action: "APPROVE" })} type="button">
                Approve
              </button>
            )}
            {allowed.has("REJECT") && (
              <button className={secondary} disabled={pending} onClick={() => { setMode("REJECT"); setError(null); }} type="button">
                Reject
              </button>
            )}
          </div>

          {mode === "REJECT" && (
            <div className="mt-4 grid gap-2">
              <label className="text-[12px] font-medium text-ink" htmlFor="reject-reason">Reason for rejecting</label>
              <textarea
                className="w-full rounded-button border border-line px-2 py-1 text-[12.5px]"
                id="reject-reason"
                maxLength={1000}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                value={comment}
              />
              <div className="flex gap-2">
                <button className={primary} disabled={pending} onClick={confirmReject} type="button">Confirm rejection</button>
                <button className={secondary} onClick={() => { setMode(null); setError(null); }} type="button">Cancel</button>
              </div>
            </div>
          )}

          {mode === "REQUEST_CHANGES" && (
            <div className="mt-4 flex gap-2">
              <button className={primary} disabled={pending} onClick={confirmRequestChanges} type="button">Send changes request</button>
              <button className={secondary} onClick={() => { setMode(null); setReturned({}); setError(null); }} type="button">Cancel</button>
            </div>
          )}

          {error && (
            <p className="mt-3 text-[12.5px] text-danger-text" role="alert">
              {error}{" "}
              {conflict && (
                <button className="underline" onClick={() => router.refresh()} type="button">Reload this submission</button>
              )}
            </p>
          )}
        </section>
      )}

      <section className="rounded-card border border-line bg-surface px-5 py-4">
        <h2 className="text-[13px] font-semibold text-ink">History</h2>
        {submission.events.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted">No decisions yet.</p>
        ) : (
          <ol aria-label="Decision history" className="mt-3 grid gap-2">
            {submission.events.map((event) => (
              <li className="text-[12.5px] text-ink" key={event.id}>
                <strong>{EVENT_LABEL[event.action]}</strong> by {event.actorDisplayName}
                <span className="text-muted"> · {new Date(event.createdAt).toLocaleString("en-GB")}</span>
                {event.comment && <p className="text-ink-soft">“{event.comment}”</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
