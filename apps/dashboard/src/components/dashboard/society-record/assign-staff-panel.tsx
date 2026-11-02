"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { SocietyRecord, StaffOption, StaffOptions } from "@sarvodaya-connect/api-contracts";

import type { RecordFormResult } from "@/app/(dashboard)/societies/[id]/record-actions";
import { submitWithoutReset } from "@/lib/use-form-submit";

import { Icon } from "../icon";

const selectClass =
  "mt-1 w-full rounded-input border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";

type Field = {
  name: "deputyId" | "coordinatorId" | "officerId";
  label: string;
  options: StaffOption[];
  hint: string;
};

function current(options: StaffOption[]) {
  return options.find((option) => option.assignedHere)?.id ?? "";
}

/**
 * V5 D05a: HQ chooses who looks after the society. The DM covers the whole
 * district, so it is shown, not chosen here. The API checks HQ, each role and
 * the district, and signs out anyone whose access changes.
 */
export function AssignStaffPanel({
  action,
  options,
  record,
}: {
  action: (previous: RecordFormResult, form: FormData) => Promise<RecordFormResult>;
  options: StaffOptions;
  record: SocietyRecord;
}) {
  const close = `/societies/${record.id}`;
  const fields: Field[] = [
    { name: "deputyId", label: "Deputy District Manager (DDM)", options: options.deputies, hint: "Can view and edit this society." },
    { name: "coordinatorId", label: "Society Program Coordinator (SPC)", options: options.coordinators, hint: "Can view and edit this society." },
    { name: "officerId", label: "Society Officer", options: options.officers, hint: "One officer per society. Can view and edit only this society." },
  ];
  const before = Object.fromEntries(fields.map((field) => [field.name, current(field.options)]));
  const [values, setValues] = useState<Record<string, string>>(before);
  const [state, submit, pending] = useActionState(action, {});
  const nameOf = (field: Field, id: string) => field.options.find((option) => option.id === id)?.displayName;
  const district = record.district.nameEn;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link aria-label="Close" className="absolute inset-0 bg-[#1b261f]/45" href={close} />
      <aside
        aria-labelledby="assign-staff-heading"
        aria-modal="true"
        className="relative h-full w-full max-w-[560px] overflow-y-auto bg-surface px-6 py-5 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-ink" id="assign-staff-heading">Assign responsible staff</h2>
            <p className="text-[12px] text-ink-soft">
              {record.nameEn} · {record.societyCode} · {district}
            </p>
          </div>
          <Link aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink hover:bg-brand-mint-soft" href={close}>
            <Icon className="size-4" name="close" strokeWidth={2} />
          </Link>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submitWithoutReset(submit)}>
          <div className="text-[12px] font-semibold text-ink">
            District Manager (DM)
            <p className="mt-1 rounded-input border border-line bg-surface-muted px-3 py-2.5 text-[12.5px] font-normal">
              {options.districtManagers.length
                ? options.districtManagers.map((dm) => `${dm.displayName} · ${district}`).join(", ")
                : `No DM has ${district} yet`}
            </p>
            <span className="mt-1 block text-[11px] font-normal text-ink-soft">Views all {district} societies. View only.</span>
          </div>
          {fields.map((field) => {
            const changed = values[field.name] !== before[field.name];
            return (
              <label className="block text-[12px] font-semibold text-ink" key={field.name}>
                {field.label} <span className="text-danger-text">*</span>
                <select
                  className={`${selectClass} ${changed ? "border-[#e5c96b] bg-[#fffbea]" : ""}`}
                  name={field.name}
                  onChange={(event) => setValues((all) => ({ ...all, [field.name]: event.target.value }))}
                  required
                  value={values[field.name]}
                >
                  <option value="">Choose a person</option>
                  {field.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.displayName}
                      {field.name === "officerId" ? ` · ${option.username}` : ""}
                      {field.name === "officerId" && !option.assignedHere && option.otherSocieties ? " (moves from another society)" : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] font-normal text-ink-soft">
                  {changed && before[field.name] ? `Changing from ${nameOf(field, before[field.name]!)}. ` : ""}
                  {field.hint}
                </span>
              </label>
            );
          })}

          <p className="flex gap-2.5 rounded-xl border border-[var(--banner-temporary-line)] bg-[var(--banner-temporary-bg)] px-3.5 py-2.5 text-[12px] text-[var(--banner-temporary-text)]">
            <Icon className="mt-0.5 size-4 shrink-0" name="user" strokeWidth={2} />
            <span>
              <strong className="block">Person not in the list?</strong>
              Create an account first, then come back.{" "}
              <Link className="font-semibold underline underline-offset-2" href="/accounts">
                Create an account
              </Link>
            </span>
          </p>
          <p className="flex gap-2.5 rounded-xl border border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] px-3.5 py-2.5 text-[12px] text-[var(--banner-edit-text)]">
            <Icon className="mt-0.5 size-4 shrink-0" name="clock" strokeWidth={2} />
            The change is recorded in the society history with your name and the time. Anyone whose access changes is signed out.
          </p>

          {state.error && (
            <p className="rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
              {state.error}
            </p>
          )}

          <div className="flex gap-2.5">
            <Link className="inline-flex h-[38px] items-center rounded-button border border-button-line px-4 text-[13px] font-semibold text-ink hover:bg-brand-mint-soft" href={close}>
              Cancel
            </Link>
            <button
              className="inline-flex h-[38px] items-center rounded-button bg-brand-action px-4 text-[13px] font-semibold text-white hover:bg-brand-action-pressed disabled:cursor-not-allowed disabled:bg-[#dfe3dd] disabled:text-[#9aa39d]"
              disabled={pending || fields.some((field) => !values[field.name])}
              type="submit"
            >
              {pending ? "Saving…" : "Save assignments"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
