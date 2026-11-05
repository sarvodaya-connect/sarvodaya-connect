import { ForbiddenException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { Principal } from '../auth/principal.js';
import { REQUIRED_ROLES } from '../auth/require-roles.decorator.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type Anthropic from '@anthropic-ai/sdk';

import { type AssistantModel, assistantModelFromConfig, BedrockAssistantModel, DisabledAssistantModel, MODEL_TIMEOUT_MS } from './assistant-model.js';
import { assertBillableRequest, SpendingBlockedError } from './assistant-cost.js';
import { type AssistantSpendingService, SpendingLimitReachedException } from './assistant-spending.service.js';
import type { AssistantTools, ToolOutcome } from './assistant-tools.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';

const hq: Principal = { id: 'hq-1', displayName: 'Fictional HQ admin', roles: ['HQ_ADMIN'], districtIds: [], societyIds: [] };
const now = new Date('2026-11-02T04:00:00Z');

/** Only the fields the service reads; the rest of a Message is irrelevant here. */
const message = (stop_reason: Anthropic.StopReason, content: object[]) => ({ stop_reason, content }) as unknown as Anthropic.Message;
const toolUse = (name: string, input: object) => message('tool_use', [{ type: 'tool_use', id: `call-${name}`, name, input }]);
const final = (answer: object) => message('end_turn', [{ type: 'text', text: JSON.stringify(answer) }]);

function setup(responses: Anthropic.Message[], outcome: ToolOutcome = { content: '{}' }) {
  const createMessage = vi.fn();
  for (const response of responses) createMessage.mockResolvedValueOnce(response);
  const model: AssistantModel = { modelId: 'fake', createMessage };
  const run = vi.fn().mockResolvedValue(outcome);
  const auditCreate = vi.fn().mockResolvedValue({});
  const prisma = { platformAuditEvent: { create: auditCreate } } as unknown as PrismaService;
  const reservation = { id: 'reservation-1' };
  const spending = { reserve: vi.fn().mockResolvedValue(reservation), settle: vi.fn().mockResolvedValue(undefined), failed: vi.fn().mockResolvedValue(undefined) };
  const service = new AssistantService(prisma, { run } as unknown as AssistantTools, model, spending as unknown as AssistantSpendingService);
  return { service, createMessage, run, auditCreate, spending, reservation };
}

const averageOutcome: ToolOutcome = {
  content: '{"averagePerSociety":298400}',
  answer: {
    scope: { financialYears: ['FY 2025/26'], district: 'Kurunegala', currency: 'LKR', societiesIncluded: 2, societiesExcluded: 1 },
    table: { columns: ['Society', 'District', 'Total profit FY 2025/26 (LKR)'], rows: [['Fictional A SSS', 'Kurunegala', 400000]], totalRows: 2 },
    details: { recordsUsed: ['Annual summary: total profit for FY 2025/26'], calculation: 'LKR 596,800 combined ÷ 2 societies' },
  },
};

describe('AssistantService', () => {
  it('is HQ-only at the route and in the service', async () => {
    expect(new Reflector().get(REQUIRED_ROLES, AssistantController)).toEqual(['HQ_ADMIN']);
    const { service, createMessage } = setup([]);
    await expect(service.ask({ ...hq, roles: ['DISTRICT_MANAGER'] }, 'Average profit?', [], now)).rejects.toThrow(ForbiddenException);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('runs the tools the model asks for and returns figures from the tool result, not the model', async () => {
    const { service, createMessage, run, auditCreate } = setup(
      [
        toolUse('summarize_yearly_figure', { financialYear: 2025, metric: 'profit', district: 'Kurunegala' }),
        final({ kind: 'ANSWER', summary: 'The average total profit was LKR 298,400 per society.', options: [] }),
      ],
      averageOutcome,
    );

    const answer = await service.ask(hq, 'What was the average profit in Kurunegala in FY 2025/26?', [], now);

    expect(run).toHaveBeenCalledWith('summarize_yearly_figure', { financialYear: 2025, metric: 'profit', district: 'Kurunegala' }, now);
    expect(answer).toMatchObject({ kind: 'ANSWER', scope: averageOutcome.answer!.scope, table: averageOutcome.answer!.table, details: averageOutcome.answer!.details });
    const second = createMessage.mock.calls[1][0];
    expect(second.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'call-summarize_yearly_figure' });
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({ action: 'SARVOAI_QUESTION', actorId: 'hq-1' });
  });

  it('sends earlier turns for follow-ups and shows no data when asking to clarify', async () => {
    const { service, createMessage } = setup([final({ kind: 'CLARIFY', summary: 'Which do you mean?', options: ['In each year', 'In at least one year', 'Combined'] })]);

    const answer = await service.ask(hq, 'Above LKR 100,000 in the last five years?', [{ role: 'user', text: 'Earlier question' }, { role: 'assistant', text: 'Earlier answer' }], now);

    expect(answer.kind).toBe('CLARIFY');
    expect(answer.options).toHaveLength(3);
    expect(answer.table).toBeUndefined();
    expect(createMessage.mock.calls[0][0].messages.map((message: { role: string }) => message.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('answers UNSUPPORTED when the model refuses', async () => {
    const { service } = setup([message('refusal', [])]);
    expect((await service.ask(hq, 'Something it declines', [], now)).kind).toBe('UNSUPPORTED');
  });

  it('returns 503 when the model fails, gives an unreadable answer, or is switched off', async () => {
    const failing = setup([]);
    failing.createMessage.mockRejectedValueOnce(new Error('Bedrock throttled'));
    await expect(failing.service.ask(hq, 'Average profit?', [], now)).rejects.toThrow(ServiceUnavailableException);

    const garbled = setup([message('end_turn', [{ type: 'text', text: 'not json' }])]);
    await expect(garbled.service.ask(hq, 'Average profit?', [], now)).rejects.toThrow(ServiceUnavailableException);

    const prisma = { platformAuditEvent: { create: vi.fn() } } as unknown as PrismaService;
    const reserve = vi.fn();
    const off = new AssistantService(prisma, { run: vi.fn() } as unknown as AssistantTools, new DisabledAssistantModel(), { reserve } as unknown as AssistantSpendingService);
    await expect(off.ask(hq, 'Average profit?', [], now)).rejects.toThrow('not switched on');
    expect(reserve).not.toHaveBeenCalled();
  });

  it('stops after a fixed number of tool rounds', async () => {
    const { service, createMessage } = setup(Array.from({ length: 10 }, () => toolUse('list_districts', {})));
    await expect(service.ask(hq, 'Loop forever', [], now)).rejects.toThrow(ServiceUnavailableException);
    expect(createMessage).toHaveBeenCalledTimes(6);
  });
});

describe('SarvoAI data limits (V5 PR 10)', () => {
  it('exposes only the approved society, financial, upload and follow-up tools', async () => {
    const { ASSISTANT_TOOLS } = await import('./assistant-tools.js');
    expect(ASSISTANT_TOOLS.map((tool) => tool.name).sort()).toEqual([
      'find_compliance_gaps',
      'find_societies',
      'get_exco_member',
      'get_society_overview',
      'list_districts',
      'list_outstanding_work',
      'societies_above_profit',
      'societies_missing_yearly_figures',
      'summarize_yearly_figure',
    ]);
    const schemas = JSON.stringify(ASSISTANT_TOOLS);
    for (const word of ['savings', 'loan', 'nic', 'password', 'bank', 'share capital']) expect(schemas.toLowerCase()).not.toContain(word);
    // The only yearly money figures are total profit and total expenses.
    expect(schemas).toContain('"enum":["profit","expenses"]');
  });

  it('cuts an over-long model answer instead of showing it whole', async () => {
    const { service } = setup([final({ kind: 'ANSWER', summary: 'x'.repeat(5000), options: ['y'.repeat(500)] })]);
    const answer = await service.ask(hq, 'Average profit?', [], now);
    expect(answer.summary).toHaveLength(1200);
    expect(answer.options[0]).toHaveLength(200);
  });

  it('never returns the provider error or the prompt to the caller', async () => {
    const { service, createMessage } = setup([]);
    createMessage.mockRejectedValueOnce(new Error('AccessDeniedException: arn:aws:bedrock:ap-southeast-1:123456789012 system prompt …'));
    const error = await service.ask(hq, 'Average profit?', [], now).catch((caught: unknown) => caught as Error);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.message).toBe('SarvoAI is not available right now. Your question was kept; try again in a minute.');
  });
});

describe('SarvoAI spending limit (issue #96)', () => {
  const usage = { input_tokens: 10, output_tokens: 5 };
  const billed = (answer: object) => ({ ...final(answer), usage }) as unknown as Anthropic.Message;

  it('reserves before each model call and settles after it', async () => {
    const { service, createMessage, spending, reservation } = setup([
      { ...toolUse('list_districts', {}), usage } as unknown as Anthropic.Message,
      billed({ kind: 'ANSWER', summary: 'Done.', options: [] }),
    ]);
    const order: string[] = [];
    spending.reserve.mockImplementation(async () => (order.push('reserve'), reservation));
    spending.settle.mockImplementation(async () => void order.push('settle'));

    await service.ask(hq, 'Average profit?', [], now);

    expect(order).toEqual(['reserve', 'settle', 'reserve', 'settle']);
    expect(spending.reserve).toHaveBeenCalledWith('fake', expect.objectContaining({ max_tokens: 2048 }));
    expect(spending.settle).toHaveBeenCalledWith(reservation, usage);
    expect(spending.reserve.mock.invocationCallOrder[0]).toBeLessThan(createMessage.mock.invocationCallOrder[0]);
  });

  it('refuses before calling the model once the limit is reached, and audits it', async () => {
    const { service, createMessage, spending, auditCreate } = setup([]);
    spending.reserve.mockRejectedValue(new SpendingLimitReachedException(now));

    const error = await service.ask(hq, 'Average profit?', [], now).catch((caught: unknown) => caught as SpendingLimitReachedException);

    expect(error).toBeInstanceOf(SpendingLimitReachedException);
    expect((error as SpendingLimitReachedException).getStatus()).toBe(429);
    expect((error as SpendingLimitReachedException).message).toContain('1 December 2026');
    expect(createMessage).not.toHaveBeenCalled();
    expect(auditCreate.mock.calls[0][0].data.detail).toContain('SPENDING_LIMIT');
  });

  it('stops part-way through a question when a later call would pass the limit', async () => {
    const { service, createMessage, spending, reservation } = setup([{ ...toolUse('list_districts', {}), usage } as unknown as Anthropic.Message]);
    spending.reserve.mockResolvedValueOnce(reservation).mockRejectedValueOnce(new SpendingLimitReachedException(now));
    await expect(service.ask(hq, 'Average profit?', [], now)).rejects.toThrow(SpendingLimitReachedException);
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it('hands a failed call to the ledger and does not retry it', async () => {
    const { service, createMessage, spending, reservation } = setup([]);
    const failure = Object.assign(new Error('Request timed out.'), { status: undefined });
    createMessage.mockRejectedValueOnce(failure);
    await expect(service.ask(hq, 'Average profit?', [], now)).rejects.toThrow(ServiceUnavailableException);
    expect(spending.failed).toHaveBeenCalledWith(reservation, failure);
    expect(spending.settle).not.toHaveBeenCalled();
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it('refuses the call if the ledger cannot reserve', async () => {
    const { service, createMessage, spending } = setup([]);
    spending.reserve.mockRejectedValue(new ServiceUnavailableException('Database temporarily unavailable'));
    await expect(service.ask(hq, 'Average profit?', [], now)).rejects.toThrow(ServiceUnavailableException);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('never reaches the ledger for a role other than HQ', async () => {
    const { service, spending } = setup([]);
    await expect(service.ask({ ...hq, roles: ['DISTRICT_MANAGER'] }, 'Average profit?', [], now)).rejects.toThrow(ForbiddenException);
    expect(spending.reserve).not.toHaveBeenCalled();
  });

  it('keeps the question and the provider message out of the logs', async () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, createMessage } = setup([]);
    createMessage.mockRejectedValueOnce(Object.assign(new Error('ValidationException: echoed Fictional private question'), { status: 400 }));
    await expect(service.ask(hq, 'Fictional private question', [], now)).rejects.toThrow(ServiceUnavailableException);
    const text = JSON.stringify(logged.mock.calls);
    expect(text).toContain('status 400');
    expect(text).not.toContain('Fictional private question');
    logged.mockRestore();
  });

  it('turns thinking off, and every real request passes the billing check', async () => {
    const { service, createMessage } = setup([
      { ...toolUse('list_districts', {}), usage } as unknown as Anthropic.Message,
      billed({ kind: 'ANSWER', summary: 'Done.', options: [] }),
    ]);
    await service.ask(hq, 'Average profit?', [{ role: 'user', text: 'Earlier' }, { role: 'assistant', text: 'Reply' }], now);
    expect(createMessage).toHaveBeenCalledTimes(2);
    for (const [request] of createMessage.mock.calls) {
      expect(request.thinking).toEqual({ type: 'disabled' });
      expect(() => assertBillableRequest(request)).not.toThrow();
    }
  });

  it('says SarvoAI is paused, without calling the model, when no safe limit can be set', async () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, createMessage, spending, auditCreate } = setup([]);
    spending.reserve.mockRejectedValue(new SpendingBlockedError('SARVOAI_PRICING_APPROVAL has expired'));

    const error = (await service.ask(hq, 'Fictional private question', [], now).catch((caught: unknown) => caught)) as Error;

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.message).toContain('paused');
    expect(error.message).not.toContain('SARVOAI_PRICING_APPROVAL');
    expect(createMessage).not.toHaveBeenCalled();
    expect(auditCreate.mock.calls[0][0].data.detail).toContain('SPENDING_REVIEW');
    const text = JSON.stringify(logged.mock.calls);
    expect(text).toContain('SARVOAI_PRICING_APPROVAL has expired');
    expect(text).not.toContain('Fictional private question');
    logged.mockRestore();
  });

  it('turns off the SDK retries, which could bill twice under one reservation', () => {
    const model = new BedrockAssistantModel('global.anthropic.claude-haiku-5-5', 'ap-southeast-1');
    expect(model['client'].maxRetries).toBe(0);
    expect(model['client'].timeout).toBe(MODEL_TIMEOUT_MS);
    expect(MODEL_TIMEOUT_MS).toBeLessThan(29_000);
  });
});

describe('consolidated privacy, tools and spending', () => {
  it('reserves the exact scrubbed payload that reaches the model, once per call', async () => {
    const { service, spending, createMessage, auditCreate } = setup([
      final({ kind: 'ANSWER', summary: 'Contact a@b.co', options: ['Email a@b.co'] }),
    ]);
    const answer = await service.ask(hq, 'Email a@b.co', [{ role: 'user', text: 'password=fixture-secret' }], now);
    const reserved = spending.reserve.mock.calls[0][1];
    expect(createMessage.mock.calls[0][0]).toBe(reserved);
    expect(JSON.stringify(reserved)).toContain('[REDACTED EMAIL]');
    expect(JSON.stringify(reserved)).not.toContain('fixture-secret');
    expect(JSON.stringify(reserved)).not.toContain('a@b.co');
    expect(createMessage.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
    expect(reserved).toMatchObject({ max_tokens: 2048, thinking: { type: 'disabled' } });
    expect(spending.reserve).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(answer)).not.toContain('a@b.co');
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('Email a@b.co');
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('fixture-secret');
  });

  it.each(['limit', 'review'])('does not audit the prompt on a spending %s refusal', async (kind) => {
    const { service, spending, auditCreate, createMessage } = setup([]);
    spending.reserve.mockRejectedValue(kind === 'limit' ? new SpendingLimitReachedException(now) : new SpendingBlockedError('Approval expired'));
    await expect(service.ask(hq, 'Fictional confidential question', [], now)).rejects.toThrow();
    expect(createMessage).not.toHaveBeenCalled();
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('Fictional confidential question');
    expect(auditCreate.mock.calls[0][0].data.detail).toContain(kind === 'limit' ? 'SPENDING_LIMIT' : 'SPENDING_REVIEW');
  });

  it('rejects an oversized scrubbed payload before reserving or calling the model', async () => {
    const { service, spending, createMessage } = setup([]);
    await expect(service.ask(hq, 'x'.repeat(66_000), [], now)).rejects.toThrow('paused');
    expect(spending.reserve).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('keeps source evidence from multiple tools and the latest tool table', async () => {
    const first = { content: '{}', answer: { details: { recordsUsed: ['Profile'], sources: [{ label: 'Profile', href: '/societies/00000000-0000-4000-8000-000000000001' }] } } };
    const last = { content: '{}', answer: { table: { columns: ['Queue'], rows: [['Pending']], totalRows: 1 }, details: { recordsUsed: ['Queues'], sources: [{ label: 'Requests', href: '/requests' }] } } };
    const { service, run } = setup([
      toolUse('get_society_overview', { societyCode: 'TEST-A', financialYear: 2025 }),
      toolUse('list_outstanding_work', { district: '' }),
      final({ kind: 'ANSWER', summary: 'Recorded results.', options: [] }),
    ]);
    run.mockResolvedValueOnce(first).mockResolvedValueOnce(last);
    const answer = await service.ask(hq, 'Fictional overview and work?', [], now);
    expect(answer.table).toEqual(last.answer.table);
    expect(answer.details.recordsUsed).toEqual(['Profile', 'Queues']);
    expect(answer.details.sources).toEqual([...first.answer.details.sources, ...last.answer.details.sources]);
  });

  it('does not execute an unapproved tool or more than four tools per round', async () => {
    for (const content of [
      [{ type: 'tool_use', id: 'bad', name: 'arbitrary_sql', input: {} }],
      Array.from({ length: 5 }, (_, i) => ({ type: 'tool_use', id: `call-${i}`, name: 'list_districts', input: {} })),
    ]) {
      const { service, run } = setup([message('tool_use', content)]);
      await expect(service.ask(hq, 'Fictional question', [], now)).rejects.toThrow();
      expect(run).not.toHaveBeenCalled();
    }
  });

  it('does not call the provider after cancellation during reservation and keeps the attempt counted', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const { service, spending, createMessage, reservation } = setup([]);
    spending.reserve.mockImplementation(async () => { controller.abort(); return reservation; });
    try {
      await expect(service.ask(hq, 'Fictional question', [], now)).rejects.toThrow();
      expect(createMessage).not.toHaveBeenCalled();
      expect(spending.failed).toHaveBeenCalledWith(reservation, expect.any(Error));
    } finally { timeout.mockRestore(); }
  });

  it('forwards the cancellation signal to the SDK without changing the reserved request', async () => {
    const model = new BedrockAssistantModel('global.anthropic.claude-haiku-5-5', 'ap-southeast-1');
    const sent = vi.spyOn(model['client'].messages, 'create').mockResolvedValue(final({ kind: 'ANSWER' }) as never);
    const signal = AbortSignal.timeout(22_000);
    const payload = { max_tokens: 2048, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: 'Fictional' }] } as Parameters<AssistantModel['createMessage']>[0];
    await model.createMessage(payload, signal);
    expect(sent).toHaveBeenCalledWith({ ...payload, model: model.modelId }, { signal });
    expect(model['client'].logLevel).toBe('off');
    sent.mockRestore();
  });
});

describe('assistantModelFromConfig', () => {
  const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  it('stays off unless SARVOAI_ENABLED is "true"', () => {
    expect(assistantModelFromConfig(config({}))).toBeInstanceOf(DisabledAssistantModel);
    expect(assistantModelFromConfig(config({ SARVOAI_ENABLED: 'yes' }))).toBeInstanceOf(DisabledAssistantModel);
  });

  it('defaults to Claude Haiku 5.5 through the global profile from Singapore', () => {
    const model = assistantModelFromConfig(config({ SARVOAI_ENABLED: 'true' }));
    expect(model).toBeInstanceOf(BedrockAssistantModel);
    expect(model.modelId).toBe('global.anthropic.claude-haiku-5-5');
  });
});
