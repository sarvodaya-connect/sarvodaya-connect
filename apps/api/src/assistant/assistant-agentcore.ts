import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';

import {
  agentCoreFrame,
  type AgentCoreChannel,
  openAgentCoreChannel,
} from './agentcore-channel.js';
import type { ToolOutcome } from './assistant-tools.js';
import {
  appendAssistantToolResults,
  assistantToolCalls,
  type AssistantModelTurn,
  type AssistantWorkflowInput,
  MAX_ASSISTANT_ROUNDS,
  runAssistantWorkflow,
} from './assistant-workflow.js';

@Injectable()
export class AssistantAgentCore {
  constructor(private readonly config: ConfigService) {}

  async run(workflow: AssistantWorkflowInput) {
    const runtimeArn = this.config
      .get<string>('SARVOAI_AGENTCORE_RUNTIME_ARN')
      ?.trim();
    if (!runtimeArn) return runAssistantWorkflow(workflow);

    const region =
      /^arn:aws:bedrock-agentcore:([a-z0-9-]+):\d{12}:runtime\/[a-zA-Z0-9_-]+$/.exec(
        runtimeArn,
      )?.[1];
    if (!region) throw new Error('Invalid SarvoAI AgentCore runtime ARN');

    const hostname = `bedrock-agentcore.${region}.amazonaws.com`;
    const path = `/runtimes/${encodeURIComponent(runtimeArn)}/ws`;
    const signer = new SignatureV4({
      credentials: defaultProvider(),
      region,
      service: 'bedrock-agentcore',
      sha256: Sha256,
    });
    const signed = await signer.sign(
      new HttpRequest({
        protocol: 'https:',
        method: 'GET',
        hostname,
        path,
        headers: {
          host: hostname,
          'x-amzn-bedrock-agentcore-runtime-session-id': randomUUID(),
        },
      }),
    );
    const channel = await openAgentCoreChannel(
      `wss://${hostname}${path}`,
      signed.headers,
      workflow.signal,
    );
    try {
      return await runAssistantOverAgentCore(channel, workflow);
    } finally {
      channel.close();
    }
  }
}

/** AgentCore routes the graph. The API owns the transcript, evidence, and the paid operations. */
export async function runAssistantOverAgentCore(
  channel: AgentCoreChannel,
  workflow: AssistantWorkflowInput,
) {
  let messages = workflow.messages;
  let response: AssistantModelTurn | undefined;
  const answers: NonNullable<ToolOutcome['answer']>[] = [];
  let rounds = 0;
  let toolsCompleted = false;
  await channel.send({ type: 'start', tools: [...workflow.approvedToolNames] });

  for (;;) {
    const { type } = agentCoreFrame(await channel.read());
    workflow.signal.throwIfAborted();
    const pending = response
      ? assistantToolCalls(response, workflow.approvedToolNames)
      : [];
    if (
      type === 'model' &&
      rounds < MAX_ASSISTANT_ROUNDS &&
      (!response || toolsCompleted)
    ) {
      rounds += 1;
      toolsCompleted = false;
      response = await workflow.callModel(messages);
      // Routing needs only the stop reason and tool identifiers.
      await channel.send({
        type: 'model-result',
        turn: {
          stop_reason: response.stop_reason,
          content: assistantToolCalls(response, workflow.approvedToolNames).map(
            (call) => ({
              type: 'tool_use',
              id: call.id,
              name: call.name,
              input: {},
            }),
          ),
        },
      });
    } else if (
      type === 'tools' &&
      response &&
      pending.length &&
      !toolsCompleted
    ) {
      const outcomes = await workflow.runTools(pending);
      workflow.onToolsUsed(pending.map((call) => call.name));
      for (const { answer } of outcomes) if (answer) answers.push(answer);
      messages = appendAssistantToolResults(
        messages,
        response,
        pending,
        outcomes,
      );
      toolsCompleted = true;
      await channel.send({ type: 'tools-result' });
    } else if (
      type === 'done' &&
      response &&
      (!pending.length || (toolsCompleted && rounds === MAX_ASSISTANT_ROUNDS))
    ) {
      return { response, answers };
    } else {
      throw new Error('Invalid SarvoAI AgentCore operation order');
    }
  }
}
