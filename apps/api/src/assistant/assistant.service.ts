import type Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import type { Principal } from '../auth/principal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AssistantAgentCore } from './assistant-agentcore.js';
import { AssistantNotConfiguredError } from './assistant-model.js';
import { approvedAssistantToolNames, AssistantOperations } from './assistant-operations.js';
import { SpendingBlockedError } from './assistant-cost.js';
import { scrubAssistantText } from './assistant-privacy.js';
import { SpendingLimitReachedException } from './assistant-spending.service.js';
import type { ToolOutcome } from './assistant-tools.js';
import { ASSISTANT_ANSWER_KINDS, type AssistantAnswer, type AssistantAnswerKind, type AssistantTurn } from './assistant.types.js';
import { type AssistantWorkflowInput, runAssistantWorkflow } from './assistant-workflow.js';

/** Longest summary and suggestion the screens show (V5 PR 10 output limits). */
const MAX_SUMMARY = 1200;
const MAX_OPTION = 200;

const UNAVAILABLE = 'SarvoAI is not available right now. Your question was kept; try again in a minute.';
const PAUSED = 'SarvoAI is paused until its spending settings have been reviewed. Society records are not affected, and you can still find the figures in Reports.';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: AssistantOperations,
    private readonly agentCore?: AssistantAgentCore,
  ) {}

  async ask(principal: Principal, question: string, history: AssistantTurn[] = [], now = new Date()): Promise<AssistantAnswer> {
    const signal = AbortSignal.timeout(22_000);
    const operations = this.operations.forQuestion(principal, now, signal);

    const messages: Anthropic.MessageParam[] = [
      ...history.map((turn): Anthropic.MessageParam => ({ role: turn.role, content: scrubAssistantText(turn.text) })),
      { role: 'user', content: scrubAssistantText(question) },
    ];
    const toolsUsed: string[] = [];

    try {
      const workflow: AssistantWorkflowInput = {
        messages,
        signal,
        approvedToolNames: approvedAssistantToolNames,
        ...operations,
        onToolsUsed: (names) => toolsUsed.push(...names),
      };
      const { response, answers } = await (this.agentCore?.run(workflow) ?? runAssistantWorkflow(workflow));

      if (response?.stop_reason === 'refusal') {
        return this.finish(principal, toolsUsed, now, { kind: 'UNSUPPORTED', summary: 'SarvoAI can’t answer this question.', options: [] });
      }

      if (response?.stop_reason === 'end_turn') {
        const parsed = this.parse(response.content);
        if (parsed) {
          const lastData = answers.at(-1);
          const evidence = new Map<string, NonNullable<AssistantAnswer['details']['sources']>[number]>();
          const recordsUsed = new Set<string>();
          for (const { details } of answers) {
            details.recordsUsed.forEach((record) => recordsUsed.add(record));
            details.sources?.forEach((source) => evidence.set(source.href, source));
          }
          const data = lastData && {
            ...lastData,
            // A tool's fixed summary covers only its own result; a multi-result answer keeps the model's synthesis.
            summary: answers.length === 1 ? lastData.summary : undefined,
            details: { ...lastData.details, recordsUsed: [...recordsUsed], sources: [...evidence.values()].slice(0, 50) },
          };
          return this.finish(principal, toolsUsed, now, parsed, data);
        }
      }
    } catch (error) {
      if (error instanceof AssistantNotConfiguredError) throw new ServiceUnavailableException('SarvoAI is not switched on for this environment');
      if (error instanceof SpendingLimitReachedException) {
        await this.audit(principal, toolsUsed, 'SPENDING_LIMIT');
        throw error;
      }
      if (error instanceof SpendingBlockedError) {
        // The reason names settings only. Asking again cannot help, so the caller is told so.
        this.logger.error(JSON.stringify({ event: 'sarvoai_calls_blocked', reason: error.message }));
        await this.audit(principal, toolsUsed, 'SPENDING_REVIEW');
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
      return { kind: value.kind as AssistantAnswerKind, summary: scrubAssistantText(value.summary.trim()).slice(0, MAX_SUMMARY), options: options.map((option) => scrubAssistantText(option).slice(0, MAX_OPTION)) };
    } catch {
      return undefined;
    }
  }

  /** Figures, table and details come from the tool results, not from the model's text. */
  private async finish(
    principal: Principal,
    toolsUsed: string[],
    now: Date,
    answer: { kind: AssistantAnswerKind; summary: string; options: string[] },
    data?: ToolOutcome['answer'],
  ): Promise<AssistantAnswer> {
    const showData = answer.kind === 'ANSWER' || answer.kind === 'INCOMPLETE' || answer.kind === 'NO_MATCH';
    await this.audit(principal, toolsUsed, answer.kind);
    return {
      ...answer,
      summary: answer.kind === 'ANSWER' && data?.summary
        ? scrubAssistantText(data.summary).slice(0, MAX_SUMMARY)
        : answer.summary,
      scope: showData ? data?.scope : undefined,
      table: answer.kind === 'ANSWER' ? data?.table : undefined,
      details: showData && data ? data.details : { recordsUsed: [] },
      dataAsOf: now.toISOString(),
    };
  }

  /** Records actor/kind/tool names only; never stores the user's question. */
  private async audit(principal: Principal, toolsUsed: string[], kind: AssistantAnswerKind | 'SPENDING_LIMIT' | 'SPENDING_REVIEW') {
    try {
      await this.prisma.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          actorName: principal.displayName,
          actorRole: 'HQ_ADMIN',
          action: 'SARVOAI_QUESTION',
          targetId: 'sarvoai',
          detail: `${kind}; tools: ${[...new Set(toolsUsed)].join(', ') || 'none'}`.slice(0, 2000),
        },
      });
    } catch {
      this.logger.error('Could not record the SarvoAI audit event; database details withheld');
    }
  }
}
