"use server";

import { revalidatePath } from "next/cache";

import { getT } from "@/i18n/server";

import { getCurrentViewer } from "@/lib/current-viewer";
import { platformApi } from "@/lib/platform-api";

export type RequestFormState = { status: "idle" | "sent" | "error"; message?: string };

/** V5 D13 "Send request". The API checks HQ access, the group and the deadline. */
export async function sendInformationRequest(_previous: RequestFormState, formData: FormData): Promise<RequestFormState> {
  await getCurrentViewer();
  const [audience, districtId] = String(formData.get("sendTo") ?? "ALL_ACTIVE").split(":");
  try {
    const created = await platformApi("/information-requests", {
      method: "POST",
      body: JSON.stringify({
        audience,
        ...(districtId ? { districtId } : {}),
        title: String(formData.get("title") ?? ""),
        dueOn: String(formData.get("dueOn") ?? ""),
      }),
    });
    revalidatePath("/requests");
    return { status: "sent", message: (await getT()).plural("rq.sentCount", created.societies) };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : (await getT())("rq.errNotSent") };
  }
}
