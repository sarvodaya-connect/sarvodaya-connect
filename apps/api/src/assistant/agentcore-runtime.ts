import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

import {
  agentCoreFrame,
  AgentCoreChannel,
  AGENTCORE_MAX_FRAME_BYTES,
} from './agentcore-channel.js';
import {
  type AssistantModelTurn,
  runAssistantWorkflow,
} from './assistant-workflow.js';

/** AgentCore authenticates the AWS WebSocket handshake before forwarding to this container. */
export function createAgentCoreRuntime() {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/ping') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{"status":"Healthy"}');
      return;
    }
    response.writeHead(404).end();
  });
  const sockets = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: AGENTCORE_MAX_FRAME_BYTES,
    perMessageDeflate: false,
  });
  sockets.on('connection', (socket) => {
    const signal = AbortSignal.timeout(22_000);
    const channel = new AgentCoreChannel(socket, signal);
    void runRuntimeSession(channel, signal).catch(() => {
      socket.close(1011, 'SarvoAI workflow failed');
    });
  });
  return server;
}

export async function runRuntimeSession(
  channel: AgentCoreChannel,
  signal: AbortSignal,
) {
  const { type, tools } = agentCoreFrame(await channel.read());
  if (
    type !== 'start' ||
    !Array.isArray(tools) ||
    tools.length > 50 ||
    tools.some((name) => typeof name !== 'string' || name.length > 64)
  ) {
    throw new Error('Invalid SarvoAI AgentCore start frame');
  }
  await runAssistantWorkflow({
    messages: [],
    signal,
    approvedToolNames: new Set<string>(tools),
    callModel: async () => {
      await channel.send({ type: 'model' });
      const frame = agentCoreFrame(await channel.read());
      const turn = agentCoreFrame(frame.turn);
      if (frame.type !== 'model-result' || !Array.isArray(turn.content)) {
        throw new Error('Invalid SarvoAI AgentCore model result');
      }
      return turn as unknown as AssistantModelTurn;
    },
    runTools: async (calls) => {
      await channel.send({ type: 'tools' });
      const frame = agentCoreFrame(await channel.read());
      if (frame.type !== 'tools-result')
        throw new Error('Invalid SarvoAI AgentCore tools result');
      return calls.map(() => ({ content: '' }));
    },
    onToolsUsed: () => {},
  });
  await channel.send({ type: 'done' });
}
