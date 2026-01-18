/**
 * AI Services Module
 * Exports all AI-related services, tools, and utilities
 */

// Agent Service - Main orchestrator for AI conversations
export {
  chat,
  chatStream,
  getConversation,
  listConversations,
  deleteConversation,
  updateConversationTitle,
  generateQuickBriefing,
  type ChatRequest,
  type ChatResponse,
  type StreamChatResponse,
  default as agentService,
} from './agent.service';

// Tools - AI function calling tools
export {
  executeTool,
  getToolDefinitions,
  AI_TOOLS,
  TOOL_HANDLERS,
  type ToolContext,
  type ToolResult,
} from './tools';

// Prompts - System prompts for AI
export {
  SYSTEM_PROMPT,
  EMAIL_PRIORITY_PROMPT,
  ACTION_EXTRACTION_PROMPT,
  DAILY_BRIEFING_PROMPT,
  MEETING_PREP_PROMPT,
  EMAIL_REPLY_PROMPT,
  CONFLICT_DETECTION_PROMPT,
  getSystemPrompt,
  getToolExecutionPrompt,
} from './prompts';
