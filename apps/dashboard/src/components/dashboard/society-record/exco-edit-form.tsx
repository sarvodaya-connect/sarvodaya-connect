"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { CommitteeMember } from "@sarvodaya-connect/api-contracts";

import type { RecordFormResult } from "@/app/(dashboard)/societies/[id]/record-actions";
import { submitWithoutReset } from "@/lib/use-form-submit";

import { primaryButtonClass, secondaryButtonClass } from "../data-states";
import { Icon } from "../icon";
import { ExcoEditor, excoFromCommittee, excoProblems } from "./exco-editor";

/** Edit Exco and Change office bearers (V5 D05x actions) for one society. */
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
  const [rows, setRows] = useState(() => excoFromCommittee(members));
  const [state, submit, pending] = useActionState(action, {});
  const problems = excoProblems(rows);
  const back = `/societies/${societyId}/exco`;
  return (
    <form className="mt-4 flex flex-col gap-4" onSubmit={submitWithoutReset(submit)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-bold text-ink">{focusOffices ? "Change office bearers" : "Edit Exco"}</h3>
          <p className="text-[12px] text-ink-soft">Saving replaces the 25 seats. A changed member keeps their NIC only if the seat and name stay the same.</p>
        </div>
        <div className="flex gap-2.5">
          <Link className={secondaryButtonClass} href={back}>Cancel</Link>
          <button className={primaryButtonClass} disabled={pending || problems.length > 0} type="submit">
            {pending ? "Saving…" : "Save Exco"}
          </button>
        </div>
      </div>
      {(problems.length > 0 || state.error) && (
        <div className="flex gap-2.5 rounded-xl border border-[var(--banner-incident-line)] bg-[var(--banner-incident-bg)] px-4 py-3 text-[12.5px] text-[var(--banner-incident-text)]" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" name="error" strokeWidth={2} />
          <div>
            <strong className="block">The Exco can&apos;t be saved yet</strong>
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
