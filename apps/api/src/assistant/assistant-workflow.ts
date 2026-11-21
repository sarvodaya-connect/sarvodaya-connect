import type Anthropic from '@anthropic-ai/sdk';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import { scrubAssistantText } from './assistant-privacy.js';
import type { ToolOutcome } from './assistant-tools.js';

export const MAX_ASSISTANT_ROUNDS = 6;
const MAX_TOOLS_PER_ROUND = 4;

const WorkflowState = Annotation.Root({
  round: Annotation<number>,
  runTools: Annotation<boolean>,
});

export interface AssistantWorkflowInput {
  messages: Anthropic.MessageParam[];
  signal: AbortSignal;
  approvedToolNames: ReadonlySet<string>;
  callModel: (
    messages: Anthropic.MessageParam[],
  ) => Promise<AssistantModelTurn>;
  runTools: (calls: Anthropic.ToolUseBlock[]) => Promise<ToolOutcome[]>;
  onToolsUsed: (names: string[]) => void;
}

export type AssistantModelTurn = Pick<
  Anthropic.Message,
  'content' | 'stop_reason'
>;

export function assistantToolCalls(
  response: AssistantModelTurn,
  approvedToolNames: ReadonlySet<string>,
) {
  if (response.stop_reason !== 'tool_use') return [];
  const calls = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  return calls.length <= MAX_TOOLS_PER_ROUND &&
    calls.every((call) => approvedToolNames.has(call.name)) &&
    new Set(calls.map((call) => call.id)).size === calls.length
    ? calls
    : [];
}

export function appendAssistantToolResults(
  messages: Anthropic.MessageParam[],
  response: AssistantModelTurn,
  calls: Anthropic.ToolUseBlock[],
  outcomes: ToolOutcome[],
): Anthropic.MessageParam[] {
  const results = calls.map((call, index): Anthropic.ToolResultBlockParam => ({
    type: 'tool_result',
    tool_use_id: call.id,
    content: scrubAssistantText(outcomes[index].content),
    is_error: outcomes[index].isError,
  }));
  return [
    ...messages,
    { role: 'assistant', content: response.content },
    { role: 'user', content: results },
  ];
}

/** The graph carries routing data only. Prompts, tool results and provider errors stay request-local. */
export async function runAssistantWorkflow({
  messages,
  signal,
  approvedToolNames,
  callModel,
  runTools,
  onToolsUsed,
}: AssistantWorkflowInput) {
  let response: AssistantModelTurn | undefined;
  let calls: Anthropic.ToolUseBlock[] = [];
  const answers: NonNullable<ToolOutcome['answer']>[] = [];
  let failure: { error: unknown } | undefined;

  const graph = new StateGraph(WorkflowState)
    .addNode('callModel', async ({ round }) => {
      try {
        response = await callModel(messages);
      } catch (error) {
        // Keep provider errors out of graph tracing. The API still handles the original error.
        failure = { error };
        return { runTools: false };
      }

      calls = assistantToolCalls(response, approvedToolNames);
      return { round: round + 1, runTools: calls.length > 0 };
    })
    .addNode('retrieveInformation', async () => {
      try {
        signal.throwIfAborted();
        if (!response) throw new Error('Missing SarvoAI model turn');
        const outcomes = await runTools(calls);
        onToolsUsed(calls.map((call) => call.name));
        for (const { answer } of outcomes) {
          if (answer) answers.push(answer);
        }
        messages = appendAssistantToolResults(
          messages,
          response,
          calls,
          outcomes,
        );
      } catch (error) {
        failure = { error };
        return { runTools: false };
      }
      return {};
    })
    .addEdge(START, 'callModel')
    .addConditionalEdges('callModel', ({ runTools }) =>
      runTools ? 'retrieveInformation' : END,
    )
    .addConditionalEdges('retrieveInformation', ({ round, runTools }) =>
      runTools && round < MAX_ASSISTANT_ROUNDS ? 'callModel' : END,
    )
    .compile();

  await graph.invoke(
    { round: 0, runTools: false },
    { recursionLimit: 2 * MAX_ASSISTANT_ROUNDS + 1 },
  );
  if (failure) throw failure.error;
  return { response, answers };
}
