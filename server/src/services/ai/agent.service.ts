/**
 * AI Agent Service
 * Orchestrates conversations with the LLM and handles tool execution
 */

import { prisma } from '../../config/database';
import { llmService } from '../llm';
import type { ChatMessage, ToolCall, ChatCompletionOptions } from '../llm/llm.types';
import { getSystemPrompt } from './prompts';
import { executeTool, getToolDefinitions, type ToolContext, type ToolResult } from './tools';
import type { User, Conversation, Message, MessageRole } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface ChatRequest {
  userId: string;
  conversationId?: string;
  message: string;
}

export interface ChatResponse {
  conversationId: string;
  message: {
    id: string;
    role: MessageRole;
    content: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
  };
  conversation: {
    id: string;
    title: string;
  };
}

export interface StreamChatResponse {
  conversationId: string;
  messageId: string;
  stream: AsyncGenerator<string, void, unknown>;
}

interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert database messages to LLM message format
 */
function dbMessagesToLLMMessages(messages: Message[]): ChatMessage[] {
  return messages.map(msg => {
    const base: ChatMessage = {
      role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system' | 'tool',
      content: msg.content,
    };

    // Add tool calls if present
    if (msg.toolCalls && msg.role === 'ASSISTANT') {
      base.tool_calls = msg.toolCalls as ToolCall[];
    }

    // Add tool_call_id if this is a tool response
    if (msg.role === 'TOOL' && msg.toolResults) {
      const results = msg.toolResults as Array<{ tool_call_id?: string }>;
      if (results[0]?.tool_call_id) {
        base.tool_call_id = results[0].tool_call_id;
      }
    }

    return base;
  });
}

/**
 * Generate a conversation title from the first message
 */
function generateTitle(message: string): string {
  // Take first 50 characters or until first line break
  const firstLine = message.split('\n')[0] || message;
  if (firstLine.length <= 50) {
    return firstLine;
  }
  return firstLine.substring(0, 47) + '...';
}

/**
 * Execute multiple tool calls and return results
 */
async function executeToolCalls(
  toolCalls: ToolCall[],
  context: ToolContext
): Promise<{ toolCall: ToolCall; result: ToolResult }[]> {
  const results = [];

  for (const toolCall of toolCalls) {
    const args = typeof toolCall.function.arguments === 'string'
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    const result = await executeTool(toolCall.function.name, args, context);
    results.push({ toolCall, result });
  }

  return results;
}

// =============================================================================
// Agent Service
// =============================================================================

/**
 * Process a chat message and return a response
 */
export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const { userId, message } = request;

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get or create conversation
  let conversation: ConversationWithMessages;
  if (request.conversationId) {
    const existingConversation = await prisma.conversation.findFirst({
      where: { id: request.conversationId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!existingConversation) {
      throw new Error('Conversation not found');
    }

    conversation = existingConversation;
  } else {
    // Create new conversation
    conversation = await prisma.conversation.create({
      data: {
        userId,
        title: generateTitle(message),
      },
      include: { messages: true },
    });
  }

  // Save user message
  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'USER',
      content: message,
    },
  });
  conversation.messages.push(userMessage);

  // Build message history for LLM
  const systemMessage: ChatMessage = {
    role: 'system',
    content: getSystemPrompt({
      includeCurrentDate: true,
      userTimezone: user.timezone,
    }),
  };

  const conversationMessages = dbMessagesToLLMMessages(conversation.messages);
  const messages: ChatMessage[] = [systemMessage, ...conversationMessages];

  // Get tool definitions
  const tools = getToolDefinitions();

  // Create tool context
  const toolContext: ToolContext = { user };

  // Build chat completion options
  const chatOptions: ChatCompletionOptions = {
    messages,
    tools,
    tool_choice: 'auto',
  };

  // Call LLM with tool support
  let response = await llmService.chat(userId, chatOptions);

  // Handle tool calls in a loop
  const maxToolIterations = 10;
  let iterations = 0;
  const allToolResults: ToolResult[] = [];

  while (response.tool_calls && response.tool_calls.length > 0 && iterations < maxToolIterations) {
    iterations++;

    // Execute tool calls
    const toolResults = await executeToolCalls(response.tool_calls, toolContext);

    // Save assistant message with tool calls
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: response.content || '',
        toolCalls: response.tool_calls as unknown as Parameters<typeof prisma.message.create>[0]['data']['toolCalls'],
      },
    });
    messages.push({
      role: 'assistant',
      content: response.content || '',
      tool_calls: response.tool_calls,
    });

    // Add tool results to messages
    for (const { toolCall, result } of toolResults) {
      allToolResults.push(result);

      // Save tool result message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'TOOL',
          content: JSON.stringify(result.data || result.error),
          toolResults: [{
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            ...result,
          }] as unknown as Parameters<typeof prisma.message.create>[0]['data']['toolResults'],
        },
      });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result.data || result.error),
      });
    }

    // Call LLM again with tool results
    response = await llmService.chat(userId, { messages, tools, tool_choice: 'auto' });
  }

  // Save final assistant response
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: response.content || '',
      toolCalls: response.tool_calls as unknown as Parameters<typeof prisma.message.create>[0]['data']['toolCalls'],
    },
  });

  return {
    conversationId: conversation.id,
    message: {
      id: assistantMessage.id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      toolCalls: response.tool_calls,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
    },
    conversation: {
      id: conversation.id,
      title: conversation.title,
    },
  };
}

/**
 * Process a chat message and return a streaming response
 */
export async function chatStream(request: ChatRequest): Promise<StreamChatResponse> {
  const { userId, message } = request;

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get or create conversation
  let conversation: ConversationWithMessages;
  if (request.conversationId) {
    const existingConversation = await prisma.conversation.findFirst({
      where: { id: request.conversationId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!existingConversation) {
      throw new Error('Conversation not found');
    }

    conversation = existingConversation;
  } else {
    // Create new conversation
    conversation = await prisma.conversation.create({
      data: {
        userId,
        title: generateTitle(message),
      },
      include: { messages: true },
    });
  }

  // Save user message
  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'USER',
      content: message,
    },
  });
  conversation.messages.push(userMessage);

  // Create a placeholder for the assistant message
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: '', // Will be updated as we stream
    },
  });

  // Build message history for LLM
  const systemMessage: ChatMessage = {
    role: 'system',
    content: getSystemPrompt({
      includeCurrentDate: true,
      userTimezone: user.timezone,
    }),
  };

  const conversationMessages = dbMessagesToLLMMessages(
    conversation.messages.filter(m => m.id !== assistantMessage.id)
  );
  const messages: ChatMessage[] = [systemMessage, ...conversationMessages];

  // Get tool definitions
  const tools = getToolDefinitions();

  // Create tool context (user is guaranteed non-null at this point)
  const toolContext: ToolContext = { user };

  // Create streaming generator
  async function* streamGenerator(): AsyncGenerator<string, void, unknown> {
    let fullContent = '';
    let currentToolCalls: ToolCall[] = [];

    // Build stream options
    const streamOptions: ChatCompletionOptions = {
      messages,
      tools,
      tool_choice: 'auto',
      stream: true,
    };

    // Get streaming response from LLM
    const stream = llmService.chatStream(userId, streamOptions);

    for await (const chunk of stream) {
      // StreamChunk has delta.content structure
      if (chunk.delta?.content) {
        fullContent += chunk.delta.content;
        yield chunk.delta.content;
      }

      // Check for tool calls in the chunk (they come via delta.tool_calls)
      if (chunk.delta?.tool_calls) {
        // Accumulate partial tool calls
        for (let i = 0; i < chunk.delta.tool_calls.length; i++) {
          const partialTC = chunk.delta.tool_calls[i];
          if (!partialTC) continue;
          
          // Use the index from the array position
          if (!currentToolCalls[i]) {
            currentToolCalls[i] = {
              id: partialTC.id || '',
              type: 'function',
              function: {
                name: partialTC.function?.name || '',
                arguments: partialTC.function?.arguments || '',
              },
            };
          } else {
            // Accumulate arguments for existing tool call
            const existingTC = currentToolCalls[i];
            if (existingTC) {
              if (partialTC.id) existingTC.id = partialTC.id;
              if (partialTC.function?.name) existingTC.function.name = partialTC.function.name;
              if (partialTC.function?.arguments) {
                existingTC.function.arguments += partialTC.function.arguments;
              }
            }
          }
        }
      }
    }

    // Filter out incomplete tool calls
    currentToolCalls = currentToolCalls.filter(tc => tc.id && tc.function.name);

    // Handle tool calls if present
    if (currentToolCalls.length > 0) {
      // Execute tools
      const toolResults = await executeToolCalls(currentToolCalls, toolContext);

      // Update the assistant message with tool calls
      await prisma.message.update({
        where: { id: assistantMessage.id },
        data: {
          content: fullContent,
          toolCalls: currentToolCalls as unknown as Parameters<typeof prisma.message.update>[0]['data']['toolCalls'],
        },
      });

      // Add tool result messages
      const toolMessages: ChatMessage[] = [{
        role: 'assistant',
        content: fullContent,
        tool_calls: currentToolCalls,
      }];

      for (const { toolCall, result } of toolResults) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'TOOL',
            content: JSON.stringify(result.data || result.error),
            toolResults: [{
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              ...result,
            }] as unknown as Parameters<typeof prisma.message.create>[0]['data']['toolResults'],
          },
        });

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result.data || result.error),
        });
      }

      // Signal tool execution to client
      yield '\n\n[Tool execution complete, generating response...]\n\n';

      // Get continuation from LLM
      const continuationMessages = [...messages, ...toolMessages];
      const continuationStream = llmService.chatStream(userId, {
        messages: continuationMessages,
        tools,
        tool_choice: 'auto',
        stream: true,
      });

      let continuationContent = '';
      for await (const chunk of continuationStream) {
        if (chunk.delta?.content) {
          continuationContent += chunk.delta.content;
          yield chunk.delta.content;
        }
      }

      // Create final message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: continuationContent,
        },
      });
    } else {
      // No tool calls, just update the message with final content
      await prisma.message.update({
        where: { id: assistantMessage.id },
        data: { content: fullContent },
      });
    }
  }

  return {
    conversationId: conversation.id,
    messageId: assistantMessage.id,
    stream: streamGenerator(),
  };
}

/**
 * Get conversation history
 */
export async function getConversation(
  userId: string,
  conversationId: string
): Promise<ConversationWithMessages | null> {
  return prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

/**
 * List user conversations
 */
export async function listConversations(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Conversation[]> {
  const { limit = 20, offset = 0 } = options;

  return prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  userId: string,
  conversationId: string
): Promise<void> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  await prisma.conversation.delete({
    where: { id: conversationId },
  });
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  userId: string,
  conversationId: string,
  title: string
): Promise<Conversation> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  return prisma.conversation.update({
    where: { id: conversationId },
    data: { title },
  });
}

/**
 * Generate a quick daily briefing (no conversation context)
 */
export async function generateQuickBriefing(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Create a temporary conversation for the briefing
  const request: ChatRequest = {
    userId,
    message: 'Generate my daily briefing. What do I need to focus on today?',
  };

  const response = await chat(request);
  return response.message.content;
}

export default {
  chat,
  chatStream,
  getConversation,
  listConversations,
  deleteConversation,
  updateConversationTitle,
  generateQuickBriefing,
};
