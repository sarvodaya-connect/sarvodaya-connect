/** Shared, framework-free rules for reviewer actions (used by the server action and tests). */
export const REVIEW_ACTIONS = ["START_REVIEW", "REQUEST_CHANGES", "APPROVE", "REJECT"] as const;
export type ReviewActionName = (typeof REVIEW_ACTIONS)[number];

export type ReviewActionInput = {
  id: string;
  action: ReviewActionName;
  version: number;
  comment?: string;
  fields?: { field: string; comment: string }[];
};

export type ReviewActionResult =
  | { ok: true }
  | { ok: false; message: string; conflict?: boolean };

export const ACTION_PATH: Record<ReviewActionName, string> = {
  START_REVIEW: "start-review",
  REQUEST_CHANGES: "request-changes",
  APPROVE: "approve",
  REJECT: "reject",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the cleaned input, or a message the reviewer can read. The API checks everything again. */
export function validateReviewAction(raw: unknown): ReviewActionInput | string {
  if (typeof raw !== "object" || raw === null) return "The request was not understood.";
  const input = raw as Record<string, unknown>;
  const id = input.id;
  const action = input.action;
  const version = input.version;
  if (typeof id !== "string" || !UUID.test(id)) return "This submission could not be identified.";
  if (typeof action !== "string" || !(REVIEW_ACTIONS as readonly string[]).includes(action)) {
    return "That action is not available.";
  }
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return "Reload the page and try again.";
  }
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > 1000) return "Comments can be up to 1,000 characters.";

  if (action === "REJECT" && !comment) return "Give a reason for rejecting this submission.";

  if (action === "REQUEST_CHANGES") {
    const fields = input.fields;
    if (!Array.isArray(fields) || fields.length === 0) return "Select at least one field to return.";
    if (fields.length > 50) return "Too many fields were selected.";
    const seen = new Set<string>();
    const cleaned: { field: string; comment: string }[] = [];
    for (const row of fields) {
      const field = typeof row?.field === "string" ? row.field.trim() : "";
      const text = typeof row?.comment === "string" ? row.comment.trim() : "";
      if (!field || field.length > 100) return "A returned field was not recognised.";
      if (!text) return "Add a comment for each returned field.";
      if (text.length > 1000) return "Comments can be up to 1,000 characters.";
      if (seen.has(field)) return "Each field can be returned only once.";
      seen.add(field);
      cleaned.push({ field, comment: text });
    }
    return { id, action, version, ...(comment ? { comment } : {}), fields: cleaned };
  }

  return { id, action: action as ReviewActionName, version, ...(comment ? { comment } : {}) };
}
