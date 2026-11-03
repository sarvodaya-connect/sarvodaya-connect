"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { AccessFormState } from "@/app/(dashboard)/district-access/actions";
import { submitWithoutReset } from "@/lib/use-form-submit";

import { Icon } from "../icon";

const field =
  "mt-1 w-full rounded-input border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";

/** "2026-10-27T08:00" in Sri Lanka time, for datetime-local inputs. */
export function localInputValue(date: Date) {
  const local = new Date(date.getTime() + 5.5 * 3_600_000);
  return local.toISOString().slice(0, 16);
}

/**
 * V5 DM05 (and phone M30/M31). The DM chooses a DDM in their district, the
 * start and end, and an optional reason. Access is always view only.
 */
export function GiveAccessForm({
  action,
  deputies,
  districtName,
  societyCount,
  maxDays,
  now,
}: {
  action: (previous: AccessFormState, form: FormData) => Promise<AccessFormState>;
  deputies: { id: string; displayName: string }[];
  districtName: string;
  societyCount: number;
  maxDays: number;
  now: Date;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const [deputyId, setDeputyId] = useState(deputies.length === 1 ? deputies[0]!.id : "");
  const deputy = deputies.find((d) => d.id === deputyId);
  // Starts now (to the minute), so the DDM can use it straight away.
  const start = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const end = new Date(start.getTime() + 4 * 86_400_000);

  return (
    <form className="flex flex-col gap-4" onSubmit={submitWithoutReset(submit)}>
      <label className="block text-[12px] font-semibold text-ink">
        DDM <span className="text-danger-text">*</span>
        <select className={field} name="deputyId" onChange={(event) => setDeputyId(event.target.value)} required value={deputyId}>
          <option value="">Choose a DDM</option>
          {deputies.map((d) => (
            <option key={d.id} value={d.id}>
              {d.displayName} · {districtName}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] font-normal text-ink-soft">Only DDMs in your district are listed.</span>
      </label>

      <div className="text-[12px] font-semibold text-ink">
        Access
        <p className="mt-1 flex items-center justify-between rounded-input border border-line bg-surface-muted px-3 py-2.5 text-[12.5px] font-normal">
          View only · all {societyCount} {districtName} societies
          <Icon className="size-3.5 text-ink-soft" name="lock" strokeWidth={2.2} />
        </p>
        <span className="mt-1 block text-[11px] font-normal text-ink-soft">Read only</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[12px] font-semibold text-ink">
          Starts <span className="text-danger-text">*</span>
          <input className={field} defaultValue={localInputValue(start)} name="startsAt" required type="datetime-local" />
        </label>
        <label className="block text-[12px] font-semibold text-ink">
          Ends <span className="text-danger-text">*</span>
          <input className={field} defaultValue={localInputValue(end)} name="expiresAt" required type="datetime-local" />
          <span className="mt-1 block text-[11px] font-normal text-ink-soft">Access ends on its own at this time. At most {maxDays} days.</span>
        </label>
      </div>

      <label className="block text-[12px] font-semibold text-ink">
        Reason (optional)
        <input className={field} maxLength={1000} name="reason" placeholder="For example, annual leave" type="text" />
      </label>

      <div className="rounded-xl border border-line bg-surface-muted px-4 py-3 text-[12px]">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-brand-forest">{deputy ? deputy.displayName : "The DDM"} will be able to</p>
        <p className="mt-1 flex items-center gap-1.5 text-ink">
          <Icon className="size-3.5 text-brand-leaf" name="check" strokeWidth={2.4} />
          View all {societyCount} societies in {districtName}
        </p>
        <p className="mt-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-danger-text">They will not be able to</p>
        {["Edit societies outside their own", "Request grade changes for those societies", "Give access to anyone else"].map((text) => (
          <p className="mt-1 flex items-center gap-1.5 text-ink" key={text}>
            <Icon className="size-3.5 text-ink-soft" name="close" strokeWidth={2.4} />
            {text}
          </p>
        ))}
      </div>

      <p className="flex gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 py-2.5 text-[12px] text-ink-soft">
        <Icon className="mt-0.5 size-4 shrink-0" name="help" />
        The grant, any early end and the societies opened are recorded in the access history. HQ can see it too.
      </p>

      {state.error && (
        <p className="rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2.5">
        <Link className="inline-flex h-[38px] items-center rounded-button border border-button-line px-4 text-[13px] font-semibold text-ink hover:bg-brand-mint-soft" href="/district-access">
          Cancel
        </Link>
        <button
          className="inline-flex h-[38px] items-center rounded-button bg-brand-action px-4 text-[13px] font-semibold text-white hover:bg-brand-action-pressed disabled:cursor-not-allowed disabled:bg-[#dfe3dd] disabled:text-[#9aa39d]"
          disabled={pending || !deputyId}
          type="submit"
        >
          {pending ? "Giving access…" : "Give access"}
        </button>
      </div>
    </form>
  );
}

/** "End access now": asks first, then the DDM loses the district on their next request. */
export function EndAccessButton({
  action,
  grantId,
  deputyName,
  returnTo,
  compact = false,
}: {
  action: (form: FormData) => Promise<void>;
  grantId: string;
  deputyName: string;
  returnTo: "/dashboard" | "/district-access";
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`End ${deputyName}'s temporary access now? They will lose the district view straight away.`)) event.preventDefault();
        else setPending(true);
      }}
    >
      <input name="grantId" type="hidden" value={grantId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <button
        className={`inline-flex items-center gap-1.5 rounded-button border border-[#e3b4ae] bg-surface font-semibold text-danger-text hover:bg-danger-bg disabled:opacity-60 ${compact ? "h-8 px-3 text-[12px]" : "h-[38px] px-4 text-[13px]"}`}
        disabled={pending}
        type="submit"
      >
        {pending ? "Ending…" : compact ? "End now" : "End access now"}
      </button>
    </form>
  );
}
