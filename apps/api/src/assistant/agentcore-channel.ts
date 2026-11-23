import { once } from 'node:events';
import WebSocket from 'ws';

export const AGENTCORE_MAX_FRAME_BYTES = 16_384;

/** The protocol alternates directions and has at most one unread frame. */
export class AgentCoreChannel {
  private incoming?: { value: unknown };
  private reader?: {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  };
  private failure?: Error;
  private readonly abort = () =>
    this.fail(new Error('SarvoAI AgentCore session timed out'));

  constructor(
    private readonly socket: WebSocket,
    private readonly signal: AbortSignal,
  ) {
    socket.on('message', (data: Buffer, binary) => {
      if (this.failure) return;
      if (
        binary ||
        !Buffer.isBuffer(data) ||
        data.length > AGENTCORE_MAX_FRAME_BYTES ||
        this.incoming
      ) {
        this.fail(new Error('Invalid SarvoAI AgentCore frame'));
        return;
      }
      let value: unknown;
      try {
        value = JSON.parse(data.toString('utf8'));
      } catch {
        this.fail(new Error('Invalid SarvoAI AgentCore JSON'));
        return;
      }
      if (this.reader) {
        const { resolve } = this.reader;
        this.reader = undefined;
        resolve(value);
      } else {
        this.incoming = { value };
      }
    });
    socket.on('close', () =>
      this.fail(new Error('SarvoAI AgentCore connection closed')),
    );
    socket.on('error', () =>
      this.fail(new Error('SarvoAI AgentCore connection failed')),
    );
    signal.addEventListener('abort', this.abort, { once: true });
    if (signal.aborted) this.abort();
  }

  async read(): Promise<unknown> {
    if (this.failure) throw this.failure;
    if (this.incoming) {
      const { value } = this.incoming;
      this.incoming = undefined;
      return value;
    }
    if (this.reader) throw new Error('Concurrent SarvoAI AgentCore reads');
    return new Promise((resolve, reject) => {
      this.reader = { resolve, reject };
    });
  }

  async send(frame: object): Promise<void> {
    if (this.failure) throw this.failure;
    const data = JSON.stringify(frame);
    if (Buffer.byteLength(data) > AGENTCORE_MAX_FRAME_BYTES) {
      throw new Error('SarvoAI AgentCore frame exceeds the size limit');
    }
    return new Promise((resolve, reject) => {
      this.socket.send(data, (error) => {
        if (error) reject(new Error('Could not send SarvoAI AgentCore frame'));
        else resolve();
      });
    });
  }

  close() {
    this.signal.removeEventListener('abort', this.abort);
    this.socket.close();
  }

  private fail(error: Error) {
    if (this.failure) return;
    this.failure = error;
    this.reader?.reject(error);
    this.reader = undefined;
    this.signal.removeEventListener('abort', this.abort);
    if (this.socket.readyState !== WebSocket.CLOSED) this.socket.terminate();
  }
}

export async function openAgentCoreChannel(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const socket = new WebSocket(url, {
    headers,
    maxPayload: AGENTCORE_MAX_FRAME_BYTES,
    perMessageDeflate: false,
  });
  try {
    await once(socket, 'open', { signal });
    return new AgentCoreChannel(socket, signal);
  } catch {
    socket.on('error', () => {});
    socket.terminate();
    throw new Error('Could not open the SarvoAI AgentCore connection');
  }
}

export function agentCoreFrame(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid SarvoAI AgentCore frame');
  }
  return value as Record<string, unknown>;
}
