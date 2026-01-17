// LLM Service Module - Unified interface for LLM providers
// Supports OpenRouter (cloud) and Ollama (local)

export * from './llm.types.js';
export { LLMProvider } from './llm.provider.js';
export { OpenRouterProvider } from './openrouter.provider.js';
export { OllamaProvider } from './ollama.provider.js';
export { llmService } from './llm.service.js';

// Default export
export { llmService as default } from './llm.service.js';
