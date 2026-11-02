/** Mirrors the SarvoAI types in packages/api-contracts (assistant.ts). */
export const ASSISTANT_ANSWER_KINDS = [
  'ANSWER',
  'CLARIFY',
  'NO_MATCH',
  'INCOMPLETE',
  'UNSUPPORTED',
] as const;
export type AssistantAnswerKind = (typeof ASSISTANT_ANSWER_KINDS)[number];

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantScope {
  financialYears: string[];
  district?: string;
  currency?: 'LKR';
  societiesIncluded?: number;
  societiesExcluded?: number;
  excludedReason?: string;
}

export interface AssistantTable {
  columns: string[];
  rows: (string | number | null)[][];
  totalRows: number;
}

export interface AssistantDetails {
  recordsUsed: string[];
  calculation?: string;
}

export interface AssistantAnswer {
  kind: AssistantAnswerKind;
  summary: string;
  options: string[];
  scope?: AssistantScope;
  table?: AssistantTable;
  details: AssistantDetails;
  dataAsOf: string;
}
