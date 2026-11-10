"use client";

import { useActionState } from "react";

import { primaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { useI18n } from "@/i18n/provider";

import { type RequestFormState, sendInformationRequest } from "./actions";

const fieldClass = "mt-1 w-full rounded-button border border-line bg-surface px-3 py-2 text-[12px]";

/** V5 D13 "New request". */
export function RequestForm({
  activeSocieties,
  districts,
  fyLabel,
  minDate,
}: {
  activeSocieties: number;
  districts: { id: string; nameEn: string }[];
  fyLabel: string;
  minDate: string;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<RequestFormState, FormData>(sendInformationRequest, { status: "idle" });
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="text-[12px] font-semibold text-ink" htmlFor="request-to">{t("rq.sendTo")} <span className="text-[#a8312a]">*</span></label>
        <select className={fieldClass} defaultValue="ALL_ACTIVE" id="request-to" name="sendTo" required>
          <option value="ALL_ACTIVE">{t("rq.allActive", { count: activeSocieties.toLocaleString("en-GB") })}</option>
          <option value="FIGURES_NOT_ADDED">{t("rq.noFigures", { year: fyLabel })}</option>
          <option value="AUDIT_PAST_DUE">{t("rq.noAudit", { year: fyLabel })}</option>
          {districts.map((district) => <option key={district.id} value={`DISTRICT:${district.id}`}>{/district$/i.test(district.nameEn) ? district.nameEn : t("rq.districtName", { name: district.nameEn })}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[12px] font-semibold text-ink" htmlFor="request-title">{t("rq.whatNeed")} <span className="text-[#a8312a]">*</span></label>
        <input className={fieldClass} id="request-title" maxLength={200} minLength={3} name="title" placeholder={t("rq.needPlaceholder")} required />
      </div>
      <div>
        <label className="text-[12px] font-semibold text-ink" htmlFor="request-due">{t("rq.deadline")} <span className="text-[#a8312a]">*</span></label>
        <input className={fieldClass} id="request-due" min={minDate} name="dueOn" required type="date" />
      </div>
      <p className="text-[11px] text-muted">{t("rq.help")}</p>
      {state.status !== "idle" && (
        <p className={`rounded-lg px-3 py-2 text-[12px] ${state.status === "sent" ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text"}`} role={state.status === "sent" ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      <button className={`${primaryButtonClass} w-full justify-center`} disabled={pending} type="submit">
        <Icon className="size-4" name="mail" />
        {pending ? t("rq.sending") : t("rq.send")}
      </button>
    </form>
  );
}
