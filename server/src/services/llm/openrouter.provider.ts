import { LLMProvider } from './llm.provider.js';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  ProviderHealthStatus,
  LLMProviderConfig,
  ModelInfo,
  ChatMessage,
  Tool,
} from './llm.types.js';

/**
 * OpenRouter LLM Provider
 * Uses OpenAI-compatible API format
 * https://openrouter.ai/docs
 */
export class OpenRouterProvider extends LLMProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.apiKey = config.apiKey || '';
  }

  get providerType(): string {
    return 'openrouter';
  }

  /**
   * Build request headers
   */
  private getHeaders(): Record<string, string> {
    // Ensure apiKey is a clean string without non-ASCII characters
    const cleanApiKey = typeof this.apiKey === 'string'
      ? this.apiKey.replace(/[^\x00-\x7F]/g, '').trim()
      : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3001', // Required by OpenRouter
      'X-Title': 'AI Dashboard', // App identification
    };

    if (cleanApiKey) {
      headers['Authorization'] = `Bearer ${cleanApiKey}`;
    }

    return headers;
  }

  /**
   * Build request body
   */
  private buildRequestBody(options: ChatCompletionOptions): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: this.formatMessages(options.messages),
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? this.config.maxTokens ?? 4096,
      stream: options.stream ?? false,
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
      body.tool_choice = options.tool_choice ?? 'auto';
    }

    if (options.top_p !== undefined) body.top_p = options.top_p;
    if (options.frequency_penalty !== undefined) body.frequency_penalty = options.frequency_penalty;
    if (options.presence_penalty !== undefined) body.presence_penalty = options.presence_penalty;
    if (options.stop) body.stop = options.stop;
    if (options.response_format) body.response_format = options.response_format;

    return body;
  }

  /**
   * Format messages for OpenRouter API
   */
  private formatMessages(messages: ChatMessage[]): Record<string, unknown>[] {
    return messages.map((msg) => {
      const formatted: Record<string, unknown> = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.name) formatted.name = msg.name;
      if (msg.tool_calls) formatted.tool_calls = msg.tool_calls;
      if (msg.tool_call_id) formatted.tool_call_id = msg.tool_call_id;

      return formatted;
    });
  }

  /**
   * Send a chat completion request
   */
  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const headers = this.getHeaders();
    const body = this.buildRequestBody({ ...options, stream: false });
    
    console.log(`[OpenRouterProvider] Sending request to ${this.baseUrl}/chat/completions`, {
      model: body.model,
      messageCount: (body.messages as any[]).length,
      hasApiKey: !!headers['Authorization'],
      apiKeyPreview: headers['Authorization']?.substring(0, 15) + '...'
    });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[OpenRouterProvider] API Error:`, {
        status: response.status,
        statusText: response.statusText,
        error
      });
      throw new Error(
        `OpenRouter API error: ${response.status} - ${(error as Record<string, unknown>).message || response.statusText}`
      );
    }

    const data = await response.json() as {
      id: string;
      model: string;
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    const choice = data.choices[0];

    return {
      id: data.id,
      model: data.model,
      content: choice?.message?.content ?? null,
      tool_calls: choice?.message?.tool_calls?.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
      finish_reason: (choice?.finish_reason as ChatCompletionResponse['finish_reason']) ?? null,
      usage: data.usage,
    };
  }

  /**
   * Send a streaming chat completion request
   */
  async *chatStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(this.buildRequestBody({ ...options, stream: true })),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `OpenRouter API error: ${response.status} - ${(error as Record<string, unknown>).message || response.statusText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6)) as {
              id: string;
              model: string;
              choices: Array<{
                delta: {
                  content?: string;
                  tool_calls?: Array<{
                    id?: string;
                    type?: string;
                    function?: { name?: string; arguments?: string };
                  }>;
                };
                finish_reason: string | null;
              }>;
            };
            const choice = json.choices[0];

            yield {
              id: json.id,
              model: json.model,
              delta: {
                content: choice?.delta?.content,
                tool_calls: choice?.delta?.tool_calls?.map((tc) => ({
                  id: tc.id || '',
                  type: 'function' as const,
                  function: {
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '',
                  },
                })),
              },
              finish_reason: (choice?.finish_reason as StreamChunk['finish_reason']) ?? null,
            };
          } catch {
            // Skip invalid JSON
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
  async isAvailable(apiKey?: string): Promise<boolean> {
    try {
      const status = await this.getHealthStatus(apiKey);
      return status.available;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed health status
   */
  async getHealthStatus(apiKey?: string): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    
    // Clean the provided apiKey if it exists
    const cleanApiKey = typeof apiKey === 'string'
      ? apiKey.replace(/[^\x00-\x7F]/g, '').trim()
      : undefined;

    const headers = { ...this.getHeaders() };
    if (cleanApiKey) {
      headers['Authorization'] = `Bearer ${cleanApiKey}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          provider: 'openrouter',
          available: false,
          model: this.config.model,
          error: `API returned ${response.status}`,
          latencyMs,
        };
      }

      return {
        provider: 'openrouter',
        available: true,
        model: this.config.model,
        latencyMs,
      };
    } catch (error) {
      return {
        provider: 'openrouter',
        available: false,
        model: this.config.model,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * List available models
   */
  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    // Clean the provided apiKey if it exists
    const cleanApiKey = typeof apiKey === 'string'
      ? apiKey.replace(/[^\x00-\x7F]/g, '').trim()
      : undefined;

    const headers = { ...this.getHeaders() };
    if (cleanApiKey) {
      headers['Authorization'] = `Bearer ${cleanApiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/models`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = await response.json() as {
      data: Array<{
        id: string;
        name: string;
        context_length?: number;
        pricing?: {
          prompt: string;
          completion: string;
        };
      }>;
    };

    return data.data.map((model) => ({
      id: model.id,
      name: model.name || model.id,
      provider: 'openrouter',
      contextLength: model.context_length,
      pricing: model.pricing
        ? {
            prompt: parseFloat(model.pricing.prompt),
            completion: parseFloat(model.pricing.completion),
          }
        : undefined,
    }));
  }
}

export default OpenRouterProvider;
