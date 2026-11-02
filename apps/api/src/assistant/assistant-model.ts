import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import type Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';

export type ModelRequest = Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>;

/** The model behind SarvoAI. An interface so the service can be tested with a fake model. */
export interface AssistantModel {
  readonly modelId: string;
  createMessage(request: ModelRequest): Promise<Anthropic.Message>;
}

export const ASSISTANT_MODEL = Symbol('ASSISTANT_MODEL');

export class AssistantNotConfiguredError extends Error {}

/** Used when SARVOAI_ENABLED is not "true": the endpoint answers 503 instead of calling AWS. */
export class DisabledAssistantModel implements AssistantModel {
  readonly modelId = 'disabled';

  createMessage(): Promise<Anthropic.Message> {
    return Promise.reject(new AssistantNotConfiguredError('SarvoAI is not switched on for this environment'));
  }
}

/** Claude on Amazon Bedrock. AWS credentials come from the default chain (the task's IAM role in AWS). */
export class BedrockAssistantModel implements AssistantModel {
  private readonly client: AnthropicBedrockMantle;

  constructor(
    readonly modelId: string,
    awsRegion: string,
  ) {
    this.client = new AnthropicBedrockMantle({ awsRegion });
  }

  createMessage(request: ModelRequest): Promise<Anthropic.Message> {
    return this.client.messages.create({ model: this.modelId, ...request });
  }
}

export function assistantModelFromConfig(config: ConfigService): AssistantModel {
  if (config.get<string>('SARVOAI_ENABLED') !== 'true') return new DisabledAssistantModel();
  return new BedrockAssistantModel(
    config.get<string>('SARVOAI_MODEL_ID') ?? 'anthropic.claude-haiku-5-5',
    config.get<string>('SARVOAI_AWS_REGION') ?? 'ap-southeast-1',
  );
}
