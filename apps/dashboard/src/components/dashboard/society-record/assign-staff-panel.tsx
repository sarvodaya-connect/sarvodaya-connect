"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import type { SocietyRecord, StaffOption, StaffOptions } from "@sarvodaya-connect/api-contracts";

import type { RecordFormResult } from "@/app/(dashboard)/societies/[id]/record-actions";
import { useI18n } from "@/i18n/provider";
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

/**
 * The staff choices could not be loaded. Shown in place of the form, so nothing
 * can be submitted and no one mistakes this for a district without staff.
 */
export function AssignStaffUnavailable({ record }: { record: SocietyRecord }) {
  const { t } = useI18n();
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const close = `/societies/${record.id}`;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link aria-label={t("sr.close")} className="absolute inset-0 bg-[#1b261f]/45" href={close} />
      <aside
        aria-labelledby="assign-staff-heading"
        aria-modal="true"
        className="relative h-full w-full max-w-[560px] overflow-y-auto bg-surface px-6 py-5 shadow-2xl"
        role="dialog"
      >
        <h2 className="text-[18px] font-bold text-ink" id="assign-staff-heading">{t("sr.as.title")}</h2>
        <p className="text-[12px] text-ink-soft">{record.nameEn} · {record.societyCode}</p>
        <div className="mt-5 rounded-card border border-[#ead9a7] bg-warn-bg px-4 py-3" role="alert">
          <p className="text-[13px] font-semibold text-warn-text">{t("sr.as.unavailableTitle")}</p>
          <p className="mt-1 text-[12px] text-warn-text">{t("sr.as.unavailableBody")}</p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="rounded-button bg-brand-action px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-action-pressed disabled:opacity-60"
            disabled={retrying}
            onClick={() => startRetry(() => router.refresh())}
            type="button"
          >
            {retrying ? t("sr.as.retrying") : t("n.tryAgain")}
          </button>
          <Link className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft" href={close}>
            {t("sr.close")}
          </Link>
        </div>
      </aside>
    </div>
  );
}

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
  const { t } = useI18n();
  const close = `/societies/${record.id}`;
  const fields: Field[] = [
    { name: "deputyId", label: t("sr.as.deputy"), options: options.deputies, hint: t("sr.as.viewEdit") },
    { name: "coordinatorId", label: t("sr.as.coordinator"), options: options.coordinators, hint: t("sr.as.viewEdit") },
    { name: "officerId", label: t("sr.role.societyOfficer"), options: options.officers, hint: t("sr.as.officerHint") },
  ];
  const before = Object.fromEntries(fields.map((field) => [field.name, current(field.options)]));
  const [values, setValues] = useState<Record<string, string>>(before);
  const [state, submit, pending] = useActionState(action, {});
  const nameOf = (field: Field, id: string) => field.options.find((option) => option.id === id)?.displayName;
  const district = record.district.nameEn;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link aria-label={t("sr.close")} className="absolute inset-0 bg-[#1b261f]/45" href={close} />
      <aside
        aria-labelledby="assign-staff-heading"
        aria-modal="true"
        className="relative h-full w-full max-w-[560px] overflow-y-auto bg-surface px-6 py-5 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-ink" id="assign-staff-heading">{t("sr.as.title")}</h2>
            <p className="text-[12px] text-ink-soft">
              {record.nameEn} · {record.societyCode} · {district}
            </p>
          </div>
          <Link aria-label={t("sr.close")} className="grid size-8 place-items-center rounded-lg text-ink hover:bg-brand-mint-soft" href={close}>
            <Icon className="size-4" name="close" strokeWidth={2} />
          </Link>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submitWithoutReset(submit)}>
          <div className="text-[12px] font-semibold text-ink">
            {t("sr.as.dm")}
            <p className="mt-1 rounded-input border border-line bg-surface-muted px-3 py-2.5 text-[12.5px] font-normal">
              {options.districtManagers.length
                ? options.districtManagers.map((dm) => `${dm.displayName} · ${district}`).join(", ")
                : t("sr.as.noDm", { district })}
            </p>
            <span className="mt-1 block text-[11px] font-normal text-ink-soft">{t("sr.as.dmViews", { district })}</span>
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
                  <option value="">{t("sr.as.choose")}</option>
                  {field.options.map((option) => {
                    const name = field.name === "officerId" ? `${option.displayName} · ${option.username}` : option.displayName;
                    return (
                      <option key={option.id} value={option.id}>
                        {field.name === "officerId" && !option.assignedHere && option.otherSocieties ? t("sr.as.moves", { name }) : name}
                      </option>
                    );
                  })}
                </select>
                <span className="mt-1 block text-[11px] font-normal text-ink-soft">
                  {changed && before[field.name]
                    ? t("sr.as.changingFrom", { name: nameOf(field, before[field.name]!) ?? "", hint: field.hint })
                    : field.hint}
                </span>
              </label>
            );
          })}

          <p className="flex gap-2.5 rounded-xl border border-[var(--banner-temporary-line)] bg-[var(--banner-temporary-bg)] px-3.5 py-2.5 text-[12px] text-[var(--banner-temporary-text)]">
            <Icon className="mt-0.5 size-4 shrink-0" name="user" strokeWidth={2} />
            <span>
              <strong className="block">{t("sr.as.notListedTitle")}</strong>
              {t("sr.as.notListed")}{" "}
              <Link className="font-semibold underline underline-offset-2" href="/accounts">
                {t("sr.as.createAccount")}
              </Link>
            </span>
          </p>
          <p className="flex gap-2.5 rounded-xl border border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] px-3.5 py-2.5 text-[12px] text-[var(--banner-edit-text)]">
            <Icon className="mt-0.5 size-4 shrink-0" name="clock" strokeWidth={2} />
            {t("sr.as.recorded")}
          </p>

          {state.error && (
            <p className="rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
              {state.error}
            </p>
          )}

          <div className="flex gap-2.5">
            <Link className="inline-flex h-[38px] items-center rounded-button border border-button-line px-4 text-[13px] font-semibold text-ink hover:bg-brand-mint-soft" href={close}>
              {t("sr.cancel")}
            </Link>
            <button
              className="inline-flex h-[38px] items-center rounded-button bg-brand-action px-4 text-[13px] font-semibold text-white hover:bg-brand-action-pressed disabled:cursor-not-allowed disabled:bg-[#dfe3dd] disabled:text-[#9aa39d]"
              disabled={pending || fields.some((field) => !values[field.name])}
              type="submit"
            >
              {pending ? t("sr.saving") : t("sr.as.save")}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
