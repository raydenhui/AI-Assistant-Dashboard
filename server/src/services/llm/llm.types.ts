// =============================================================================
// LLM Types and Interfaces
// =============================================================================

/**
 * Supported LLM providers
 */
export type LLMProviderType = 'openrouter' | 'ollama';

/**
 * Message roles in a conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Tool/Function definition for function calling
 */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required?: string[];
    };
  };
}

/**
 * Parameter definition for tool functions
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
}

/**
 * Tool call made by the LLM
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Parsed tool call with arguments as object
 */
export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Chat completion request options
 */
export interface ChatCompletionOptions {
  messages: ChatMessage[];
  tools?: Tool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
  response_format?: { type: 'json_object' | 'text' };
}

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  model: string;
  content: string | null;
  tool_calls?: ToolCall[];
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
  usage?: TokenUsage;
}

/**
 * Streaming chunk from LLM
 */
export interface StreamChunk {
  id: string;
  model: string;
  delta: {
    content?: string;
    tool_calls?: Partial<ToolCall>[];
  };
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
}

/**
 * LLM Provider configuration
 */
export interface LLMProviderConfig {
  provider: LLMProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Provider health status
 */
export interface ProviderHealthStatus {
  provider: LLMProviderType;
  available: boolean;
  model: string;
  error?: string;
  latencyMs?: number;
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}
