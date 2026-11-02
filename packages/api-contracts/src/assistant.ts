import type { IsoDateTime } from "./common.js";

/**
 * SarvoAI: the HQ-only question assistant. Answers come only from records HQ can
 * already open, and the only yearly money figures are total profit and total expenses.
 */
export const ASSISTANT_ANSWER_KINDS = [
  "ANSWER",
  "CLARIFY",
  "NO_MATCH",
  "INCOMPLETE",
  "UNSUPPORTED",
] as const;
export type AssistantAnswerKind = (typeof ASSISTANT_ANSWER_KINDS)[number];

/** Earlier turns of the same conversation, sent back by the client for follow-ups. */
export interface AssistantTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AskAssistantRequest {
  question: string;
  history?: AssistantTurn[];
}

/** What the answer covers; every count comes from the records, never from the model. */
export interface AssistantScope {
  financialYears: string[];
  district?: string;
  currency?: "LKR";
  societiesIncluded?: number;
  societiesExcluded?: number;
  excludedReason?: string;
}

export interface AssistantTable {
  columns: string[];
  rows: (string | number | null)[][];
  totalRows: number;
}

/** The "How was this answered?" panel. */
export interface AssistantDetails {
  recordsUsed: string[];
  calculation?: string;
}

export interface AssistantAnswer {
  kind: AssistantAnswerKind;
  summary: string;
  /** Choices to offer when kind is CLARIFY, or suggested rewordings otherwise. */
  options: string[];
  scope?: AssistantScope;
  table?: AssistantTable;
  details: AssistantDetails;
  dataAsOf: IsoDateTime;
}
