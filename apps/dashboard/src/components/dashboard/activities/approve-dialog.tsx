"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { useI18n } from "@/i18n/provider";
import type { DevelopmentGoals } from "@/lib/development-goals";

import { Icon } from "../icon";
import { SdgChips } from "../sdg/sdg-chip";
import { DevelopmentGoalChips } from "./development-goals-picker";

export type ApprovePhase =
  | { name: "review" }
  | { name: "submitting" }
  | { name: "failed"; message: string }
  | { name: "stale"; message: string };

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-button px-4 py-2.5 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-leaf disabled:cursor-not-allowed disabled:opacity-60";

/**
 * V6 SP07r (check and approve), SP07s (approving…) and SP07x (could not
 * approve, selections kept). Nothing is saved until "Approve activity"; "Back
 * to edit" and Escape close it without changing the activity. While saving,
 * both buttons are off so the approval can't be sent twice. A stale activity
 * (already decided) offers no second decision, only the way back to the list.
 */
export function ApproveDialog({
  activityName,
  goals,
  officerName,
  onApprove,
  onClose,
  phase,
  subtitle,
}: {
  activityName: string;
  goals: DevelopmentGoals;
  officerName: string;
  onApprove: () => void;
  onClose: () => void;
  phase: ApprovePhase;
  subtitle?: string;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const submitting = phase.name === "submitting";

  // Focus starts on the main action; a stale activity moves it to the way back.
  useEffect(() => {
    if (phase.name === "submitting") return;
    (primaryRef.current ?? dialogRef.current?.querySelector<HTMLElement>("a[href]"))?.focus();
  }, [phase.name]);

  // Keep keyboard focus inside the dialog; Escape is "Back to edit".
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!submitting) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
    if (!focusable || focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#1b2a22]/40 p-4">
      <div
        aria-busy={submitting || undefined}
        aria-describedby={phase.name === "stale" ? undefined : "approve-note"}
        aria-labelledby="approve-title"
        aria-modal="true"
        className="w-full max-w-[640px] rounded-card bg-surface p-5 shadow-xl"
        onKeyDown={onKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <h2 className="text-[18px] font-bold text-ink" id="approve-title">
          {t("dg.confirm.title", { name: activityName })}
        </h2>
        {subtitle && <p className="mt-0.5 text-[12px] text-ink-soft">{subtitle}</p>}

        {(phase.name === "failed" || phase.name === "stale") && (
          <p
            className="mt-3 flex items-start gap-2 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text"
            role="alert"
          >
            <Icon className="mt-0.5 size-4 shrink-0" name="error" />
            {phase.message}
          </p>
        )}

        <section aria-labelledby="approve-chose" className="mt-3 rounded-lg border border-line-soft bg-[#f6f7f3] p-3.5">
          <h3 className="text-[10px] font-bold tracking-[0.08em] text-brand-forest" id="approve-chose">
            {t("dg.confirm.chose")}
          </h3>
          <div className="mt-2">
            <DevelopmentGoalChips
              categories={goals.categories}
              dimensions={goals.dimensions}
              layout="columns"
              sdgs={
                <span className="flex flex-col items-start gap-1.5">
                  <SdgChips sdgs={goals.sdgs} t={t} />
                </span>
              }
            />
          </div>
        </section>

        {phase.name !== "stale" && (
          <p className="mt-3 text-[12px] text-ink-soft" id="approve-note">
            {t("dg.confirm.note", { officer: officerName })}
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {phase.name === "stale" ? (
            <Link className={`${buttonBase} bg-brand-action text-white hover:bg-brand-action-pressed`} href="/activities-to-approve">
              {t("dg.confirm.backToList")}
            </Link>
          ) : (
            <>
              <button
                className={`${buttonBase} border border-line bg-surface text-ink hover:border-brand-leaf`}
                disabled={submitting}
                onClick={onClose}
                type="button"
              >
                {t("dg.confirm.back")}
              </button>
              <button
                className={`${buttonBase} bg-brand-action text-white hover:bg-brand-action-pressed`}
                disabled={submitting}
                onClick={onApprove}
                ref={primaryRef}
                type="button"
              >
                {submitting && (
                  <svg aria-hidden className="size-4 motion-safe:animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" opacity="0.3" r="9" stroke="currentColor" strokeWidth="3" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
                  </svg>
                )}
                {submitting ? t("dg.confirm.approving") : phase.name === "failed" ? t("dg.confirm.retry") : t("dg.confirm.approve")}
              </button>
            </>
          )}
        </div>
        <p aria-live="polite" className="sr-only">
          {submitting ? t("dg.confirm.approving") : ""}
        </p>
      </div>
    </div>
  );
}
