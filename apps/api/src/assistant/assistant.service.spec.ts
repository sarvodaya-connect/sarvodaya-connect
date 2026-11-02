import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { Principal } from '../auth/principal.js';
import { REQUIRED_ROLES } from '../auth/require-roles.decorator.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { type AssistantModel, DisabledAssistantModel, type ModelResponse } from './assistant-model.js';
import type { AssistantTools, ToolOutcome } from './assistant-tools.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';

const hq: Principal = { id: 'hq-1', displayName: 'Fictional HQ admin', roles: ['HQ_ADMIN'], districtIds: [], societyIds: [] };
const now = new Date('2026-11-02T04:00:00Z');

const toolUse = (name: string, input: object): ModelResponse => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id: `call-${name}`, name, input }],
});
const final = (answer: object): ModelResponse => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(answer) }] });

function setup(responses: ModelResponse[], outcome: ToolOutcome = { content: '{}' }) {
  const createMessage = vi.fn();
  for (const response of responses) createMessage.mockResolvedValueOnce(response);
  const model: AssistantModel = { modelId: 'fake', createMessage };
  const run = vi.fn().mockResolvedValue(outcome);
  const auditCreate = vi.fn().mockResolvedValue({});
  const prisma = { platformAuditEvent: { create: auditCreate } } as unknown as PrismaService;
  const service = new AssistantService(prisma, { run } as unknown as AssistantTools, model);
  return { service, createMessage, run, auditCreate };
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
    const { service } = setup([{ stop_reason: 'refusal', content: [] }]);
    expect((await service.ask(hq, 'Something it declines', [], now)).kind).toBe('UNSUPPORTED');
  });

  it('returns 503 when the model fails, gives an unreadable answer, or is switched off', async () => {
    const failing = setup([]);
    failing.createMessage.mockRejectedValueOnce(new Error('Bedrock throttled'));
    await expect(failing.service.ask(hq, 'Average profit?', [], now)).rejects.toThrow(ServiceUnavailableException);

    const garbled = setup([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }]);
    await expect(garbled.service.ask(hq, 'Average profit?', [], now)).rejects.toThrow(ServiceUnavailableException);

    const prisma = { platformAuditEvent: { create: vi.fn() } } as unknown as PrismaService;
    const off = new AssistantService(prisma, { run: vi.fn() } as unknown as AssistantTools, new DisabledAssistantModel());
    await expect(off.ask(hq, 'Average profit?', [], now)).rejects.toThrow('not switched on');
  });

  it('stops after a fixed number of tool rounds', async () => {
    const { service, createMessage } = setup(Array.from({ length: 10 }, () => toolUse('list_districts', {})));
    await expect(service.ask(hq, 'Loop forever', [], now)).rejects.toThrow(ServiceUnavailableException);
    expect(createMessage).toHaveBeenCalledTimes(6);
  });
});
