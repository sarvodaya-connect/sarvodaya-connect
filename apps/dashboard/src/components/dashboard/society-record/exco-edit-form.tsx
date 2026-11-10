"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { CommitteeMember } from "@sarvodaya-connect/api-contracts";

import type { RecordFormResult } from "@/app/(dashboard)/societies/[id]/record-actions";
import { useI18n } from "@/i18n/provider";
import { submitWithoutReset } from "@/lib/use-form-submit";

import { primaryButtonClass, secondaryButtonClass } from "../data-states";
import { Icon } from "../icon";
import { ExcoEditor, excoFromCommittee, excoProblems } from "./exco-editor";

/**
 * Edit Exco and Change office bearers (V5 D05x actions) for one society. The
 * Society Officer (or anyone else who may edit the record) can save part of the
 * Exco and finish it later.
 */
export function ExcoEditForm({
  action,
  focusOffices,
  members,
  societyId,
}: {
  action: (previous: RecordFormResult, form: FormData) => Promise<RecordFormResult>;
  focusOffices: boolean;
  members: CommitteeMember[];
  societyId: string;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState(() => excoFromCommittee(members));
  const [state, submit, pending] = useActionState(action, {});
  const problems = excoProblems(rows, undefined, t);
  const back = `/societies/${societyId}/exco`;
  return (
    <form className="mt-4 flex flex-col gap-4" onSubmit={submitWithoutReset(submit)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-bold text-ink">{focusOffices ? t("sr.ex.changeOffices") : t("sr.ex.editExco")}</h3>
          <p className="text-[12px] text-ink-soft">{t("sr.ee.intro")}</p>
        </div>
        <div className="flex gap-2.5">
          <Link className={secondaryButtonClass} href={back}>{t("sr.cancel")}</Link>
          <button className={primaryButtonClass} disabled={pending || problems.length > 0} type="submit">
            {pending ? t("sr.saving") : t("sr.ee.save")}
          </button>
        </div>
      </div>
      {(problems.length > 0 || state.error) && (
        <div className="flex gap-2.5 rounded-xl border border-[var(--banner-incident-line)] bg-[var(--banner-incident-bg)] px-4 py-3 text-[12.5px] text-[var(--banner-incident-text)]" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" name="error" strokeWidth={2} />
          <div>
            <strong className="block">{t("sr.ee.cantSave")}</strong>
            <ul className="mt-0.5">
              {(state.error ? [state.error] : problems.slice(0, 4)).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <ExcoEditor focusOffices={focusOffices} rows={rows} setRows={setRows} />
    </form>
  );
}
