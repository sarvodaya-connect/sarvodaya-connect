"use client";

import { useState } from "react";

import type { GradeChangeRequest, GradeDecision } from "@sarvodaya-connect/api-contracts";

export type DecideGradeRequest = (
  requestId: string,
  decision: GradeDecision,
  comment: string,
) => Promise<{ error?: string }>;

const buttonClass =
  "rounded-button px-4 py-2 text-[12px] font-semibold disabled:cursor-not-allowed disabled:bg-[#dfe3dd] disabled:text-[#9aa39d]";

/**
 * D05: HQ's Approve and Reject actions on a waiting grade request. A reason is
 * needed to reject; approving changes the society's grade to the requested one.
 */
export function GradeDecisionActions({ decide, request }: { decide: DecideGradeRequest; request: GradeChangeRequest }) {
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState<GradeDecision>();
  const [error, setError] = useState<string>();
  const [rejecting, setRejecting] = useState(false);
  const reasonMissing = rejecting && !comment.trim();

  async function submit(decision: GradeDecision) {
    if (decision === "REJECT" && !comment.trim()) {
      setRejecting(true);
      setError(undefined);
      return;
    }
    setPending(decision);
    setError(undefined);
    const result = await decide(request.id, decision, comment);
    setPending(undefined);
    if (result.error) setError(result.error);
  }

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <label className="block text-[11px] font-semibold text-ink-soft">
        HQ comment {rejecting && <span className="text-danger-text">*</span>}
        <textarea
          aria-invalid={reasonMissing || undefined}
          className={`mt-1 w-full rounded-input border bg-surface px-3 py-2 text-[12px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring ${
            reasonMissing ? "border-danger-text" : "border-line"
          }`}
          disabled={pending !== undefined}
          maxLength={500}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Optional when approving. Required when rejecting."
          rows={2}
          value={comment}
        />
        <span className={`mt-1 block text-[10px] ${reasonMissing ? "font-semibold text-danger-text" : "font-normal text-muted"}`}>
          {reasonMissing
            ? "Enter a reason for rejecting. The requester will see it."
            : `Approving changes the grade to ${request.toGrade}. Rejecting keeps it at ${request.fromGrade ?? "not set"}.`}
        </span>
      </label>
      {error && (
        <p className="mt-2 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[11px] font-semibold text-danger-text" role="alert">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          className={`${buttonClass} border border-[#efc4bd] bg-surface text-danger-text hover:bg-danger-bg`}
          disabled={pending !== undefined}
          onClick={() => submit("REJECT")}
          type="button"
        >
          {pending === "REJECT" ? "Rejecting…" : "Reject"}
        </button>
        <button
          className={`${buttonClass} bg-brand-action text-white hover:bg-brand-action-pressed`}
          disabled={pending !== undefined}
          onClick={() => submit("APPROVE")}
          type="button"
        >
          {pending === "APPROVE" ? "Approving…" : `Approve ${request.fromGrade ?? "–"} → ${request.toGrade}`}
        </button>
      </div>
    </div>
  );
}
