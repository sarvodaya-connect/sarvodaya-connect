import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import type Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import { reserveAssistantCall } from './assistant-budget.js';
import { scrubAssistantText } from './assistant-privacy.js';

const scrubPayload = (value: unknown): unknown => {
  if (typeof value === 'string') return scrubAssistantText(value);
  if (Array.isArray(value)) return value.map(scrubPayload);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'cache_control').map(([key, item]) => [key, scrubPayload(item)]));
  return value;
};

export type ModelRequest = Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>;

/** The model behind SarvoAI. An interface so the service can be tested with a fake model. */
export interface AssistantModel {
  readonly modelId: string;
  createMessage(request: ModelRequest, signal?: AbortSignal): Promise<Anthropic.Message>;
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

/**
 * Claude on Amazon Bedrock through the bedrock-runtime endpoint (InvokeModel). In Singapore,
 * Claude Haiku 5.5 is served only through the global inference profile on this endpoint, not on
 * bedrock-mantle. Requests are signed with the default AWS credential chain (the task's IAM role).
 */
export class BedrockAssistantModel implements AssistantModel {
  private readonly client: AnthropicBedrock;

  constructor(
    readonly modelId: string,
    private readonly awsRegion: string,
    private readonly reserve?: () => Promise<void>,
  ) {
    // apiKey null: never pick up a stray AWS_BEARER_TOKEN_BEDROCK; sign with IAM instead.
    this.client = new AnthropicBedrock({ awsRegion, apiKey: null, maxRetries: 0, timeout: 20_000, logLevel: 'off' });
  }

  async createMessage(request: ModelRequest, signal?: AbortSignal): Promise<Anthropic.Message> {
    if (this.modelId !== 'global.anthropic.claude-haiku-5-5' || this.awsRegion !== 'ap-southeast-1' || !this.reserve) {
      throw new AssistantNotConfiguredError('SarvoAI requires its reviewed model and spending gate');
    }
    if (Buffer.byteLength(JSON.stringify(request), 'utf8') > 65_536 || !Number.isInteger(request.max_tokens) || request.max_tokens < 1 || request.max_tokens > 2048) {
      throw new Error('SarvoAI request exceeds pilot limits');
    }
    const safe = scrubPayload(request) as ModelRequest;
    if (Buffer.byteLength(JSON.stringify(safe), 'utf8') > 65_536) throw new Error('SarvoAI sanitized request exceeds pilot limits');
    signal?.throwIfAborted();
    await this.reserve();
    signal?.throwIfAborted();
    // No caller-controlled tier, model, cache settings or extended thinking.
    return this.client.messages.create({
      model: this.modelId, max_tokens: 2048,
      system: safe.system, tools: safe.tools, messages: safe.messages,
      output_config: safe.output_config, thinking: { type: 'disabled' },
    }, { signal });
  }
}

export function assistantModelFromConfig(config: ConfigService, prisma?: PrismaService): AssistantModel {
  if (config.get<string>('SARVOAI_ENABLED') !== 'true') return new DisabledAssistantModel();
  return new BedrockAssistantModel(
    config.get<string>('SARVOAI_MODEL_ID') ?? 'global.anthropic.claude-haiku-5-5',
    config.get<string>('SARVOAI_AWS_REGION') ?? 'ap-southeast-1',
    () => reserveAssistantCall(config, prisma),
  );
}
