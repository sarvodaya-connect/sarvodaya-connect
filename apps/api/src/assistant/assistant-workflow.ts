import type Anthropic from '@anthropic-ai/sdk';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import { scrubAssistantText } from './assistant-privacy.js';
import type { ToolOutcome } from './assistant-tools.js';

const MAX_ROUNDS = 6;
const MAX_TOOLS_PER_ROUND = 4;

const WorkflowState = Annotation.Root({
  round: Annotation<number>,
  runTools: Annotation<boolean>,
});

interface WorkflowInput {
  messages: Anthropic.MessageParam[];
  signal: AbortSignal;
  approvedToolNames: ReadonlySet<string>;
  callModel: (messages: Anthropic.MessageParam[]) => Promise<Anthropic.Message>;
  runTool: (name: string, input: unknown) => Promise<ToolOutcome>;
  onToolsUsed: (names: string[]) => void;
}

/** The graph carries routing data only. Prompts, tool results and provider errors stay request-local. */
export async function runAssistantWorkflow({
  messages,
  signal,
  approvedToolNames,
  callModel,
  runTool,
  onToolsUsed,
}: WorkflowInput) {
  let response: Anthropic.Message | undefined;
  let modelContent: Anthropic.ContentBlock[] = [];
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

      modelContent = response.content;
      calls = modelContent.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );
      return {
        round: round + 1,
        runTools:
          response.stop_reason === 'tool_use' &&
          calls.length > 0 &&
          calls.length <= MAX_TOOLS_PER_ROUND &&
          calls.every((call) => approvedToolNames.has(call.name)),
      };
    })
    .addNode('retrieveInformation', async () => {
      try {
        signal.throwIfAborted();
        const outcomes = await Promise.all(
          calls.map((call) => runTool(call.name, call.input)),
        );
        onToolsUsed(calls.map((call) => call.name));
        for (const { answer } of outcomes) {
          if (answer) answers.push(answer);
        }
        const results = calls.map(
          (call, index): Anthropic.ToolResultBlockParam => ({
            type: 'tool_result',
            tool_use_id: call.id,
            content: scrubAssistantText(outcomes[index].content),
            is_error: outcomes[index].isError,
          }),
        );
        messages = [
          ...messages,
          { role: 'assistant', content: modelContent },
          { role: 'user', content: results },
        ];
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
      runTools && round < MAX_ROUNDS ? 'callModel' : END,
    )
    .compile();

  await graph.invoke(
    { round: 0, runTools: false },
    { recursionLimit: 2 * MAX_ROUNDS + 1 },
  );
  if (failure) throw failure.error;
  return { response, answers };
}
