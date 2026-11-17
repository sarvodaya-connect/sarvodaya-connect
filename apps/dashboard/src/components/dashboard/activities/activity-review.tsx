"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import type { ActivityCategory, ActivityDimension } from "@sarvodaya-connect/api-contracts";

import type { ApprovalResult } from "@/app/(spc)/activities-to-approve/actions";
import { useI18n } from "@/i18n/provider";
import { type DevelopmentGoals, isComplete, missingGoals } from "@/lib/development-goals";

import { Icon } from "../icon";
import { SdgSelector } from "../sdg/sdg-selector";
import { ApproveDialog, type ApprovePhase } from "./approve-dialog";
import { DevelopmentGoalsPicker } from "./development-goals-picker";

type Decide = {
  approve: (goals: DevelopmentGoals) => Promise<ApprovalResult>;
  sendBack: (comment: string) => Promise<{ error?: string }>;
};

const buttonBase =
  "inline-flex items-center gap-2 rounded-button px-4 py-2.5 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-leaf disabled:cursor-not-allowed disabled:opacity-60";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{children}</p>;
}

function EditableBadge() {
  const { t } = useI18n();
  return <span className="rounded-full bg-[#e8f2e6] px-2.5 py-0.5 text-[10px] font-semibold text-brand-forest">{t("dg.editable")}</span>;
}

/**
 * V6 SP07g → SP07r → SP07s → SP08g (#170): the SPC chooses one or more
 * Sarvodaya dimensions, one or more of the ten categories and the UN SDGs,
 * checks them in a dialog and approves. A blocked or failed approval keeps
 * every choice; nothing is saved until the dialog's "Approve activity". The
 * activity can still be sent back with a note (M51b), as before.
 */
export function ActivityReview({
  actions,
  activityName,
  details,
  heading,
  initialGoals = { dimensions: [], categories: [], sdgs: [] },
  officerName,
  subtitle,
}: {
  actions: Decide;
  activityName: string;
  details: React.ReactNode;
  heading: React.ReactNode;
  initialGoals?: DevelopmentGoals;
  officerName: string;
  subtitle?: string;
}) {
  const { t } = useI18n();
  const [dimensions, setDimensions] = useState<ActivityDimension[]>(initialGoals.dimensions);
  const [categories, setCategories] = useState<ActivityCategory[]>(initialGoals.categories);
  const [sdgs, setSdgs] = useState<number[]>(initialGoals.sdgs);
  const [showMissing, setShowMissing] = useState(false);
  const [blockedAttempt, setBlockedAttempt] = useState(0);
  const [phase, setPhase] = useState<ApprovePhase>();
  const [stale, setStale] = useState<string>();
  const [sendBackError, setSendBackError] = useState<string>();
  const [sendingBack, setSendingBack] = useState(false);
  const [sendBackPending, setSendBackPending] = useState(false);
  const [comment, setComment] = useState("");
  const [, startTransition] = useTransition();
  const inFlight = useRef(false);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);

  const goals: DevelopmentGoals = { dimensions, categories, sdgs };
  const missing = missingGoals(goals);
  const blocked = showMissing && !isComplete(goals);
  const approving = phase?.name === "submitting";
  const busy = approving || sendBackPending || inFlight.current;

  function review() {
    if (!isComplete(goals)) {
      setShowMissing(true);
      setBlockedAttempt((count) => count + 1);
      return;
    }
    setPhase({ name: "review" });
  }

  // After a blocked attempt, move to the summary above the choices so it is read first.
  useEffect(() => {
    if (blockedAttempt > 0) alertRef.current?.focus();
  }, [blockedAttempt]);

  // Closing the dialog returns focus to the button that opened it.
  const dialogWasOpen = useRef(false);
  useEffect(() => {
    if (phase) dialogWasOpen.current = true;
    else if (dialogWasOpen.current) {
      dialogWasOpen.current = false;
      reviewButtonRef.current?.focus();
    }
  }, [phase]);

  function closeDialog() {
    if (approving) return;
    setPhase(undefined);
  }

  function approve() {
    if (inFlight.current) return; // one approval at a time, however fast the clicks
    inFlight.current = true;
    setPhase({ name: "submitting" });
    startTransition(async () => {
      let result: ApprovalResult | undefined;
      try {
        result = await actions.approve(goals);
      } catch (error) {
        // A redirect after success arrives as a navigation, not an error; anything else failed.
        if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
        result = { error: t("dg.error.failed"), kind: "failed" };
      }
      inFlight.current = false;
      if (!result?.error) return; // approved: the list opens with the confirmation
      if (result.kind === "stale") {
        setStale(result.error);
        setPhase({ name: "stale", message: result.error });
      } else {
        setPhase({ name: "failed", message: result.error });
      }
    });
  }

  function sendBack() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSendBackError(undefined);
    setSendBackPending(true);
    startTransition(async () => {
      const result = await actions.sendBack(comment);
      inFlight.current = false;
      setSendBackPending(false);
      if (result?.error) setSendBackError(result.error);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {heading}
        <div className="flex flex-wrap gap-2">
          <button
            className={`${buttonBase} border border-line bg-surface text-ink hover:border-brand-leaf`}
            disabled={busy || Boolean(stale)}
            onClick={() => setSendingBack(true)}
            type="button"
          >
            {t("dg.sendBack")}
          </button>
          <button
            className={`${buttonBase} bg-brand-action text-white hover:bg-brand-action-pressed`}
            disabled={busy || Boolean(stale)}
            onClick={review}
            ref={reviewButtonRef}
            type="button"
          >
            <svg aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("dg.reviewApprove")}
          </button>
        </div>
      </div>

      {stale && !phase && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
          <Icon className="size-4 shrink-0" name="error" />
          <span className="flex-1">{stale}</span>
          <Link className="underline underline-offset-2" href="/activities-to-approve">
            {t("dg.confirm.backToList")}
          </Link>
        </p>
      )}
      {sendBackError && (
        <p className="mt-3 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
          {sendBackError}
        </p>
      )}

      {sendingBack && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1b2a22]/40 p-4">
          <div aria-labelledby="send-back-title" aria-modal="true" className="w-full max-w-md rounded-card bg-surface p-5 shadow-xl" role="dialog">
            <h2 className="text-[16px] font-bold text-ink" id="send-back-title">{t("dg.sendBackTitle", { name: officerName })}</h2>
            <p className="mt-1 text-[12px] text-ink-soft">{t("dg.sendBackBody")}</p>
            <label className="mt-3 block text-[12px] font-semibold text-ink">
              {t("dg.sendBackLabel")}
              <textarea
                className="mt-1 w-full rounded-input border border-line px-3 py-2 text-[12px] font-normal outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring"
                disabled={busy}
                maxLength={500}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                value={comment}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button className={`${buttonBase} border border-line bg-surface text-ink`} disabled={busy} onClick={() => setSendingBack(false)} type="button">
                {t("dg.cancel")}
              </button>
              <button className={`${buttonBase} bg-brand-action text-white hover:bg-brand-action-pressed`} disabled={busy} onClick={sendBack} type="button">
                {sendBackPending ? t("dg.sendingBack") : t("dg.sendBack")}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase && (
        <ApproveDialog
          activityName={activityName}
          goals={goals}
          officerName={officerName}
          onApprove={approve}
          onClose={closeDialog}
          phase={phase}
          subtitle={subtitle}
        />
      )}

      {details}

      {blocked && (
        <p
          className="mt-4 flex items-start gap-2 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text outline-none focus-visible:ring-2 focus-visible:ring-danger-text"
          ref={alertRef}
          role="alert"
          tabIndex={-1}
        >
          <Icon className="mt-0.5 size-4 shrink-0" name="error" />
          {t("dg.error.incomplete")}
        </p>
      )}

      <section aria-labelledby="dg-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Eyebrow>{t("dg.step2")}</Eyebrow>
            <h2 className="text-[15px] font-bold text-ink" id="dg-heading">{t("dg.title")}</h2>
          </div>
          <EditableBadge />
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">{t("dg.intro")}</p>
        <DevelopmentGoalsPicker
          categories={categories}
          dimensions={dimensions}
          disabled={busy || Boolean(stale)}
          errors={{
            dimensions: blocked && missing.dimensions ? t("dg.error.dimensions") : undefined,
            categories: blocked && missing.categories ? t("dg.error.categories") : undefined,
          }}
          onCategories={setCategories}
          onDimensions={setDimensions}
        />
      </section>

      {blocked && missing.sdgs && (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" id="dg-sdgs-error">
          <Icon className="size-4 shrink-0" name="error" />
          {t("dg.error.sdgs")}
        </p>
      )}

      <section aria-labelledby="sdg-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Eyebrow>{t("dg.step3")}</Eyebrow>
            <h2 className="text-[15px] font-bold text-ink" id="sdg-heading">{t("dg.sdgs")}</h2>
          </div>
          <EditableBadge />
        </div>
        <p className="mb-4 mt-1 text-[12px] text-ink-soft">{t("dg.sdgsIntro")}</p>
        <SdgSelector disabled={busy || Boolean(stale)} onChange={setSdgs} selected={sdgs} />
      </section>
    </>
  );
}
