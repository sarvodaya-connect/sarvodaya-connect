import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

import {
  AGENTCORE_MAX_FRAME_BYTES,
  openAgentCoreChannel,
} from './agentcore-channel.js';
import { createAgentCoreRuntime } from './agentcore-runtime.js';
import { runAssistantOverAgentCore } from './assistant-agentcore.js';
import type { AssistantWorkflowInput } from './assistant-workflow.js';

describe('SarvoAI AgentCore WebSocket', () => {
  let server: ReturnType<typeof createServer> | undefined;

  async function channelFor(
    runtime: ReturnType<typeof createServer>,
    signal: AbortSignal,
  ) {
    server = runtime;
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    return openAgentCoreChannel(`ws://127.0.0.1:${port}/ws`, {}, signal);
  }

  afterEach(async () => {
    if (server) {
      const closed = once(server, 'close');
      server.close();
      await closed;
      server = undefined;
    }
  });

  function workflow(): AssistantWorkflowInput {
    return {
      messages: [{ role: 'user', content: 'Overview of TEST-A01' }],
      signal: AbortSignal.timeout(4_000),
      approvedToolNames: new Set(['get_society_overview']),
      callModel: vi.fn<AssistantWorkflowInput['callModel']>(),
      runTools: vi.fn<AssistantWorkflowInput['runTools']>(),
      onToolsUsed: vi.fn(),
    };
  }

  it('routes model and tool rounds while keeping the answer and tool evidence in NestJS', async () => {
    const input = workflow();
    const calls = [
      {
        type: 'tool_use' as const,
        id: 'overview',
        name: 'get_society_overview',
        input: { societyCode: 'TEST-A01' },
      },
    ];
    const answer = { details: { recordsUsed: ['Fictional society record'] } };
    const final = {
      stop_reason: 'end_turn' as const,
      content: [{ type: 'text' as const, text: 'Overview', citations: null }],
    };
    vi.mocked(input.callModel)
      .mockResolvedValueOnce({ stop_reason: 'tool_use', content: calls })
      .mockResolvedValueOnce(final);
    vi.mocked(input.runTools).mockResolvedValue([
      { content: '{"profit":100000}', answer },
    ]);
    const channel = await channelFor(createAgentCoreRuntime(), input.signal);
    try {
      expect(await runAssistantOverAgentCore(channel, input)).toEqual({
        response: final,
        answers: [answer],
      });
      expect(input.callModel).toHaveBeenCalledTimes(2);
      expect(input.runTools).toHaveBeenCalledExactlyOnceWith(calls);
      expect(vi.mocked(input.callModel).mock.calls[1][0].at(-1)).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'overview',
            content: '{"profit":100000}',
            is_error: undefined,
          },
        ],
      });
    } finally {
      channel.close();
    }
  });

  it('rejects an unsolicited tool operation without querying data or calling Bedrock', async () => {
    const input = workflow();
    const runtime = createServer();
    const sockets = new WebSocketServer({
      server: runtime,
      maxPayload: AGENTCORE_MAX_FRAME_BYTES,
    });
    sockets.on('connection', (socket) => {
      socket.once('message', () =>
        socket.send('{"type":"tools","name":"get_society_overview"}'),
      );
    });
    const channel = await channelFor(runtime, input.signal);
    try {
      await expect(runAssistantOverAgentCore(channel, input)).rejects.toThrow(
        'Invalid SarvoAI AgentCore operation order',
      );
      expect(input.callModel).not.toHaveBeenCalled();
      expect(input.runTools).not.toHaveBeenCalled();
    } finally {
      channel.close();
    }
  });

  it('fails a disconnected invocation without starting a fallback model call', async () => {
    const input = workflow();
    const runtime = createServer();
    const sockets = new WebSocketServer({
      server: runtime,
      maxPayload: AGENTCORE_MAX_FRAME_BYTES,
    });
    sockets.on('connection', (socket) => {
      socket.once('message', () => socket.terminate());
    });
    const channel = await channelFor(runtime, input.signal);
    try {
      await expect(runAssistantOverAgentCore(channel, input)).rejects.toThrow(
        'connection closed',
      );
      expect(input.callModel).not.toHaveBeenCalled();
    } finally {
      channel.close();
    }
  });
});
