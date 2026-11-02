"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import type { CreateSocietyResult } from "@/app/(dashboard)/societies/[id]/record-actions";
import { SOCIETY_GRADE_LABELS } from "@/lib/society-record-format";
import { submitWithoutReset } from "@/lib/use-form-submit";

import { primaryButtonClass, secondaryButtonClass } from "../data-states";
import { Icon } from "../icon";
import { ExcoEditor, emptyExco, excoProblems } from "./exco-editor";

const inputClass =
  "mt-1.5 h-10 w-full rounded-input border border-line bg-surface px-3 text-[13px] font-normal text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring aria-[invalid=true]:border-danger-dot";

type Details = {
  nameEn: string;
  societyCode: string;
  nameLocal: string;
  districtId: string;
  dsDivision: string;
  gnDivision: string;
  addressLine: string;
  memberCount: string;
  landline: string;
  grade: string;
  businessDescription: string;
  latitude: string;
  longitude: string;
};

const EMPTY: Details = {
  nameEn: "",
  societyCode: "",
  nameLocal: "",
  districtId: "",
  dsDivision: "",
  gnDivision: "",
  addressLine: "",
  memberCount: "",
  landline: "",
  grade: "C",
  businessDescription: "",
  latitude: "",
  longitude: "",
};

function detailProblems(details: Details) {
  const problems: Partial<Record<keyof Details, string>> = {};
  if (details.nameEn.trim().length < 2) problems.nameEn = "Enter the society name.";
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,19}$/.test(details.societyCode.trim())) problems.societyCode = "Enter the S number, for example S-104233.";
  if (!details.districtId) problems.districtId = "Choose the district.";
  if (details.dsDivision.trim().length < 2) problems.dsDivision = "Enter the DS division.";
  if (details.addressLine.trim().length < 3) problems.addressLine = "Enter the address.";
  if (!/^\d+$/.test(details.memberCount.trim()) || Number(details.memberCount) < 1) problems.memberCount = "Enter the number of members, for example 164.";
  const lat = details.latitude.trim();
  const lng = details.longitude.trim();
  if (lat && !(Number(lat) >= -90 && Number(lat) <= 90)) problems.latitude = "Use a latitude such as 7.6123.";
  if (lng && !(Number(lng) >= -180 && Number(lng) <= 180)) problems.longitude = "Use a longitude such as 80.2354.";
  return problems;
}

/**
 * V5 D05n → D05c → D05a: HQ enters the society, then all 25 Exco members,
 * then assigns staff on the new record. The API checks every rule again.
 */
export function CreateSocietyForm({
  action,
  districts,
}: {
  action: (previous: CreateSocietyResult, form: FormData) => Promise<CreateSocietyResult>;
  districts: { id: string; nameEn: string }[];
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [details, setDetails] = useState<Details>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [rows, setRows] = useState(emptyExco);
  const [state, submit, pending] = useActionState(action, {});
  const problems = detailProblems(details);
  const excoIssues = excoProblems(rows, "create");
  const codeError =
    state.field === "societyCode" && details.societyCode.trim() && state.error?.includes(details.societyCode.trim().toUpperCase())
      ? state.error
      : undefined;
  // A duplicate S number found by the API sends HQ back to step 1 to fix it.
  useEffect(() => {
    if (state.field === "societyCode") setStep(1);
  }, [state]);
  const set = (key: keyof Details) => (event: { target: { value: string } }) => setDetails((all) => ({ ...all, [key]: event.target.value }));

  const field = (key: keyof Details, label: string, options: { required?: boolean; hint?: string; inputMode?: "numeric" | "decimal" | "tel" } = {}) => {
    const problem = (touched && problems[key]) || (key === "societyCode" ? codeError : undefined);
    return (
      <label className="block text-[12.5px] font-semibold text-ink">
        {label} {options.required && <span className="text-danger-text">*</span>}
        <input aria-invalid={problem ? true : undefined} className={inputClass} inputMode={options.inputMode} name={key} onChange={set(key)} value={details[key]} />
        {problem ? (
          <span className="mt-1 block text-[11.5px] text-danger-text" role="alert">{problem}</span>
        ) : (
          options.hint && <span className="mt-1 block text-[11px] font-normal text-ink-soft">{options.hint}</span>
        )}
      </label>
    );
  };

  const steps = (
    <p className="text-[12.5px] text-ink-soft">
      <span className={step === 1 ? "font-bold text-ink" : ""}>Step 1 · Society details{step === 2 ? " ✓" : ""}</span>
      {" → "}
      <span className={step === 2 ? "font-bold text-ink" : ""}>2 · Exco (25 members)</span>
      {" → "}3 · Assign staff
    </p>
  );

  return (
    <form className="flex flex-col gap-4" onSubmit={submitWithoutReset(submit)}>
      {/* Step 1 values travel with the final save. */}
      {step === 2 &&
        (Object.keys(details) as (keyof Details)[]).map((key) => <input key={key} name={key} type="hidden" value={details[key]} />)}
      <nav aria-label="Breadcrumb" className="flex gap-1.5 text-[11.5px] text-ink-soft">
        <Link className="font-medium text-brand-action underline underline-offset-2" href="/societies">Societies</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Create a society record</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-ink">Create a society record</h2>
          {steps}
        </div>
        <div className="flex gap-2.5">
          {step === 1 ? (
            <>
              <Link className={secondaryButtonClass} href="/societies">Cancel</Link>
              <button
                className={primaryButtonClass}
                onClick={() => {
                  setTouched(true);
                  if (Object.keys(problems).length === 0) setStep(2);
                }}
                type="button"
              >
                Next: Exco members
              </button>
            </>
          ) : (
            <>
              <button className={secondaryButtonClass} onClick={() => setStep(1)} type="button">Back</button>
              <button className={primaryButtonClass} disabled={pending || excoIssues.length > 0} type="submit">
                {pending ? "Saving…" : "Save and assign staff"}
              </button>
            </>
          )}
        </div>
      </div>

      {step === 1 ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="rounded-card border border-line bg-surface p-5">
            <h3 className="text-[16px] font-bold text-ink">Society details</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("nameEn", "Society name (English)", { required: true })}
              {field("societyCode", "S number", { required: true })}
              {field("nameLocal", "Name in Sinhala or Tamil")}
              <label className="block text-[12.5px] font-semibold text-ink">
                District <span className="text-danger-text">*</span>
                <select aria-invalid={touched && problems.districtId ? true : undefined} className={inputClass} name="districtId" onChange={set("districtId")} value={details.districtId}>
                  <option value="">Choose a district</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>{district.nameEn}</option>
                  ))}
                </select>
                {touched && problems.districtId && <span className="mt-1 block text-[11.5px] text-danger-text" role="alert">{problems.districtId}</span>}
              </label>
              {field("dsDivision", "DS division", { required: true })}
              {field("gnDivision", "GN division")}
            </div>
            <div className="mt-4">{field("addressLine", "Address", { required: true })}</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {field("memberCount", "Number of members", { required: true, inputMode: "numeric" })}
              {field("landline", "Landline (if any)", { hint: "Leave empty if the society has no landline.", inputMode: "tel" })}
              <label className="block text-[12.5px] font-semibold text-ink">
                Starting grade <span className="text-danger-text">*</span>
                <select className={inputClass} name="grade" onChange={set("grade")} value={details.grade}>
                  {(["A", "B", "C"] as const).map((grade) => (
                    <option key={grade} value={grade}>{grade} · {SOCIETY_GRADE_LABELS[grade]}</option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] font-normal text-ink-soft">Only HQ sets or changes the grade.</span>
              </label>
            </div>
            <div className="mt-4">
              {field("businessDescription", "Business run by the society (optional)", { hint: "Information only — no sales, stock or accounts." })}
            </div>
          </section>
          <section className="rounded-card border border-line bg-surface p-5">
            <h3 className="text-[16px] font-bold text-ink">Map location</h3>
            <div aria-hidden="true" className="mt-3 grid h-40 place-items-center rounded-lg bg-[#dce8d6] text-brand-forest">
              <Icon className="size-8" name="map" strokeWidth={2} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {field("latitude", "Latitude", { inputMode: "decimal" })}
              {field("longitude", "Longitude", { inputMode: "decimal" })}
            </div>
            <p className="mt-2 text-[11.5px] text-ink-soft">Type the coordinates. They can be corrected later by HQ or the society&apos;s staff.</p>
          </section>
        </div>
      ) : (
        <>
          {(excoIssues.length > 0 || state.error) && (
            <div className="flex gap-2.5 rounded-xl border border-[var(--banner-incident-line)] bg-[var(--banner-incident-bg)] px-4 py-3 text-[12.5px] text-[var(--banner-incident-text)]" role="alert">
              <Icon className="mt-0.5 size-4 shrink-0" name="error" strokeWidth={2} />
              <div>
                <strong className="block">The society record can&apos;t be saved yet</strong>
                <ul className="mt-0.5">
                  {(state.error ? [state.error] : excoIssues.slice(0, 4)).map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <ExcoEditor mode="create" rows={rows} setRows={setRows} />
        </>
      )}
    </form>
  );
}
