"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { SocietyGrade, SocietyRecord } from "@sarvodaya-connect/api-contracts";

import type { RecordFormResult } from "@/app/(dashboard)/societies/[id]/record-actions";
import { formatNumber } from "@/i18n/translate";
import { useI18n } from "@/i18n/provider";
import { actorName, gradeOption } from "@/i18n/society-record";
import { parseCount } from "@/lib/count";
import { mapboxToken, typedPosition } from "@/lib/mapbox";
import { SOCIETY_GRADE_LABELS } from "@/lib/society-record-format";

import { SocietyLocationMap } from "../maps/society-location-map";

const inputClass =
  "mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 text-[12px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";

/** Issue #141: the most members for each of female and male, and in all. */
export const MAX_MEMBERS = 1_000_000;

type Values = {
  nameEn: string;
  societyCode: string;
  femaleMembers: string;
  maleMembers: string;
  landline: string;
  addressLine: string;
  dsDivision: string;
  gnDivision: string;
  businessDescription: string;
  grade: string;
  latitude: string;
  longitude: string;
};

function initialValues(record: SocietyRecord): Values {
  return {
    nameEn: record.nameEn,
    societyCode: record.societyCode,
    femaleMembers: record.femaleMembers?.toString() ?? "",
    maleMembers: record.maleMembers?.toString() ?? "",
    landline: record.landline ?? "",
    addressLine: record.address.addressLine ?? "",
    dsDivision: record.address.dsDivision ?? "",
    gnDivision: record.address.gnDivision ?? "",
    businessDescription: record.businessDescription ?? "",
    grade: record.grade ?? "",
    latitude: record.location?.latitude.toString() ?? "",
    longitude: record.location?.longitude.toString() ?? "",
  };
}

/**
 * Issue #141: what the female and male boxes add up to, and what is wrong
 * with them. Both empty on a record that never had a split keeps its old
 * total; otherwise both are needed, as whole numbers from 0 to 1,000,000.
 */
function memberSplit(values: Values, before: Values, recordedTotal: number | null) {
  const femaleText = values.femaleMembers.trim();
  const maleText = values.maleMembers.trim();
  const female = parseCount(femaleText, MAX_MEMBERS);
  const male = parseCount(maleText, MAX_MEMBERS);
  const hadSplit = before.femaleMembers !== "";
  let error: "sr.ed.countInvalid" | "sr.ed.splitBoth" | "sr.ed.splitTooMany" | null = null;
  if (!femaleText && !maleText) error = hadSplit ? "sr.ed.splitBoth" : null;
  else if ((femaleText && female === null) || (maleText && male === null)) error = "sr.ed.countInvalid";
  else if (!femaleText || !maleText) error = "sr.ed.splitBoth";
  else if (female! + male! > MAX_MEMBERS) error = "sr.ed.splitTooMany";
  const total = female !== null && male !== null && error === null ? female + male : null;
  return { error, total, keepsOldTotal: !femaleText && !maleText && !hadSplit ? recordedTotal : null };
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
  const { t } = useI18n();
  const before = initialValues(record);
  const [values, setValues] = useState(before);
  const [reason, setReason] = useState("");
  const [state, submit, pending] = useActionState(action, {});
  const close = `/societies/${record.id}`;
  const dirty = (Object.keys(before) as (keyof Values)[]).some((key) => values[key].trim() !== before[key]);
  const gradeChanged = values.grade !== before.grade;
  const reasonMissing = gradeChanged && !reason.trim();
  const split = memberSplit(values, before, record.memberCount);
  const membersInvalid = split.error !== null;
  const required = (["nameEn", "societyCode", "addressLine"] as const).filter((key) => !values[key].trim());
  const request = record.openGradeRequest;
  const token = mapboxToken();
  const position = typedPosition(values.latitude, values.longitude);
  const locationChanged = values.latitude.trim() !== before.latitude || values.longitude.trim() !== before.longitude;
  const locationInvalid = locationChanged && !position;
  const set = (key: keyof Values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const field = (key: keyof Values, label: string, options: { required?: boolean; hint?: string; type?: string; inputMode?: "decimal" } = {}) => (
    <label className="block text-[11px] font-semibold text-ink-soft">
      {label} {options.required && <span className="text-danger-text">*</span>}
      <input
        aria-invalid={options.required && !values[key].trim() ? true : undefined}
        className={`${inputClass} ${values[key].trim() !== before[key] ? "border-[#e5c96b] bg-[#fffbea]" : ""}`}
        inputMode={options.type === "number" ? "numeric" : options.inputMode}
        id={key}
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
      <Link aria-label={t("sr.ed.close")} className="absolute inset-0 bg-[#1b261f]/45" href={close} />
      <aside
        aria-labelledby="edit-society-heading"
        aria-modal="true"
        className="relative h-full w-full max-w-[560px] overflow-y-auto bg-surface px-6 py-5 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-ink" id="edit-society-heading">{t("sr.ed.title")}</h2>
            <p className="text-[11px] text-muted">{t("sr.ed.subtitle", { name: record.nameEn })}</p>
          </div>
          {dirty && (
            <span className="rounded-pill bg-warn-bg px-2.5 py-0.5 text-[10px] font-semibold text-warn-text">{t("sr.ed.unsaved")}</span>
          )}
        </div>

        <form action={submit} className="mt-4 space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("nameEn", t("sr.ov.name"), { required: true })}
            {field("societyCode", t("sr.ov.sNumber"), { required: true, hint: t("sr.ed.sNumberHint") })}
            {field("landline", t("sr.ov.landline"), { hint: t("sr.ed.landlineHint") })}
          </div>
          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold text-ink-soft">{t("sr.ed.members")}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {field("femaleMembers", t("sr.ed.female"), { type: "number" })}
              {field("maleMembers", t("sr.ed.male"), { type: "number" })}
              <div className="text-[11px] font-semibold text-ink-soft">
                <span id="total-members-label">{t("sr.ed.total")}</span>
                <output
                  aria-labelledby="total-members-label"
                  aria-live="polite"
                  className="mt-1 block rounded-input border border-line bg-[#f6f7f4] px-3 py-2 text-[12px] font-bold text-ink"
                  htmlFor="femaleMembers maleMembers"
                >
                  {split.total !== null
                    ? formatNumber(t.locale, split.total)
                    : split.keepsOldTotal !== null
                      ? formatNumber(t.locale, split.keepsOldTotal)
                      : "—"}
                </output>
                <span className="mt-1 block text-[10px] font-normal text-muted">{t("sr.ed.totalHelp")}</span>
              </div>
            </div>
            {split.keepsOldTotal !== null && (
              <p className="text-[11px] text-ink-soft">{t("sr.ed.splitMissing", { count: formatNumber(t.locale, split.keepsOldTotal) })}</p>
            )}
            {split.error && (
              <p className="text-[11px] text-danger-text" role="alert">
                {t(split.error)}
              </p>
            )}
          </fieldset>
          {field("addressLine", t("sr.ov.address"), { required: true })}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("dsDivision", t("sr.ed.ds"))}
            {field("gnDivision", t("sr.ed.gn"))}
          </div>
          {field("businessDescription", t("sr.ov.business"), { hint: t("sr.ed.businessHint") })}

          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold text-ink-soft">{t("sr.ed.mapLocation")}</legend>
            {token && (
              <SocietyLocationMap
                className="h-48"
                name={record.nameEn}
                onPick={(latitude, longitude) => setValues((current) => ({ ...current, latitude: String(latitude), longitude: String(longitude) }))}
                position={position}
                token={token}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {field("latitude", t("sr.latitude"), { inputMode: "decimal" })}
              {field("longitude", t("sr.longitude"), { inputMode: "decimal" })}
            </div>
            {locationInvalid ? (
              <p className="text-[11px] text-danger-text" role="alert">{t("sr.ed.locationInvalid")}</p>
            ) : (
              <p className="text-[10px] text-muted">{token ? t("sr.mapHelpPick") : t("sr.mapHelpType")}</p>
            )}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] font-semibold text-ink-soft">
              {t("sr.ed.grade")} <span className="text-danger-text">*</span>
              <select
                className={`${inputClass} ${gradeChanged ? "border-[#e5c96b] bg-[#fffbea]" : ""}`}
                name="grade"
                onChange={set("grade")}
                value={values.grade}
              >
                {!before.grade && <option value="">{t("sr.notSetTitle")}</option>}
                {(Object.keys(SOCIETY_GRADE_LABELS) as SocietyGrade[]).map((grade) => (
                  <option key={grade} value={grade}>
                    {gradeOption(t, grade)}
                  </option>
                ))}
              </select>
              <input name="grade__before" type="hidden" value={before.grade} />
              <span className="mt-1 block text-[10px] font-normal text-muted">
                {gradeChanged && before.grade ? t("sr.ed.wasGrade", { grade: before.grade }) : t("sr.ed.onlyHqGrade")}
              </span>
            </label>
            {gradeChanged && (
              <label className="block text-[11px] font-semibold text-ink-soft">
                {t("sr.ed.reason")} <span className="text-danger-text">*</span>
                <input
                  aria-invalid={reasonMissing || undefined}
                  className={`${inputClass} ${reasonMissing ? "border-danger-text" : ""}`}
                  maxLength={500}
                  name="gradeReason"
                  onChange={(event) => setReason(event.target.value)}
                  value={reason}
                />
                {reasonMissing && (
                  <span className="mt-1 block text-[10px] font-semibold text-danger-text">{t("sr.ed.reasonMissing")}</span>
                )}
              </label>
            )}
          </div>

          {gradeChanged && request && (
            <p className="rounded-lg border border-[var(--info-ring)] bg-info-bg px-3 py-2 text-[11px] text-info-text">
              {t(values.grade === request.toGrade ? "sr.ed.openRequestApproved" : "sr.ed.openRequestRejected", {
                from: request.fromGrade ?? "–",
                to: request.toGrade,
                actor: actorName(t, request.requestedBy),
              })}
            </p>
          )}
          {gradeChanged && (
            <div className="rounded-lg border border-line bg-[#f6f7f4] px-3 py-2.5">
              <p className="text-[9px] font-bold tracking-[0.14em] text-muted">{t("sr.ed.willBeAdded")}</p>
              <p className="mt-1 text-[11px] font-semibold text-ink">
                {t("sr.ed.changedDirectly", { from: before.grade || t("sr.notSetTitle"), to: values.grade, name: hqName })}
              </p>
              <p className="text-[10px] text-muted">
                {request ? t("sr.ed.onSaveClosed", { name: request.requestedBy.displayName }) : t("sr.ed.onSave")}
              </p>
            </div>
          )}

          {state.error && (
            <p className="rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[11px] font-semibold text-danger-text" role="alert">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Link className="rounded-button border border-line px-4 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft" href={close}>
              {t("sr.cancel")}
            </Link>
            <button
              className="rounded-button bg-brand-action px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-action-pressed disabled:cursor-not-allowed disabled:bg-[#dfe3dd] disabled:text-[#9aa39d]"
              disabled={!dirty || reasonMissing || membersInvalid || locationInvalid || required.length > 0 || pending}
              type="submit"
            >
              {pending ? t("sr.saving") : t("sr.ed.save")}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
