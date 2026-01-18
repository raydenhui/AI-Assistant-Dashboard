import { Router } from 'express';
import {
  getEmails,
  getPrioritizedEmailList,
  getEmailById,
  getEmailThread,
  searchEmailsByQuery,
  syncEmailsFromGmail,
} from '../controllers/email.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = Router();

// =============================================================================
// All email routes require authentication
// =============================================================================

/**
 * @route   GET /api/emails
 * @desc    List emails from Gmail with optional filtering
 * @access  Private
 * @query   maxResults, query, pageToken, labelIds, cached, priority, unreadOnly
 */
router.get('/', requireAuth, asyncHandler(getEmails));

/**
 * @route   GET /api/emails/prioritized
 * @desc    Get emails sorted by AI priority analysis
 * @access  Private
 * @query   limit
 */
router.get('/prioritized', requireAuth, asyncHandler(getPrioritizedEmailList));

/**
 * @route   GET /api/emails/search
 * @desc    Search emails using Gmail query syntax
 * @access  Private
 * @query   q (required), maxResults
 */
router.get('/search', requireAuth, asyncHandler(searchEmailsByQuery));

/**
 * @route   GET /api/emails/thread/:threadId
 * @desc    Get all emails in a thread
 * @access  Private
 */
router.get('/thread/:threadId', requireAuth, asyncHandler(getEmailThread));

/**
 * @route   POST /api/emails/sync
 * @desc    Sync emails from Gmail to local cache
 * @access  Private
 * @body    { maxResults }
 */
router.post('/sync', requireAuth, asyncHandler(syncEmailsFromGmail));

/**
 * @route   GET /api/emails/:id
 * @desc    Get a single email by Gmail ID
 * @access  Private
 */
router.get('/:id', requireAuth, asyncHandler(getEmailById));

export default router;
