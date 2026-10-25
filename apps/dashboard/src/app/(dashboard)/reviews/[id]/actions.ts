"use server";

import { revalidatePath } from "next/cache";

import { getCurrentViewer } from "@/lib/current-viewer";
import { ACTION_PATH, type ReviewActionResult, validateReviewAction } from "@/lib/review-actions";
import { reviewerApiUser, submissionApiUrl } from "@/lib/submissions-api";

function apiMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  return fallback;
}

export async function reviewAction(raw: unknown): Promise<ReviewActionResult> {
  const input = validateReviewAction(raw);
  if (typeof input === "string") return { ok: false, message: input };

  const user = reviewerApiUser(await getCurrentViewer());
  if (!user) return { ok: false, message: "Your role cannot review submissions." };

  const payload: Record<string, unknown> = { version: input.version };
  if (input.comment) payload.comment = input.comment;
  if (input.action === "REQUEST_CHANGES") payload.fields = input.fields;

  try {
    const response = await fetch(submissionApiUrl(`/submissions/${input.id}/${ACTION_PATH[input.action]}`), {
      method: "POST",
      headers: { "X-Demo-User": user, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return {
        ok: false,
        conflict: response.status === 409,
        message: apiMessage(body, `The API returned ${response.status}.`),
      };
    }
  } catch {
    return { ok: false, message: "The API is unavailable. Nothing was changed." };
  }

  revalidatePath("/reviews");
  revalidatePath(`/reviews/${input.id}`);
  return { ok: true };
}
