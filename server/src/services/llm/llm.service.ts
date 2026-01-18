import { User } from '@prisma/client';
import { config } from '../../config/index.js';
import prisma from '../../config/database.js';
import { LLMProvider } from './llm.provider.js';
import { OpenRouterProvider } from './openrouter.provider.js';
import { OllamaProvider } from './ollama.provider.js';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  ProviderHealthStatus,
  LLMProviderConfig,
  ModelInfo,
  LLMProviderType,
  ParsedToolCall,
} from './llm.types.js';
import { BadRequestError } from '../../middleware/error.middleware.js';

/**
 * LLM Service
 * Manages LLM providers and provides a unified interface for chat completions
 */
class LLMService {
  private providers: Map<LLMProviderType, LLMProvider> = new Map();
  private defaultProvider: LLMProviderType = 'openrouter';

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize default providers from configuration
   */
  private initializeProviders(): void {
    // Initialize OpenRouter provider
    if (config.llm.openrouter.apiKey) {
      const openrouterProvider = new OpenRouterProvider({
        provider: 'openrouter',
        model: config.llm.openrouter.defaultModel,
        apiKey: config.llm.openrouter.apiKey,
        baseUrl: config.llm.openrouter.baseUrl,
      });
      this.providers.set('openrouter', openrouterProvider);
    }

    // Initialize Ollama provider
    const ollamaProvider = new OllamaProvider({
      provider: 'ollama',
      model: config.llm.ollama.defaultModel,
      baseUrl: config.llm.ollama.baseUrl,
    });
    this.providers.set('ollama', ollamaProvider);
  }

  /**
   * Get provider for a specific user based on their settings
   */
  async getProviderForUser(userId: string): Promise<LLMProvider> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    }) as any;

    if (!user) {
      throw new BadRequestError('User not found');
    }

    const providerType = user.llmProvider.toLowerCase() as LLMProviderType;
    return this.getProvider(
      providerType,
      user.llmSettings as Record<string, unknown> | null,
      user.openRouterKey
    );
  }

  /**
   * Get a specific provider
   */
  getProvider(
    providerType: LLMProviderType,
    userSettings?: Record<string, unknown> | null,
    userApiKey?: string | null
  ): LLMProvider {
    let provider = this.providers.get(providerType);

    // If it's openrouter and user has their own key, we MUST create a new instance
    if (providerType === 'openrouter' && userApiKey) {
      return new OpenRouterProvider({
        provider: 'openrouter',
        model: (userSettings?.model as string) || config.llm.openrouter.defaultModel,
        apiKey: userApiKey,
        baseUrl: config.llm.openrouter.baseUrl,
        temperature: (userSettings?.temperature as number) || undefined,
        maxTokens: (userSettings?.maxTokens as number) || undefined,
      });
    }

    if (!provider) {
      throw new BadRequestError(`LLM provider ${providerType} not configured`);
    }

    // Apply user-specific settings if provided
    if (userSettings) {
      const updatedConfig: Partial<LLMProviderConfig> = {};
      
      if (userSettings.model && typeof userSettings.model === 'string') {
        updatedConfig.model = userSettings.model;
      }
      if (userSettings.temperature && typeof userSettings.temperature === 'number') {
        updatedConfig.temperature = userSettings.temperature;
      }
      if (userSettings.maxTokens && typeof userSettings.maxTokens === 'number') {
        updatedConfig.maxTokens = userSettings.maxTokens;
      }

      if (Object.keys(updatedConfig).length > 0) {
        // Create a new provider instance with updated config
        // to avoid modifying the shared instance
        if (providerType === 'openrouter') {
          provider = new OpenRouterProvider({
            provider: 'openrouter',
            model: updatedConfig.model || config.llm.openrouter.defaultModel,
            apiKey: userApiKey || config.llm.openrouter.apiKey,
            baseUrl: config.llm.openrouter.baseUrl,
            temperature: updatedConfig.temperature,
            maxTokens: updatedConfig.maxTokens,
          });
        } else if (providerType === 'ollama') {
          provider = new OllamaProvider({
            provider: 'ollama',
            model: updatedConfig.model || config.llm.ollama.defaultModel,
            baseUrl: config.llm.ollama.baseUrl,
            temperature: updatedConfig.temperature,
            maxTokens: updatedConfig.maxTokens,
          });
        }
      }
    }

    return provider;
  }

  /**
   * Send a chat completion request for a user
   */
  async chat(
    userId: string,
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const provider = await this.getProviderForUser(userId);
    return provider.chat(options);
  }

  /**
   * Send a streaming chat completion request for a user
   */
  async *chatStream(
    userId: string,
    options: ChatCompletionOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const provider = await this.getProviderForUser(userId);
    yield* provider.chatStream(options);
  }

  /**
   * Chat with a specific provider (for testing or direct provider access)
   */
  async chatWithProvider(
    providerType: LLMProviderType,
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const provider = this.getProvider(providerType);
    return provider.chat(options);
  }

  /**
   * Stream chat with a specific provider
   */
  async *chatStreamWithProvider(
    providerType: LLMProviderType,
    options: ChatCompletionOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const provider = this.getProvider(providerType);
    yield* provider.chatStream(options);
  }

  /**
   * Check health status of all providers
   */
  async getAllHealthStatuses(): Promise<ProviderHealthStatus[]> {
    const statuses: ProviderHealthStatus[] = [];

    for (const [_, provider] of this.providers) {
      try {
        const status = await provider.getHealthStatus();
        statuses.push(status);
      } catch (error) {
        statuses.push({
          provider: provider.providerType as LLMProviderType,
          available: false,
          model: provider.model,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return statuses;
  }

  /**
   * Check health status of a specific provider
   */
  async getHealthStatus(providerType: LLMProviderType): Promise<ProviderHealthStatus> {
    const provider = this.providers.get(providerType);
    
    if (!provider) {
      return {
        provider: providerType,
        available: false,
        model: 'unknown',
        error: `Provider ${providerType} not configured`,
      };
    }

    return provider.getHealthStatus();
  }

  /**
   * List available models for a provider
   */
  async listModels(providerType: LLMProviderType): Promise<ModelInfo[]> {
    const provider = this.getProvider(providerType);
    return provider.listModels();
  }

  /**
   * Check if a provider is available
   */
  async isProviderAvailable(providerType: LLMProviderType): Promise<boolean> {
    const provider = this.providers.get(providerType);
    if (!provider) return false;
    return provider.isAvailable();
  }

  /**
   * Parse tool calls from a response
   */
  parseToolCalls(toolCalls: ChatCompletionResponse['tool_calls']): ParsedToolCall[] {
    if (!toolCalls) return [];

    return toolCalls.map((tc) => {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments);
      } catch {
        console.warn(`Failed to parse tool arguments: ${tc.function.arguments}`);
      }

      return {
        id: tc.id,
        name: tc.function.name,
        arguments: parsedArgs,
      };
    });
  }

  /**
   * Get the default provider type
   */
  getDefaultProviderType(): LLMProviderType {
    return this.defaultProvider;
  }

  /**
   * Get available provider types
   */
  getAvailableProviderTypes(): LLMProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get the OpenRouter provider instance
   */
  getOpenRouterProvider(): OpenRouterProvider {
    const provider = this.providers.get('openrouter');
    if (!provider || !(provider instanceof OpenRouterProvider)) {
      throw new BadRequestError('OpenRouter provider not configured');
    }
    return provider as OpenRouterProvider;
  }

  /**
   * Get the Ollama provider instance
   */
  getOllamaProvider(): OllamaProvider {
    const provider = this.providers.get('ollama');
    if (!provider || !(provider instanceof OllamaProvider)) {
      throw new BadRequestError('Ollama provider not configured');
    }
    return provider as OllamaProvider;
  }
}

// Export singleton instance
export const llmService = new LLMService();

export default llmService;
