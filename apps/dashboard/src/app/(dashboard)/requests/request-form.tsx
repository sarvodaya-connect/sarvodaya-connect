"use client";

import { useActionState } from "react";

import { primaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";

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
  const [state, action, pending] = useActionState<RequestFormState, FormData>(sendInformationRequest, { status: "idle" });
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="text-[12px] font-semibold text-ink" htmlFor="request-to">Send to <span className="text-[#a8312a]">*</span></label>
        <select className={fieldClass} defaultValue="ALL_ACTIVE" id="request-to" name="sendTo" required>
          <option value="ALL_ACTIVE">All active societies ({activeSocieties.toLocaleString("en-GB")})</option>
          <option value="FIGURES_NOT_ADDED">Societies without {fyLabel} yearly figures</option>
          <option value="AUDIT_PAST_DUE">Societies without the {fyLabel} audit report</option>
          {districts.map((district) => <option key={district.id} value={`DISTRICT:${district.id}`}>{/district$/i.test(district.nameEn) ? district.nameEn : `${district.nameEn} District`}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[12px] font-semibold text-ink" htmlFor="request-title">What do you need <span className="text-[#a8312a]">*</span></label>
        <input className={fieldClass} id="request-title" maxLength={200} minLength={3} name="title" placeholder="e.g. Signed AGM minutes 2026" required />
      </div>
      <div>
        <label className="text-[12px] font-semibold text-ink" htmlFor="request-due">Deadline <span className="text-[#a8312a]">*</span></label>
        <input className={fieldClass} id="request-due" min={minDate} name="dueOn" required type="date" />
      </div>
      <p className="text-[11px] text-muted">The Society Officer (or the SPC, where there is none) is told in the app and marks the society as responded.</p>
      {state.status !== "idle" && (
        <p className={`rounded-lg px-3 py-2 text-[12px] ${state.status === "sent" ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text"}`} role={state.status === "sent" ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      <button className={`${primaryButtonClass} w-full justify-center`} disabled={pending} type="submit">
        <Icon className="size-4" name="mail" />
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
