"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { SocietyGrade, SocietyRecord } from "@sarvodaya-connect/api-contracts";

import type { RecordFormResult } from "@/app/(dashboard)/societies/[id]/record-actions";
import { actorLabel, SOCIETY_GRADE_LABELS } from "@/lib/society-record-format";

const inputClass =
  "mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 text-[12px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";

type Values = {
  nameEn: string;
  societyCode: string;
  memberCount: string;
  landline: string;
  addressLine: string;
  dsDivision: string;
  gnDivision: string;
  businessDescription: string;
  grade: string;
};

function initialValues(record: SocietyRecord): Values {
  return {
    nameEn: record.nameEn,
    societyCode: record.societyCode,
    memberCount: record.memberCount?.toString() ?? "",
    landline: record.landline ?? "",
    addressLine: record.address.addressLine ?? "",
    dsDivision: record.address.dsDivision ?? "",
    gnDivision: record.address.gnDivision ?? "",
    businessDescription: record.businessDescription ?? "",
    grade: record.grade ?? "",
  };
}

/**
 * D05e: HQ can correct any field of any society at any time. A direct grade
 * change needs a reason, and Save stays disabled until one is given.
 */
export function EditSocietyPanel({
  action,
  hqName,
  record,
}: {
  action: (previous: RecordFormResult, form: FormData) => Promise<RecordFormResult>;
  hqName: string;
  record: SocietyRecord;
}) {
  const before = initialValues(record);
  const [values, setValues] = useState(before);
  const [reason, setReason] = useState("");
  const [state, submit, pending] = useActionState(action, {});
  const close = `/societies/${record.id}`;
  const dirty = (Object.keys(before) as (keyof Values)[]).some((key) => values[key].trim() !== before[key]);
  const gradeChanged = values.grade !== before.grade;
  const reasonMissing = gradeChanged && !reason.trim();
  const membersInvalid = values.memberCount.trim() !== "" && !/^\d+$/.test(values.memberCount.trim());
  const required = (["nameEn", "societyCode", "addressLine"] as const).filter((key) => !values[key].trim());
  const request = record.openGradeRequest;
  const set = (key: keyof Values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const field = (key: keyof Values, label: string, options: { required?: boolean; hint?: string; type?: string } = {}) => (
    <label className="block text-[11px] font-semibold text-ink-soft">
      {label} {options.required && <span className="text-danger-text">*</span>}
      <input
        aria-invalid={options.required && !values[key].trim() ? true : undefined}
        className={`${inputClass} ${values[key].trim() !== before[key] ? "border-[#e5c96b] bg-[#fffbea]" : ""}`}
        inputMode={options.type === "number" ? "numeric" : undefined}
        name={key}
        onChange={set(key)}
        value={values[key]}
      />
      <input name={`${key}__before`} type="hidden" value={before[key]} />
      {options.hint && <span className="mt-1 block text-[10px] font-normal text-muted">{options.hint}</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link aria-label="Close edit panel" className="absolute inset-0 bg-[#1b261f]/45" href={close} />
      <aside
        aria-labelledby="edit-society-heading"
        aria-modal="true"
        className="relative h-full w-full max-w-[560px] overflow-y-auto bg-surface px-6 py-5 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-ink" id="edit-society-heading">Edit society information</h2>
            <p className="text-[11px] text-muted">{record.nameEn} · HQ can correct any field at any time</p>
          </div>
          {dirty && (
            <span className="rounded-pill bg-warn-bg px-2.5 py-0.5 text-[10px] font-semibold text-warn-text">● Unsaved changes</span>
          )}
        </div>

        <form action={submit} className="mt-4 space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("nameEn", "Society name", { required: true })}
            {field("societyCode", "S number", { required: true, hint: "Only HQ can correct the S number." })}
            {field("memberCount", "Number of members", { required: true, type: "number" })}
            {field("landline", "Landline", { hint: "10 digits, for example 037 000 0000. Leave empty if none." })}
          </div>
          {membersInvalid && <p className="text-[11px] text-danger-text" role="alert">Use numbers only, for example 418.</p>}
          {field("addressLine", "Address", { required: true })}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("dsDivision", "DS division")}
            {field("gnDivision", "GN division")}
          </div>
          {field("businessDescription", "Business run by the society", { hint: "Information only — no sales, stock or accounts." })}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] font-semibold text-ink-soft">
              Grade <span className="text-danger-text">*</span>
              <select
                className={`${inputClass} ${gradeChanged ? "border-[#e5c96b] bg-[#fffbea]" : ""}`}
                name="grade"
                onChange={set("grade")}
                value={values.grade}
              >
                {!before.grade && <option value="">Not set</option>}
                {(Object.keys(SOCIETY_GRADE_LABELS) as SocietyGrade[]).map((grade) => (
                  <option key={grade} value={grade}>
                    {grade} · {SOCIETY_GRADE_LABELS[grade]}
                  </option>
                ))}
              </select>
              <input name="grade__before" type="hidden" value={before.grade} />
              <span className="mt-1 block text-[10px] font-normal text-muted">
                {gradeChanged && before.grade ? `Was ${before.grade}. ` : ""}Only HQ can change a grade.
              </span>
            </label>
            {gradeChanged && (
              <label className="block text-[11px] font-semibold text-ink-soft">
                Reason for the grade change <span className="text-danger-text">*</span>
                <input
                  aria-invalid={reasonMissing || undefined}
                  className={`${inputClass} ${reasonMissing ? "border-danger-text" : ""}`}
                  maxLength={500}
                  name="gradeReason"
                  onChange={(event) => setReason(event.target.value)}
                  value={reason}
                />
                {reasonMissing && (
                  <span className="mt-1 block text-[10px] font-semibold text-danger-text">Enter a reason. It is shown in the grade history.</span>
                )}
              </label>
            )}
          </div>

          {gradeChanged && request && (
            <p className="rounded-lg border border-[var(--info-ring)] bg-info-bg px-3 py-2 text-[11px] text-info-text">
              There is an open request {request.fromGrade ?? "–"} → {request.toGrade} from {actorLabel(request.requestedBy)}. Changing
              the grade here will close it as {values.grade === request.toGrade ? "approved" : "rejected"}.
            </p>
          )}
          {gradeChanged && (
            <div className="rounded-lg border border-line bg-[#f6f7f4] px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Will be added to the grade history</p>
              <p className="mt-1 text-[11px] font-semibold text-ink">
                {before.grade || "Not set"} → {values.grade} changed directly by {hqName} (HQ)
              </p>
              <p className="text-[10px] text-muted">On save · reason required{request ? ` · request from ${request.requestedBy.displayName} closed` : ""}</p>
            </div>
          )}

          {state.error && (
            <p className="rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[11px] font-semibold text-danger-text" role="alert">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Link className="rounded-button border border-line px-4 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft" href={close}>
              Cancel
            </Link>
            <button
              className="rounded-button bg-brand-action px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-action-pressed disabled:cursor-not-allowed disabled:bg-[#dfe3dd] disabled:text-[#9aa39d]"
              disabled={!dirty || reasonMissing || membersInvalid || required.length > 0 || pending}
              type="submit"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
