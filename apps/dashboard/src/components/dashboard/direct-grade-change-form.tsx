"use client";

import { useState } from "react";

export function DirectGradeChangeForm({ societyId, grade }: { societyId: string; grade: "A" | "B" | "C" }) {
  const [open, setOpen] = useState(false);
  const [nextGrade, setNextGrade] = useState(grade);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!reason.trim() || saving || nextGrade === grade) return;
    setSaving(true); setStatus("");
    try {
      const response = await fetch(`/api/societies/${societyId}/grade`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grade: nextGrade, reason: reason.trim() }) });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Grade could not be changed");
      setStatus("Grade change saved to the society history.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Grade could not be changed");
    } finally { setSaving(false); }
  }
  return <div className="max-w-sm">
    {!open ? <button className="rounded-button border border-line px-3 py-2 text-xs font-semibold" onClick={() => setOpen(true)} type="button">Change grade</button> : <div className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[auto_1fr_1fr_auto]"><label className="text-xs">New grade<select className="mt-1 block rounded border border-line p-2" onChange={(event) => setNextGrade(event.target.value as "A" | "B" | "C")} value={nextGrade}><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></label><label className="text-xs sm:col-span-2">Reason<textarea className="mt-1 block min-w-48 rounded border border-line p-2" maxLength={2000} onChange={(event) => setReason(event.target.value)} value={reason}/></label><div className="flex items-end gap-2"><button className="rounded bg-brand-forest px-3 py-2 text-xs text-white disabled:opacity-50" disabled={!reason.trim() || nextGrade === grade || saving} onClick={() => void save()} type="button">{saving ? "Saving…" : "Save"}</button><button className="rounded border px-3 py-2 text-xs" onClick={() => setOpen(false)} type="button">Cancel</button></div></div>}
    {status && <p className="mt-2 text-xs" role="status">{status}</p>}
  </div>;
}
