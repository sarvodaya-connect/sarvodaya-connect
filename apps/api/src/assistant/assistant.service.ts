import type Anthropic from '@anthropic-ai/sdk';
import { ForbiddenException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { hasRole, type Principal } from '../auth/principal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { financialYear, latestCompletedFinancialYear } from '../societies/financial-year.js';
import { ASSISTANT_MODEL, type AssistantModel, AssistantNotConfiguredError, DisabledAssistantModel, type ModelRequest } from './assistant-model.js';
import { SpendingBlockedError } from './assistant-cost.js';
import { AssistantSpendingService, SpendingLimitReachedException } from './assistant-spending.service.js';
import { ASSISTANT_TOOLS, AssistantTools, type ToolOutcome } from './assistant-tools.js';
import { ASSISTANT_ANSWER_KINDS, type AssistantAnswer, type AssistantAnswerKind, type AssistantTurn } from './assistant.types.js';

/** Tool rounds per question; a normal answer needs one or two. */
const MAX_ROUNDS = 6;
/** Output allowance per model call; also what each call reserves (issue #96). */
export const MAX_OUTPUT_TOKENS = 8000;
/** Longest summary and suggestion the screens show (V5 PR 10 output limits). */
const MAX_SUMMARY = 1200;
const MAX_OPTION = 200;

const systemPrompt = (now: Date) => {
  const latest = financialYear(latestCompletedFinancialYear(now));
  return `You are SarvoAI, the question assistant for Sarvodaya headquarters (HQ) staff in the Sarvodaya Connect platform. You answer questions about Sarvodaya Shramadana societies in Sri Lanka using only the tools provided.

What you can use:
- Society details: name, S number, district, DS division, status.
- The current Exco (council): names, positions and appointment dates.
- For each financial year, a society's total profit and total expenses (LKR). A financial year runs 1 April to 31 March; 2025 means FY 2025/26. The latest completed year is ${latest.label} (${latest.startYear}).
- Which societies have not added their yearly figures.

What you must never do:
- Answer about share capital, savings, loans, assets, cash or bank balances, wealth, or detailed accounts. These are not recorded. Reply with kind UNSUPPORTED and suggest a question about yearly total profit or expenses instead.
- Give NICs, phone numbers, addresses, emails or passwords. Say they are not shown.
- Guess, estimate or fill in a figure. If a figure is missing, say it is unavailable. Missing figures are left out, never counted as zero.
- State any number that did not come from a tool result in this conversation.

How to answer:
- Call tools first. Check district names with list_districts if unsure, and find a society with find_societies before looking up its Exco.
- If the question could mean different things, use kind CLARIFY: ask one short question and put the choices in options. For example: which financial year; which of several societies with the same name; for "over five years", whether it means in each year, in at least one year, or combined.
- If no society matches, use kind NO_MATCH and suggest a broader question in options.
- If so many societies are missing figures that an average would mislead (fewer than half included), use kind INCOMPLETE and say how many are included and missing.
- Otherwise use kind ANSWER.
- summary: one or two plain sentences. State the result first, with the financial year, the district (or "all districts"), "LKR" for money, and how many societies were included and left out. Write money like "LKR 298,400".
- The app shows the table and the details from the tool results itself, so do not repeat long lists in the summary.`;
};

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: [...ASSISTANT_ANSWER_KINDS] },
    summary: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
  },
  required: ['kind', 'summary', 'options'],
  additionalProperties: false,
};

const UNAVAILABLE = 'SarvoAI is not available right now. Your question was kept; try again in a minute.';
const PAUSED = 'SarvoAI is paused until its spending settings have been reviewed. Society records are not affected, and you can still find the figures in Reports.';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tools: AssistantTools,
    @Inject(ASSISTANT_MODEL) private readonly model: AssistantModel,
    private readonly spending: AssistantSpendingService,
  ) {}

  async ask(principal: Principal, question: string, history: AssistantTurn[] = [], now = new Date()): Promise<AssistantAnswer> {
    if (!hasRole(principal, 'HQ_ADMIN')) throw new ForbiddenException('SarvoAI is for HQ only');

    const messages: Anthropic.MessageParam[] = [
      ...history.map((turn): Anthropic.MessageParam => ({ role: turn.role, content: turn.text })),
      { role: 'user', content: question },
    ];
    const toolsUsed: string[] = [];
    let lastData: ToolOutcome['answer'];

    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const response = await this.callModel(
          {
            max_tokens: MAX_OUTPUT_TOKENS,
            system: [{ type: 'text', text: systemPrompt(now), cache_control: { type: 'ephemeral' } }],
            tools: ASSISTANT_TOOLS,
            messages,
            // Off so that the reservation's upper bound holds (issue #96): see assertBillableRequest.
            thinking: { type: 'disabled' },
            output_config: { effort: 'medium', format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
          },
          now,
        );

        if (response.stop_reason === 'refusal') {
          return this.finish(principal, question, toolsUsed, now, { kind: 'UNSUPPORTED', summary: 'SarvoAI can’t answer this question.', options: [] });
        }

        if (response.stop_reason === 'tool_use') {
          messages.push({ role: 'assistant', content: response.content });
          const calls = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
          const outcomes = await Promise.all(calls.map((call) => this.tools.run(call.name, call.input, now)));
          calls.forEach((call, index) => {
            toolsUsed.push(call.name);
            if (outcomes[index].answer) lastData = outcomes[index].answer;
          });
          messages.push({
            role: 'user',
            content: calls.map((call, index): Anthropic.ToolResultBlockParam => ({ type: 'tool_result', tool_use_id: call.id, content: outcomes[index].content, is_error: outcomes[index].isError })),
          });
          continue;
        }

        if (response.stop_reason !== 'end_turn') break;
        const parsed = this.parse(response.content);
        if (!parsed) break;
        return this.finish(principal, question, toolsUsed, now, parsed, lastData);
      }
    } catch (error) {
      if (error instanceof AssistantNotConfiguredError) throw new ServiceUnavailableException('SarvoAI is not switched on for this environment');
      if (error instanceof SpendingLimitReachedException) {
        await this.audit(principal, question, toolsUsed, 'SPENDING_LIMIT');
        throw error;
      }
      if (error instanceof SpendingBlockedError) {
        // The reason names settings only. Asking again cannot help, so the caller is told so.
        this.logger.error(JSON.stringify({ event: 'sarvoai_calls_blocked', reason: error.message }));
        await this.audit(principal, question, toolsUsed, 'SPENDING_REVIEW');
        throw new ServiceUnavailableException(PAUSED);
      }
      // The name and status only: a provider's message can repeat part of the prompt.
      const status = (error as { status?: unknown } | null)?.status;
      this.logger.error(`SarvoAI model call failed: ${error instanceof Error ? error.name : 'unknown'} (status ${typeof status === 'number' ? status : 'none'})`);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
    this.logger.warn('SarvoAI did not reach an answer');
    throw new ServiceUnavailableException(UNAVAILABLE);
  }

  /** Every model call is paid for in the ledger first, and reconciled afterwards. */
  private async callModel(request: ModelRequest, now: Date) {
    if (this.model instanceof DisabledAssistantModel) return this.model.createMessage();
    const reservation = await this.spending.reserve(this.model.modelId, request, now);
    let response: Anthropic.Message;
    try {
      response = await this.model.createMessage(request);
    } catch (error) {
      await this.spending.failed(reservation, error);
      throw error;
    }
    await this.spending.settle(reservation, response.usage);
    return response;
  }

  private parse(content: Anthropic.ContentBlock[]): { kind: AssistantAnswerKind; summary: string; options: string[] } | undefined {
    const raw = content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    try {
      const value = JSON.parse(raw) as { kind?: unknown; summary?: unknown; options?: unknown };
      if (!ASSISTANT_ANSWER_KINDS.includes(value.kind as AssistantAnswerKind) || typeof value.summary !== 'string') return undefined;
      const options = Array.isArray(value.options) ? value.options.filter((option): option is string => typeof option === 'string').slice(0, 5) : [];
      // Output limit: one or two sentences are asked for; anything far longer is cut, never shown whole.
      return { kind: value.kind as AssistantAnswerKind, summary: value.summary.trim().slice(0, MAX_SUMMARY), options: options.map((option) => option.slice(0, MAX_OPTION)) };
    } catch {
      return undefined;
    }
  }

  /** Figures, table and details come from the tool results, not from the model's text. */
  private async finish(
    principal: Principal,
    question: string,
    toolsUsed: string[],
    now: Date,
    answer: { kind: AssistantAnswerKind; summary: string; options: string[] },
    data?: ToolOutcome['answer'],
  ): Promise<AssistantAnswer> {
    const showData = answer.kind === 'ANSWER' || answer.kind === 'INCOMPLETE' || answer.kind === 'NO_MATCH';
    await this.audit(principal, question, toolsUsed, answer.kind);
    return {
      ...answer,
      scope: showData ? data?.scope : undefined,
      table: answer.kind === 'ANSWER' ? data?.table : undefined,
      details: showData && data ? data.details : { recordsUsed: [] },
      dataAsOf: now.toISOString(),
    };
  }

  /** Records who asked what and which tools ran; answers and figures are not stored. */
  private async audit(principal: Principal, question: string, toolsUsed: string[], kind: AssistantAnswerKind | 'SPENDING_LIMIT' | 'SPENDING_REVIEW') {
    try {
      await this.prisma.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          actorName: principal.displayName,
          actorRole: 'HQ_ADMIN',
          action: 'SARVOAI_QUESTION',
          targetId: 'sarvoai',
          detail: `${kind}; tools: ${[...new Set(toolsUsed)].join(', ') || 'none'}; question: ${question}`.slice(0, 2000),
        },
      });
    } catch (error) {
      this.logger.error(`Could not record the SarvoAI audit event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
