import { ConfigService } from '@nestjs/config';

import type { ToolDefinition } from './assistant-tools.js';

/**
 * The part of the Claude Messages API that SarvoAI uses. Kept as a small interface so the
 * service can be tested with a fake model, and so the Bedrock SDK is only loaded when
 * SarvoAI is switched on.
 */
export type ModelContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  | { type: string; [key: string]: unknown };

export interface ModelMessage {
  role: 'user' | 'assistant';
  content: string | ModelContentBlock[];
}

export interface ModelRequest {
  model: string;
  max_tokens: number;
  system: { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[];
  tools: ToolDefinition[];
  messages: ModelMessage[];
  output_config: { effort: 'low' | 'medium' | 'high'; format: { type: 'json_schema'; schema: Record<string, unknown> } };
}

export interface ModelResponse {
  content: ModelContentBlock[];
  stop_reason: string | null;
}

export interface AssistantModel {
  readonly modelId: string;
  createMessage(request: Omit<ModelRequest, 'model'>): Promise<ModelResponse>;
}

export const ASSISTANT_MODEL = Symbol('ASSISTANT_MODEL');

export class AssistantNotConfiguredError extends Error {}

/** Used when SARVOAI_ENABLED is not "true": the endpoint answers 503 instead of calling AWS. */
export class DisabledAssistantModel implements AssistantModel {
  readonly modelId = 'disabled';

  createMessage(): Promise<ModelResponse> {
    return Promise.reject(new AssistantNotConfiguredError('SarvoAI is not switched on for this environment'));
  }
}

interface BedrockMantleClient {
  messages: { create(request: ModelRequest): Promise<ModelResponse> };
}

// A variable specifier keeps the SDK optional at build time: install
// @anthropic-ai/bedrock-sdk before setting SARVOAI_ENABLED=true.
const BEDROCK_SDK = '@anthropic-ai/bedrock-sdk';

/** Claude on Amazon Bedrock. AWS credentials come from the default chain (the task's IAM role in AWS). */
export class BedrockAssistantModel implements AssistantModel {
  private client?: Promise<BedrockMantleClient>;

  constructor(
    readonly modelId: string,
    private readonly awsRegion: string,
  ) {}

  async createMessage(request: Omit<ModelRequest, 'model'>): Promise<ModelResponse> {
    this.client ??= import(BEDROCK_SDK).then(
      (sdk: { AnthropicBedrockMantle: new (options: { awsRegion: string }) => BedrockMantleClient }) =>
        new sdk.AnthropicBedrockMantle({ awsRegion: this.awsRegion }),
    );
    const client = await this.client;
    return client.messages.create({ model: this.modelId, ...request });
  }
}

export function assistantModelFromConfig(config: ConfigService): AssistantModel {
  if (config.get<string>('SARVOAI_ENABLED') !== 'true') return new DisabledAssistantModel();
  return new BedrockAssistantModel(
    config.get<string>('SARVOAI_MODEL_ID') ?? 'anthropic.claude-haiku-5-5',
    config.get<string>('SARVOAI_AWS_REGION') ?? 'ap-southeast-1',
  );
}
