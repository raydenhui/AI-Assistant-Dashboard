import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  ProviderHealthStatus,
  LLMProviderConfig,
  ModelInfo,
} from './llm.types.js';

/**
 * Abstract base class for LLM providers
 * Defines the interface that all providers must implement
 */
export abstract class LLMProvider {
  protected config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  /**
   * Get the provider type
   */
  abstract get providerType(): string;

  /**
   * Get the current model
   */
  get model(): string {
    return this.config.model;
  }

  /**
   * Send a chat completion request
   */
  abstract chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse>;

  /**
   * Send a streaming chat completion request
   * Returns an async generator that yields chunks
   */
  abstract chatStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Check if the provider is available and working
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get detailed health status
   */
  abstract getHealthStatus(): Promise<ProviderHealthStatus>;

  /**
   * List available models
   */
  abstract listModels(): Promise<ModelInfo[]>;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LLMProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default LLMProvider;
