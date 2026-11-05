"use client";

import Link from "next/link";
import { useActionState } from "react";

import { ACTIVITY_DIMENSIONS, SARVODAYA_SECTORS } from "@/lib/v5-constants";

import type { RecordFormResult } from "@/app/(dashboard)/societies/[id]/record-actions";
import { DIMENSION_LABELS, MONTH_NAMES } from "@/lib/activity-format";
import { submitWithoutReset } from "@/lib/use-form-submit";

import { primaryButtonClass, secondaryButtonClass } from "../data-states";

const field =
  "mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 text-[12px] font-normal text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";
const label = "block text-[12px] font-semibold text-ink";
const required = <span className="text-danger-text">*</span>;

const PEOPLE = [
  ["femaleParticipants", "Female participants", "Members and volunteers"],
  ["maleParticipants", "Male participants", "Members and volunteers"],
  ["youthParticipants", "Youth (15–25)", "Included above"],
  ["householdsBenefited", "Households benefited", "Families using the result"],
  ["womenHeadedHouseholds", "Women-headed households", "Of the households above"],
] as const;

/**
 * V5 M09a–M09c on the desktop: details and sector, participants, then
 * resources and partners. The SPC chooses the UN SDGs when approving.
 */
export function ActivityForm({
  action,
  societyId,
  spcName,
  years,
}: {
  action: (previous: RecordFormResult, form: FormData) => Promise<RecordFormResult>;
  societyId: string;
  spcName?: string;
  years: number[];
}) {
  const [state, submit, pending] = useActionState(action, {});
  const back = `/societies/${societyId}/work-plan`;
  return (
    <form className="mt-4 space-y-4" onSubmit={submitWithoutReset(submit)}>
      <section className="rounded-card border border-line bg-surface p-4">
        <h3 className="text-[14px] font-bold text-ink">1 · Details and Sector</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className={label}>
            Activity name {required}
            <input className={field} maxLength={150} name="name" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Year {required}
              <select className={field} defaultValue={years[0]} name="year">
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label className={label}>
              Month {required}
              <select className={field} name="month" required>
                {MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
            </label>
          </div>
          <label className={`${label} md:col-span-2`}>
            Description {required}
            <textarea className={field} maxLength={1000} minLength={10} name="description" required rows={3} />
          </label>
          <label className={label}>
            Dates (optional)
            <input className={field} maxLength={60} name="datesLabel" placeholder="12–14 Sep" />
          </label>
          <label className={label}>
            Sector {required}
            <select className={field} name="sector" required>
              {SARVODAYA_SECTORS.map((sector, index) => <option key={sector} value={sector}>{index + 1} · {sector}</option>)}
            </select>
            <span className="mt-1 block text-[11px] font-normal text-muted">One of the 10 Sarvodaya sectors.</span>
          </label>
        </div>
        <fieldset className="mt-3">
          <legend className={label}>Dimension {required}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {ACTIVITY_DIMENSIONS.map((dimension, index) => (
              <label className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-[12px] has-[:checked]:border-brand-forest has-[:checked]:bg-brand-mint" key={dimension}>
                <input defaultChecked={index === 0} name="dimension" type="radio" value={dimension} />
                {DIMENSION_LABELS[dimension]}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="rounded-card border border-line bg-surface p-4">
        <h3 className="text-[14px] font-bold text-ink">2 · Participants and Beneficiaries</h3>
        <p className="mt-1 text-[12px] text-ink-soft">Use your best count — it can change until the SPC approves.</p>
        <div className="mt-3 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PEOPLE.map(([name, title, note]) => (
            <label className="flex h-full flex-col rounded-lg border border-line p-3 text-[12px] font-semibold text-ink" key={name}>
              {title}
              <input className={field} inputMode="numeric" min={0} name={name} type="number" />
              <span className="mt-auto pt-1 text-[10px] font-normal text-muted">{note}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-4">
        <h3 className="text-[14px] font-bold text-ink">3 · Resources and Partners</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className={label}>
            Allocated cost (LKR) {required}
            <input className={field} inputMode="decimal" name="allocatedCost" required />
            <span className="mt-1 block text-[11px] font-normal text-muted">Planning amount only — not a payment or spending record.</span>
          </label>
          <label className={label}>
            Volunteer hours (optional)
            <input className={field} inputMode="numeric" min={0} name="volunteerHours" type="number" />
          </label>
          <label className={label}>
            Partners (optional)
            <input className={field} maxLength={500} name="partners" />
          </label>
          <label className={label}>
            Resources needed (optional)
            <input className={field} maxLength={500} name="resourcesNeeded" />
          </label>
        </div>
      </section>

      <p className="rounded-card border border-[#cfe2cf] bg-[#e8f2e6] px-4 py-3 text-[12px] text-ink-soft">
        This goes to {spcName ? <strong className="text-ink">{spcName} (SPC)</strong> : "the society’s SPC"}. They choose the UN SDGs and
        approve it. Until then it shows as “Waiting for SPC” in the work plan.
      </p>
      {state.error && (
        <p className="rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex justify-end gap-2.5">
        <Link className={secondaryButtonClass} href={back}>Cancel</Link>
        <button className={primaryButtonClass} disabled={pending} type="submit">
          {pending ? "Sending…" : "Send to SPC"}
        </button>
      </div>
    </form>
  );
}
