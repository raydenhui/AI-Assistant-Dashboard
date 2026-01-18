/**
 * Chat Controller
 * Handles AI chat conversation endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  chat,
  chatStream,
  getConversation,
  listConversations,
  deleteConversation,
  updateConversationTitle,
  generateQuickBriefing,
} from '../services/ai';
import { NotFoundError } from '../middleware/error.middleware';

// =============================================================================
// Validation Schemas
// =============================================================================

const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000),
  conversationId: z.string().uuid().optional(),
});

const updateTitleSchema = z.object({
  title: z.string().min(1).max(200),
});

const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

// =============================================================================
// Controllers
// =============================================================================

/**
 * Send a message and get AI response
 * POST /api/chat/messages
 */
export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = sendMessageSchema.parse(req.body);

    const response = await chat({
      userId,
      message: body.message,
      conversationId: body.conversationId,
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send a message and stream the AI response
 * POST /api/chat/messages/stream
 */
export async function sendMessageStream(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = sendMessageSchema.parse(req.body);

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    const streamResponse = await chatStream({
      userId,
      message: body.message,
      conversationId: body.conversationId,
    });

    // Send initial metadata
    res.write(`data: ${JSON.stringify({
      type: 'start',
      conversationId: streamResponse.conversationId,
      messageId: streamResponse.messageId,
    })}\n\n`);

    // Stream content
    try {
      for await (const chunk of streamResponse.stream) {
        res.write(`data: ${JSON.stringify({
          type: 'content',
          content: chunk,
        })}\n\n`);
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({
        type: 'done',
        conversationId: streamResponse.conversationId,
        messageId: streamResponse.messageId,
      })}\n\n`);
    } catch (streamError) {
      // Send error through stream
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: streamError instanceof Error ? streamError.message : 'Stream error',
      })}\n\n`);
    }

    res.end();
  } catch (error) {
    // If headers not sent yet, handle as regular error
    if (!res.headersSent) {
      next(error);
    } else {
      // Send error through stream and end
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })}\n\n`);
      res.end();
    }
  }
}

/**
 * Get all conversations for the user
 * GET /api/chat/conversations
 */
export async function getConversations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const query = listConversationsQuerySchema.parse(req.query);

    const { limit = 20, offset = 0 } = query;

    const conversations = await listConversations(userId, { limit, offset });

    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          limit,
          offset,
          hasMore: conversations.length === limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific conversation with messages
 * GET /api/chat/conversations/:id
 */
export async function getConversationById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const conversationId = req.params.id as string;

    const conversation = await getConversation(userId, conversationId);

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update conversation title
 * PATCH /api/chat/conversations/:id
 */
export async function updateConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const conversationId = req.params.id as string;
    const body = updateTitleSchema.parse(req.body);

    const conversation = await updateConversationTitle(
      userId,
      conversationId,
      body.title
    );

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Conversation not found') {
      next(new NotFoundError('Conversation not found'));
    } else {
      next(error);
    }
  }
}

/**
 * Delete a conversation
 * DELETE /api/chat/conversations/:id
 */
export async function removeConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const conversationId = req.params.id as string;

    await deleteConversation(userId, conversationId);

    res.json({
      success: true,
      data: { deleted: conversationId },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Conversation not found') {
      next(new NotFoundError('Conversation not found'));
    } else {
      next(error);
    }
  }
}

/**
 * Generate a quick daily briefing
 * POST /api/chat/briefing
 */
export async function getDailyBriefing(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const briefing = await generateQuickBriefing(userId);

    res.json({
      success: true,
      data: {
        briefing,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export default {
  sendMessage,
  sendMessageStream,
  getConversations,
  getConversationById,
  updateConversation,
  removeConversation,
  getDailyBriefing,
};
