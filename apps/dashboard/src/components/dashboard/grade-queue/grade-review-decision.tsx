"use client";

import Link from "next/link";
import { useState } from "react";

import type { GradeDecision, GradeRequestDetail } from "@sarvodaya-connect/api-contracts";

import { primaryButtonClass, secondaryButtonClass } from "../data-states";
import { Icon } from "../icon";
import { useI18n } from "@/i18n/provider";

export type DecideFromQueue = (decision: GradeDecision, comment: string) => Promise<{ error?: string }>;

/**
 * V5 D22r "Your decision". Approving changes the grade straight away;
 * rejecting keeps it and needs a comment, which the requester sees.
 */
export function GradeReviewDecision({ decide, request }: { decide: DecideFromQueue; request: GradeRequestDetail }) {
  const { t } = useI18n();
  const [decision, setDecision] = useState<GradeDecision>("APPROVE");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const current = request.fromGrade ?? t("sr.notSet");
  const reasonMissing = decision === "REJECT" && !comment.trim();

  async function submit() {
    if (reasonMissing) return;
    setPending(true);
    setError(undefined);
    const result = await decide(decision, comment);
    // On success the action redirects; only errors come back here.
    setPending(false);
    if (result.error) setError(result.error);
  }

  const option = (value: GradeDecision, title: string, hint: string) => (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3.5 ${
        decision === value ? "border-brand-action bg-brand-mint-soft ring-1 ring-brand-action" : "border-line bg-surface"
      }`}
    >
      <input
        checked={decision === value}
        className="mt-1 accent-[var(--brand-action)]"
        name="decision"
        onChange={() => setDecision(value)}
        type="radio"
        value={value}
      />
      <span>
        <strong className="block text-[13px] text-ink">{title}</strong>
        <span className="text-[11.5px] text-ink-soft">{hint}</span>
      </span>
    </label>
  );

  return (
    <section aria-labelledby="decision-heading" className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-[16px] font-bold text-ink" id="decision-heading">{t("sr.r.yourDecision")}</h2>
      <fieldset className="mt-3 space-y-3" disabled={pending}>
        <legend className="sr-only">{t("sr.r.approveOrReject")}</legend>
        {option("APPROVE", t("sr.r.optApprove", { grade: request.toGrade }), t("sr.r.optApproveHint"))}
        {option("REJECT", t("sr.r.optReject", { grade: current }), t("sr.r.optRejectHint"))}
      </fieldset>
      <label className="mt-4 block text-[12.5px] font-semibold text-ink">
        {t("sr.r.comment")} {decision === "REJECT" && <span className="text-danger-text">*</span>}
        <input
          aria-invalid={reasonMissing || undefined}
          className={`mt-1.5 h-10 w-full rounded-input border bg-surface px-3 text-[13px] font-normal outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring ${
            reasonMissing ? "border-danger-text" : "border-line"
          }`}
          disabled={pending}
          maxLength={500}
          onChange={(event) => setComment(event.target.value)}
          value={comment}
        />
        <span className={`mt-1 block text-[11px] ${reasonMissing ? "text-danger-text" : "font-normal text-ink-soft"}`}>
          {reasonMissing ? t("sr.gr.reasonRequired") : t("sr.r.shownTo", { name: request.requestedBy.displayName })}
        </span>
      </label>
      <p className="mt-4 flex gap-2.5 rounded-xl border border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] px-3.5 py-2.5 text-[12px] text-[var(--banner-edit-text)]">
        <Icon className="mt-0.5 size-4 shrink-0" name="clock" strokeWidth={2} />
        {t("sr.r.logged")}
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link className={secondaryButtonClass} href="/reviews">{t("sr.r.backToQueue")}</Link>
        <button
          className={
            decision === "APPROVE"
              ? primaryButtonClass
              : `${secondaryButtonClass} border-[#efc4bd] text-danger-text hover:bg-danger-bg`
          }
          disabled={pending || reasonMissing}
          onClick={submit}
          type="button"
        >
          <Icon className="size-4" name={decision === "APPROVE" ? "success" : "close"} strokeWidth={2} />
          {pending ? t("sr.saving") : decision === "APPROVE" ? t("sr.r.approveGrade", { grade: request.toGrade }) : t("sr.r.rejectKeep", { grade: current })}
        </button>
      </div>
    </section>
  );
}
