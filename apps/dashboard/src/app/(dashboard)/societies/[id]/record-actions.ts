"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentViewer } from "@/lib/current-viewer";
import { platformApi } from "@/lib/platform-api";

export type RecordFormResult = { error?: string };

const TEXT_FIELDS = ["nameEn", "societyCode", "landline", "addressLine", "dsDivision", "gnDivision", "businessDescription"] as const;

/**
 * D05e: HQ edits the society record. Only changed fields are sent; the API
 * checks HQ access, the S number and the grade-change reason itself.
 */
export async function updateSocietyRecord(
  id: string,
  _previous: RecordFormResult,
  form: FormData,
): Promise<RecordFormResult> {
  await getCurrentViewer();
  const body: Record<string, string | number> = {};
  for (const field of TEXT_FIELDS) {
    const value = form.get(field);
    const before = form.get(`${field}__before`);
    if (typeof value === "string" && value.trim() !== (before ?? "")) body[field] = value.trim();
  }
  const members = form.get("memberCount");
  if (typeof members === "string" && members !== form.get("memberCount__before")) {
    if (!/^\d+$/.test(members.trim())) return { error: "Enter the number of members using numbers only, for example 418." };
    body.memberCount = Number(members.trim());
  }
  const grade = form.get("grade");
  if (typeof grade === "string" && grade && grade !== form.get("grade__before")) {
    const reason = form.get("gradeReason");
    if (typeof reason !== "string" || !reason.trim()) return { error: "Enter a reason for the grade change. It is shown in the grade history." };
    body.grade = grade;
    body.gradeReason = reason.trim();
  }
  if (Object.keys(body).length === 0) return { error: "Nothing has changed." };
  try {
    await platformApi(`/societies/${id}/profile`, { method: "PATCH", body: JSON.stringify(body) });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The society could not be saved. Try again." };
  }
  revalidatePath(`/societies/${id}`, "layout");
  redirect(`/societies/${id}?saved=1`);
}

/** D05x: shows one member's full NIC. The API checks scope and records the reveal. */
export async function revealMemberNic(societyId: string, memberId: string): Promise<{ nic?: string; error?: string }> {
  await getCurrentViewer();
  try {
    const result = await platformApi(`/societies/${societyId}/council/${memberId}/nic/reveal`, { method: "POST" });
    return { nic: result.nic };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The NIC could not be shown." };
  }
}
