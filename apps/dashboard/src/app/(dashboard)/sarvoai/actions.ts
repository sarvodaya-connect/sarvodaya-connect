"use server";

import type { AssistantAnswer, AssistantTurn } from "@sarvodaya-connect/api-contracts";

import { getCurrentViewer } from "@/lib/current-viewer";
import { isDemoMode, platformApi, PlatformApiError } from "@/lib/platform-api";
import { demoAnswer } from "@/lib/sarvoai-demo";

export type SarvoAiResult =
  | { ok: true; answer: AssistantAnswer; sample: boolean }
  | { ok: false; status: number; message: string };

/**
 * V5 D40–D49: asks SarvoAI through the API (POST /assistant/questions, PR #74).
 * The API allows HQ only and answers only from records HQ can open; this
 * action adds nothing to the answer.
 */
export async function askSarvoAi(question: string, history: AssistantTurn[] = []): Promise<SarvoAiResult> {
  await getCurrentViewer();
  const text = question.trim();
  if (text.length < 3) return { ok: false, status: 400, message: "Type a question of at least three characters." };
  if (isDemoMode()) return { ok: true, answer: demoAnswer(text, history), sample: true };
  try {
    const answer: AssistantAnswer = await platformApi("/assistant/questions", {
      method: "POST",
      body: JSON.stringify({ question: text, history: history.slice(-10) }),
    });
    return { ok: true, answer, sample: false };
  } catch (error) {
    if (error instanceof PlatformApiError) return { ok: false, status: error.status, message: error.message };
    return { ok: false, status: 0, message: "SarvoAI isn’t available right now." };
  }
}
