import { createServer } from 'node:http';

import { runAssistantWorkflow } from '../dist/assistant/assistant-workflow.js';

const bodyLimit = 1024;
const toolName = 'get_society_overview';
const societyCode = 'AGENTCORE-FIXTURE-01';
const missingUploads = ['Audit report', 'AGM minutes', 'Office-bearer list', 'Members list'];

function send(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function runSmokeWorkflow() {
  const messages = [{ role: 'user', content: 'Check the fictional society overview.' }];
  const { response, answers } = await runAssistantWorkflow({
    messages,
    signal: AbortSignal.timeout(5_000),
    approvedToolNames: new Set([toolName]),
    callModel: async (conversation) => {
      if (conversation.length === 1) {
        return {
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 'fixture-overview', name: toolName, input: { societyCode } }],
        };
      }
      const result = conversation.at(-1)?.content?.[0];
      if (result?.type !== 'tool_result' || result.tool_use_id !== 'fixture-overview') {
        throw new Error('Missing fixture tool result');
      }
      const evidence = JSON.parse(result.content);
      return {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: `Missing ${evidence.missingUploads.length} Registrar uploads.` }],
      };
    },
    runTool: async (name, input) => {
      if (name !== toolName || input?.societyCode !== societyCode) {
        throw new Error('Unexpected fixture tool request');
      }
      return {
        content: JSON.stringify({ missingUploads }),
        answer: { details: { recordsUsed: [...missingUploads] } },
      };
    },
    onToolsUsed: () => {},
  });
  if (response?.stop_reason !== 'end_turn' || answers.length !== 1) {
    throw new Error('Fixture did not reach an answer');
  }
  return {
    status: 'success',
    mode: 'fixture',
    summary: response.content[0].text,
    missingUploads: answers[0].details.recordsUsed,
  };
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/ping') {
    return send(response, 200, { status: 'Healthy' });
  }
  if (request.method !== 'POST' || request.url !== '/invocations') {
    return send(response, 404, { error: 'Unknown endpoint' });
  }
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return send(response, 415, { error: 'Expected application/json' });
  }

  let bytes = 0;
  const chunks = [];
  try {
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      bytes += chunk.length;
      if (bytes > bodyLimit) {
        request.resume();
        return send(response, 413, { error: 'Request too large' });
      }
      chunks.push(chunk);
    }
  } catch {
    if (!response.destroyed) send(response, 400, { error: 'Could not read request' });
    return;
  }

  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return send(response, 400, { error: 'Invalid JSON' });
  }
  if (input?.operation !== 'smoke' || Object.keys(input).length !== 1) {
    return send(response, 400, { error: 'Expected only operation: smoke' });
  }

  try {
    return send(response, 200, await runSmokeWorkflow());
  } catch {
    return send(response, 500, { error: 'Workflow smoke test failed' });
  }
});

// This fixture server is for local rehearsal of the AgentCore HTTP contract.
server.listen(8080, '127.0.0.1', () => {
  process.stdout.write('SarvoAI AgentCore fixture is listening on http://127.0.0.1:8080\n');
});
