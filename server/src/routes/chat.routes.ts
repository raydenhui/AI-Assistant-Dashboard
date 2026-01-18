/**
 * Chat Routes
 * API endpoints for AI chat conversations
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  sendMessage,
  sendMessageStream,
  getConversations,
  getConversationById,
  updateConversation,
  removeConversation,
  getDailyBriefing,
} from '../controllers/chat.controller';

const router = Router();

// All chat routes require authentication
router.use(requireAuth);

/**
 * @route   POST /api/chat/messages
 * @desc    Send a message and get AI response
 * @access  Private
 * @body    message - User message (required)
 * @body    conversationId - Existing conversation ID (optional, creates new if not provided)
 */
router.post('/messages', sendMessage);

/**
 * @route   POST /api/chat/messages/stream
 * @desc    Send a message and stream the AI response via SSE
 * @access  Private
 * @body    message - User message (required)
 * @body    conversationId - Existing conversation ID (optional)
 * @returns Server-Sent Events stream
 */
router.post('/messages/stream', sendMessageStream);

/**
 * @route   POST /api/chat/briefing
 * @desc    Generate a quick daily briefing
 * @access  Private
 */
router.post('/briefing', getDailyBriefing);

/**
 * @route   GET /api/chat/conversations
 * @desc    Get all conversations for the user
 * @access  Private
 * @query   limit - Number of conversations to return (default: 20, max: 100)
 * @query   offset - Offset for pagination (default: 0)
 */
router.get('/conversations', getConversations);

/**
 * @route   GET /api/chat/conversations/:id
 * @desc    Get a specific conversation with all messages
 * @access  Private
 */
router.get('/conversations/:id', getConversationById);

/**
 * @route   PATCH /api/chat/conversations/:id
 * @desc    Update conversation (title)
 * @access  Private
 * @body    title - New conversation title
 */
router.patch('/conversations/:id', updateConversation);

/**
 * @route   DELETE /api/chat/conversations/:id
 * @desc    Delete a conversation and all its messages
 * @access  Private
 */
router.delete('/conversations/:id', removeConversation);

export default router;
