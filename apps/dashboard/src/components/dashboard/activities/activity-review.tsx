"use client";

import { useState, useTransition } from "react";

import { SdgSelector } from "../sdg/sdg-selector";

type Decide = {
  approve: (sdgs: number[]) => Promise<{ error?: string }>;
  sendBack: (comment: string) => Promise<{ error?: string }>;
};

const buttonBase =
  "inline-flex items-center gap-2 rounded-button px-4 py-2.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60";

/**
 * V5 SP07: the SPC chooses the UN SDGs and approves, or sends the activity
 * back with an optional note (M51b). Both buttons are off while one is saving.
 */
export function ActivityReview({
  actions,
  details,
  heading,
  initialSdgs = [],
  officerName,
}: {
  actions: Decide;
  details: React.ReactNode;
  heading: React.ReactNode;
  initialSdgs?: number[];
  officerName: string;
}) {
  const [sdgs, setSdgs] = useState<number[]>(initialSdgs);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<"approve" | "send-back">();
  const [sendingBack, setSendingBack] = useState(false);
  const [comment, setComment] = useState("");
  const [, startTransition] = useTransition();

  function run(kind: "approve" | "send-back") {
    setError(undefined);
    if (kind === "approve" && sdgs.length === 0) {
      setError("Choose at least one UN SDG to approve.");
      return;
    }
    setPending(kind);
    startTransition(async () => {
      const result = kind === "approve" ? await actions.approve(sdgs) : await actions.sendBack(comment);
      setPending(undefined);
      if (result?.error) setError(result.error);
    });
  }

  const busy = pending !== undefined;
  const approveLabel =
    pending === "approve" ? "Approving…" : sdgs.length ? `Approve with ${sdgs.length} ${sdgs.length === 1 ? "SDG" : "SDGs"}` : "Approve";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {heading}
        <div className="flex flex-wrap gap-2">
        <button
          className={`${buttonBase} border border-line bg-surface text-ink hover:border-brand-leaf`}
          disabled={busy}
          onClick={() => setSendingBack(true)}
          type="button"
        >
          Send back
        </button>
        <button
          className={`${buttonBase} bg-brand-action text-white hover:bg-brand-action-pressed`}
          disabled={busy}
          onClick={() => run("approve")}
          type="button"
        >
          <svg aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {approveLabel}
        </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
          {error}
        </p>
      )}

      {sendingBack && (
        <div
          aria-labelledby="send-back-title"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#1b2a22]/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-card bg-surface p-5 shadow-xl">
            <h2 className="text-[16px] font-bold text-ink" id="send-back-title">Send Back to {officerName}?</h2>
            <p className="mt-1 text-[12px] text-ink-soft">
              The activity goes back to the Society Officer to change. It stays out of the dashboards until you approve it.
            </p>
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
              <button
                className={`${buttonBase} border border-line bg-surface text-ink`}
                disabled={busy}
                onClick={() => setSendingBack(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`${buttonBase} bg-brand-action text-white hover:bg-brand-action-pressed`}
                disabled={busy}
                onClick={() => run("send-back")}
                type="button"
              >
                {pending === "send-back" ? "Sending back…" : "Send back"}
              </button>
            </div>
          </div>
        </div>
      )}

      {details}

      <section aria-labelledby="sdg-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">2 · You Choose</p>
            <h2 className="text-[15px] font-bold text-ink" id="sdg-heading">UN SDGs</h2>
          </div>
          <span className="rounded-full bg-[#e8f2e6] px-2.5 py-0.5 text-[10px] font-semibold text-brand-forest">Editable</span>
        </div>
        <p className="mb-4 mt-1 text-[12px] text-ink-soft">
          Choose every goal this activity works towards. Society Officers do not choose SDGs.
        </p>
        <SdgSelector disabled={busy} onChange={setSdgs} selected={sdgs} />
      </section>
    </>
  );
}
