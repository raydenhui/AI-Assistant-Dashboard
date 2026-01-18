import { LLMProvider } from './llm.provider.js';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  ProviderHealthStatus,
  LLMProviderConfig,
  ModelInfo,
  ChatMessage,
  ToolCall,
} from './llm.types.js';

/**
 * Ollama LLM Provider
 * Connects to local Ollama instance
 * https://ollama.ai/
 */
export class OllamaProvider extends LLMProvider {
  private baseUrl: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  get providerType(): string {
    return 'ollama';
  }

  /**
   * Format messages for Ollama API
   */
  private formatMessages(messages: ChatMessage[]): Record<string, unknown>[] {
    return messages.map((msg) => {
      const formatted: Record<string, unknown> = {
        role: msg.role,
        content: msg.content,
      };

      // Ollama supports tool calls in newer versions
      if (msg.tool_calls) {
        formatted.tool_calls = msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }

      return formatted;
    });
  }

  /**
   * Build request body for Ollama API
   */
  private buildRequestBody(options: ChatCompletionOptions): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: this.formatMessages(options.messages),
      stream: options.stream ?? false,
      options: {
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        num_predict: options.max_tokens ?? this.config.maxTokens ?? 4096,
      },
    };

    // Ollama supports tools/function calling in newer versions
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    return body;
  }

  /**
   * Send a chat completion request
   */
  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.buildRequestBody({ ...options, stream: false })),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      message: {
        role: string;
        content: string;
        tool_calls?: Array<{
          id?: string;
          type?: string;
          function: { name: string; arguments: Record<string, unknown> | string };
        }>;
      };
      model: string;
      done: boolean;
      done_reason?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    // Parse tool calls if present
    let toolCalls: ToolCall[] | undefined;
    if (data.message.tool_calls && data.message.tool_calls.length > 0) {
      toolCalls = data.message.tool_calls.map((tc, index) => ({
        id: tc.id || `call_${index}`,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function.arguments),
        },
      }));
    }

    // Determine finish reason
    let finishReason: ChatCompletionResponse['finish_reason'] = 'stop';
    if (toolCalls && toolCalls.length > 0) {
      finishReason = 'tool_calls';
    } else if (data.done_reason === 'length') {
      finishReason = 'length';
    }

    return {
      id: `ollama-${Date.now()}`,
      model: data.model,
      content: data.message.content || null,
      tool_calls: toolCalls,
      finish_reason: finishReason,
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  /**
   * Send a streaming chat completion request
   */
  async *chatStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.buildRequestBody({ ...options, stream: true })),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let messageId = `ollama-stream-${Date.now()}`;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const data = JSON.parse(trimmed) as {
              message?: {
                content?: string;
                tool_calls?: Array<{
                  id?: string;
                  function: { name: string; arguments: Record<string, unknown> | string };
                }>;
              };
              model: string;
              done: boolean;
              done_reason?: string;
            };

            // Build tool calls if present
            let toolCalls: Partial<ToolCall>[] | undefined;
            if (data.message?.tool_calls) {
              toolCalls = data.message.tool_calls.map((tc, index) => ({
                id: tc.id || `call_${index}`,
                type: 'function' as const,
                function: {
                  name: tc.function.name,
                  arguments: typeof tc.function.arguments === 'string'
                    ? tc.function.arguments
                    : JSON.stringify(tc.function.arguments),
                },
              }));
            }

            // Determine finish reason
            let finishReason: StreamChunk['finish_reason'] = null;
            if (data.done) {
              if (toolCalls && toolCalls.length > 0) {
                finishReason = 'tool_calls';
              } else if (data.done_reason === 'length') {
                finishReason = 'length';
              } else {
                finishReason = 'stop';
              }
            }

            yield {
              id: messageId,
              model: data.model,
              delta: {
                content: data.message?.content,
                tool_calls: toolCalls,
              },
              finish_reason: finishReason,
            };
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Check if the provider is available
   */
  async isAvailable(_apiKey?: string): Promise<boolean> {
    try {
      const status = await this.getHealthStatus();
      return status.available;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed health status
   */
  async getHealthStatus(_apiKey?: string): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    try {
      // Check if Ollama is running by listing tags
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          provider: 'ollama',
          available: false,
          model: this.config.model,
          error: `API returned ${response.status}`,
          latencyMs,
        };
      }

      // Check if the specific model is available
      const data = await response.json() as {
        models: Array<{ name: string }>;
      };
      const modelAvailable = data.models.some(
        (m) => m.name === this.config.model || m.name.startsWith(`${this.config.model}:`)
      );

      if (!modelAvailable) {
        return {
          provider: 'ollama',
          available: false,
          model: this.config.model,
          error: `Model ${this.config.model} not found. Run: ollama pull ${this.config.model}`,
          latencyMs,
        };
      }

      return {
        provider: 'ollama',
        available: true,
        model: this.config.model,
        latencyMs,
      };
    } catch (error) {
      return {
        provider: 'ollama',
        available: false,
        model: this.config.model,
        error: error instanceof Error ? error.message : 'Ollama not running',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * List available models
   */
  async listModels(_apiKey?: string): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = await response.json() as {
      models: Array<{
        name: string;
        size: number;
        digest: string;
        modified_at: string;
      }>;
    };

    return data.models.map((model) => ({
      id: model.name,
      name: model.name,
      provider: 'ollama',
    }));
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to pull model: ${error}`);
    }

    // Stream the response to track progress (not implemented here for simplicity)
    await response.text();
  }
}

export default OllamaProvider;
