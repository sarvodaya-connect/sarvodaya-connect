"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { ActivityApprovalInput, ActivityCategory, ActivityDimension } from "@sarvodaya-connect/api-contracts";

import { useI18n } from "@/i18n/provider";
import { ACTIVITY_CATEGORIES, ACTIVITY_DIMENSIONS } from "@/lib/activity-format";

import { SdgSelector } from "../sdg/sdg-selector";
import {
  CategoryPicker,
  categoryLabel,
  DimensionPicker,
  dimensionLabel,
  FieldError,
  GoalsSummary,
  inCatalogueOrder,
  SelectionStatus,
} from "./development-goals";

/** What an approval attempt can come back with. `stale`: changed or decided elsewhere, nothing saved. */
export type ApproveResult = { error?: string; kind?: "failed" | "stale" | "invalid" };

type Decide = {
  approve: (input: ActivityApprovalInput) => Promise<ApproveResult>;
  sendBack: (comment: string) => Promise<{ error?: string }>;
};

const buttonBase =
  "inline-flex items-center gap-2 rounded-button px-4 py-2.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60";
const primaryButton = `${buttonBase} bg-brand-action text-white hover:bg-brand-action-pressed`;
const secondaryButton = `${buttonBase} border border-line bg-surface text-ink hover:border-brand-leaf`;

const approveIcon = (
  <svg aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

/**
 * Keeps keyboard focus inside an open dialog and lets Escape close it. While a
 * decision is being sent every control is disabled, so the dialog itself
 * (`tabIndex={-1}`) holds focus until they are enabled again.
 */
function useDialogKeys(ref: React.RefObject<HTMLDivElement | null>, open: boolean, busy: boolean, onEscape: () => void) {
  useEffect(() => {
    if (open && busy) ref.current?.focus();
  }, [ref, open, busy]);
  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...node.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled])")];
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (document.activeElement === node) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", handle);
    return () => node.removeEventListener("keydown", handle);
  }, [ref, open, onEscape]);
}

/**
 * V6 SP07g–SP07x: the SPC chooses the Sarvodaya dimensions, the Sarvodaya
 * categories and the UN SDGs, checks them in a dialog and approves, or sends
 * the activity back with an optional note (M51b). Choices are kept after a
 * blocked or failed save, and only one decision is sent at a time.
 */
export function ActivityReview({
  actions,
  activityName,
  details,
  heading,
  initialSdgs = [],
  officerName,
  subtitle,
}: {
  actions: Decide;
  activityName: string;
  details: React.ReactNode;
  heading: React.ReactNode;
  initialSdgs?: number[];
  officerName: string;
  /** Society, sender and time, repeated under the dialog title. */
  subtitle?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [dimensions, setDimensions] = useState<ActivityDimension[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [sdgs, setSdgs] = useState<number[]>(initialSdgs);
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [approveResult, setApproveResult] = useState<ApproveResult>();
  // Changed or decided elsewhere: no further decision until the activity is reloaded.
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState<"approve" | "send-back">();
  const [sendingBack, setSendingBack] = useState(false);
  const [sendBackError, setSendBackError] = useState<string>();
  const [comment, setComment] = useState("");
  const [, startTransition] = useTransition();
  // A second click before React re-renders must not send a second decision.
  const inFlight = useRef(false);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const sendBackButton = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const sendBackRef = useRef<HTMLDivElement>(null);

  const busy = pending !== undefined;
  const orderedDimensions = inCatalogueOrder(ACTIVITY_DIMENSIONS, dimensions);
  const orderedCategories = inCatalogueOrder(ACTIVITY_CATEGORIES, categories);
  const missing = { dimension: orderedDimensions.length === 0, category: orderedCategories.length === 0, sdg: sdgs.length === 0 };
  const complete = !missing.dimension && !missing.category && !missing.sdg;

  const closeConfirm = useCallback(() => {
    if (inFlight.current) return;
    setConfirming(false);
    setApproveResult(undefined);
    reviewButton.current?.focus();
  }, []);
  const closeSendBack = useCallback(() => {
    if (inFlight.current) return;
    setSendingBack(false);
    setSendBackError(undefined);
    sendBackButton.current?.focus();
  }, []);
  useDialogKeys(confirmRef, confirming, busy, closeConfirm);
  useDialogKeys(sendBackRef, sendingBack, busy, closeSendBack);

  useEffect(() => {
    if (confirming) confirmRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [confirming]);
  useEffect(() => {
    if (sendingBack) sendBackRef.current?.querySelector<HTMLElement>("textarea")?.focus();
  }, [sendingBack]);
  useEffect(() => {
    if (showErrors) summaryRef.current?.focus();
  }, [showErrors]);

  function review() {
    if (!complete) {
      // Re-show (and re-focus) the summary on every blocked attempt.
      setShowErrors(false);
      requestAnimationFrame(() => setShowErrors(true));
      return;
    }
    setShowErrors(false);
    setApproveResult(undefined);
    setConfirming(true);
  }

  function approve() {
    if (inFlight.current || stale || !complete) return;
    inFlight.current = true;
    setPending("approve");
    setApproveResult(undefined);
    startTransition(async () => {
      let result: ApproveResult | undefined;
      try {
        result = await actions.approve({ dimensions: orderedDimensions, categories: orderedCategories, sdgs });
      } catch (error) {
        // A redirect after a successful save is not a failure.
        if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
        result = { kind: "failed" };
      } finally {
        inFlight.current = false;
        setPending(undefined);
      }
      // On success the action redirects; only problems come back here.
      if (result?.kind === "stale") setStale(true);
      if (result && (result.error || result.kind)) setApproveResult(result);
    });
  }

  function reload() {
    startTransition(() => {
      router.refresh();
      setStale(false);
      setApproveResult(undefined);
    });
  }

  function sendBack() {
    if (inFlight.current || stale) return;
    inFlight.current = true;
    setPending("send-back");
    setSendBackError(undefined);
    startTransition(async () => {
      try {
        const result = await actions.sendBack(comment);
        if (result?.error) setSendBackError(result.error);
      } catch (error) {
        // A redirect after a successful send-back is not a failure.
        if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
        setSendBackError("The activity could not be sent back. Try again.");
      } finally {
        inFlight.current = false;
        setPending(undefined);
      }
    });
  }

  const failedMessage =
    approveResult && !stale ? (approveResult.kind === "invalid" && approveResult.error ? approveResult.error : t("goals.failed")) : undefined;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {heading}
        <div className="flex flex-wrap gap-2">
          <button className={secondaryButton} disabled={busy || stale} onClick={() => setSendingBack(true)} ref={sendBackButton} type="button">
            {t("goals.sendBack")}
          </button>
          <button className={primaryButton} disabled={busy || stale} onClick={review} ref={reviewButton} type="button">
            {approveIcon}
            {t("goals.reviewApprove")}
          </button>
        </div>
      </div>

      {stale && !confirming && (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#ead9a7] bg-warn-bg px-3 py-2 text-[12px] font-semibold text-warn-text"
          role="alert"
        >
          <span>{t("goals.stale")}</span>
          <button className={secondaryButton} onClick={reload} type="button">
            {t("goals.reload")}
          </button>
        </div>
      )}

      {showErrors && !complete && (
        <p
          className="mt-3 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text outline-none"
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
        >
          {t("goals.errorSummary")}
        </p>
      )}

      {details}

      <section aria-labelledby="goals-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("goals.youChooseStep", { step: 2 })}</p>
            <h2 className="text-[15px] font-bold text-ink" id="goals-heading">{t("goals.title")}</h2>
          </div>
          <span className="rounded-full bg-[#e8f2e6] px-2.5 py-0.5 text-[10px] font-semibold text-brand-forest">{t("goals.editable")}</span>
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">{t("goals.intro")}</p>

        <fieldset aria-describedby="dimensions-hint" className="mt-4">
          <legend className="text-[13px] font-bold text-ink">
            {t("goals.dimensions")} <span aria-hidden className="text-danger-text">*</span>
          </legend>
          <p className="text-[11px] text-ink-soft" id="dimensions-hint">{t("goals.selectDimensions")}</p>
          <SelectionStatus labels={orderedDimensions.map((dimension) => dimensionLabel(t, dimension))} t={t} />
          <FieldError id="dimensions-error" message={showErrors && missing.dimension ? t("goals.chooseDimension") : undefined} />
          <DimensionPicker
            disabled={busy}
            errorId={showErrors && missing.dimension ? "dimensions-error" : undefined}
            onToggle={(dimension) => setDimensions((current) => toggle(current, dimension))}
            selected={orderedDimensions}
            t={t}
          />
        </fieldset>

        <div aria-hidden className="mt-5 border-t border-line-soft" />
        <fieldset aria-describedby="categories-hint" className="mt-4">
          <legend className="text-[13px] font-bold text-ink">
            {t("goals.categories")} <span aria-hidden className="text-danger-text">*</span>
          </legend>
          <p className="text-[11px] text-ink-soft" id="categories-hint">{t("goals.selectCategories")}</p>
          <SelectionStatus labels={orderedCategories.map((category) => categoryLabel(t, category))} t={t} />
          <FieldError id="categories-error" message={showErrors && missing.category ? t("goals.chooseCategory") : undefined} />
          <CategoryPicker
            disabled={busy}
            errorId={showErrors && missing.category ? "categories-error" : undefined}
            onToggle={(category) => setCategories((current) => toggle(current, category))}
            selected={orderedCategories}
            t={t}
          />
        </fieldset>
      </section>

      <section aria-labelledby="sdg-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("goals.youChooseStep", { step: 3 })}</p>
            <h2 className="text-[15px] font-bold text-ink" id="sdg-heading">{t("goals.sdgs")}</h2>
          </div>
          <span className="rounded-full bg-[#e8f2e6] px-2.5 py-0.5 text-[10px] font-semibold text-brand-forest">{t("goals.editable")}</span>
        </div>
        <p className="mb-4 mt-1 text-[12px] text-ink-soft">{t("goals.sdgsIntro")}</p>
        {showErrors && missing.sdg && (
          <div className="mb-3">
            <FieldError id="sdgs-error" message={t("goals.chooseSdg")} />
          </div>
        )}
        <SdgSelector disabled={busy} onChange={setSdgs} selected={sdgs} />
      </section>

      {confirming && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1b2a22]/40 p-4">
          <div
            aria-describedby="confirm-note"
            aria-labelledby="confirm-title"
            aria-modal="true"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-card bg-surface p-5 shadow-xl outline-none"
            ref={confirmRef}
            role="dialog"
            tabIndex={-1}
          >
            <h2 className="text-[17px] font-bold text-ink" id="confirm-title">{t("goals.confirmTitle", { name: activityName })}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-ink-soft">{subtitle}</p>}

            {failedMessage && (
              <p className="mt-3 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
                {failedMessage}
              </p>
            )}
            {stale && (
              <p className="mt-3 rounded-lg border border-[#ead9a7] bg-warn-bg px-3 py-2 text-[12px] font-semibold text-warn-text" role="alert">
                {t("goals.stale")}
              </p>
            )}

            <div className="mt-3 rounded-lg border border-line-soft bg-[#f4f5f1] p-3">
              <p className="mb-2 text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("goals.youChose")}</p>
              <GoalsSummary classification={{ dimensions: orderedDimensions, categories: orderedCategories }} sdgs={sdgs} t={t} />
            </div>
            <p className="mt-3 text-[12px] text-ink-soft" id="confirm-note">{t("goals.confirmNote", { officer: officerName })}</p>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className={secondaryButton} disabled={busy} onClick={closeConfirm} type="button">
                {t("goals.backToEdit")}
              </button>
              {stale ? (
                <button className={primaryButton} data-autofocus onClick={reload} type="button">
                  {t("goals.reload")}
                </button>
              ) : (
                <button className={primaryButton} data-autofocus disabled={busy} onClick={approve} type="button">
                  {approveIcon}
                  {busy ? t("goals.approving") : failedMessage ? t("goals.tryAgain") : t("goals.approveActivity")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {sendingBack && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1b2a22]/40 p-4">
          <div
            aria-labelledby="send-back-title"
            aria-modal="true"
            className="w-full max-w-md rounded-card bg-surface p-5 shadow-xl outline-none"
            ref={sendBackRef}
            role="dialog"
            tabIndex={-1}
          >
            <h2 className="text-[16px] font-bold text-ink" id="send-back-title">Send Back to {officerName}?</h2>
            <p className="mt-1 text-[12px] text-ink-soft">
              The activity goes back to the Society Officer to change. It stays out of the dashboards until you approve it.
            </p>
            {sendBackError && (
              <p className="mt-3 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
                {sendBackError}
              </p>
            )}
            <label className="mt-3 block text-[12px] font-semibold text-ink">
              What should change? (optional)
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
              <button className={`${buttonBase} border border-line bg-surface text-ink`} disabled={busy} onClick={closeSendBack} type="button">
                Cancel
              </button>
              <button className={primaryButton} disabled={busy} onClick={sendBack} type="button">
                {pending === "send-back" ? "Sending Back…" : "Send Back"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
