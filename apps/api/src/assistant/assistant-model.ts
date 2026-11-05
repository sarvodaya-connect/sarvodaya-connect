import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import type Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';

export type ModelRequest = Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>;

/** The model behind SarvoAI. An interface so the service can be tested with a fake model. */
export interface AssistantModel {
  readonly modelId: string;
  createMessage(request: ModelRequest, signal?: AbortSignal): Promise<Anthropic.Message>;
}

export const ASSISTANT_MODEL = Symbol('ASSISTANT_MODEL');

/** Below the API's 29-second Lambda timeout, so a slow call is reconciled, not cut off. */
export const MODEL_TIMEOUT_MS = 25_000;

export const DEFAULT_MODEL_ID = 'global.anthropic.claude-haiku-5-5';
export const DEFAULT_REGION = 'ap-southeast-1';

export class AssistantNotConfiguredError extends Error {}

/** Used when SARVOAI_ENABLED is not "true": the endpoint answers 503 instead of calling AWS. */
export class DisabledAssistantModel implements AssistantModel {
  readonly modelId = 'disabled';

  createMessage(): Promise<Anthropic.Message> {
    return Promise.reject(new AssistantNotConfiguredError('SarvoAI is not switched on for this environment'));
  }
}

/**
 * Claude on Amazon Bedrock through the bedrock-runtime endpoint (InvokeModel). In Singapore,
 * Claude Haiku 5.5 is served only through the global inference profile on this endpoint, not on
 * bedrock-mantle. Requests are signed with the default AWS credential chain (the task's IAM role).
 */
export class BedrockAssistantModel implements AssistantModel {
  private readonly client: AnthropicBedrock;

  constructor(
    readonly modelId: string,
    awsRegion: string,
  ) {
    // apiKey null: never pick up a stray AWS_BEARER_TOKEN_BEDROCK; sign with IAM instead.
    // maxRetries 0: an SDK retry after a timeout could be billed twice under one
    // reservation of the spending limit (issue #96). Asking again reserves again.
    this.client = new AnthropicBedrock({ awsRegion, apiKey: null, maxRetries: 0, timeout: MODEL_TIMEOUT_MS, logLevel: 'off' });
  }

  createMessage(request: ModelRequest, signal?: AbortSignal): Promise<Anthropic.Message> {
    return this.client.messages.create({ ...request, model: this.modelId }, { signal });
  }
}

export function assistantModelFromConfig(config: ConfigService): AssistantModel {
  if (config.get<string>('SARVOAI_ENABLED') !== 'true') return new DisabledAssistantModel();
  return new BedrockAssistantModel(
    config.get<string>('SARVOAI_MODEL_ID') ?? DEFAULT_MODEL_ID,
    config.get<string>('SARVOAI_AWS_REGION') ?? DEFAULT_REGION,
  );
}
