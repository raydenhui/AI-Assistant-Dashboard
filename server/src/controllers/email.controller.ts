import { Request, Response } from 'express';
import { Priority, CachedEmail } from '@prisma/client';
import {
  listEmails,
  getEmail,
  getThread,
  searchEmails,
  syncEmails,
  getCachedEmails,
  getPrioritizedEmails,
} from '../services/google/gmail.service.js';
import { BadRequestError, NotFoundError } from '../middleware/error.middleware.js';

/**
 * GET /api/emails
 * List emails from Gmail with optional filtering
 */
export async function getEmails(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const {
    maxResults = '20',
    query,
    pageToken,
    labelIds,
    cached = 'false',
  } = req.query;

  // If requesting cached only, don't call Gmail API
  if (cached === 'true') {
    const priority = req.query.priority as Priority | undefined;
    const unreadOnly = req.query.unreadOnly === 'true';

    const emails = await getCachedEmails(req.userId, {
      limit: parseInt(maxResults as string, 10),
      priority,
      unreadOnly,
    });

    res.json({
      success: true,
      data: {
        emails: emails.map(e => formatEmailResponse(e)),
        nextPageToken: null,
        totalEstimate: emails.length,
      },
    });
    return;
  }

  // Parse labelIds if provided
  const labels = labelIds
    ? (typeof labelIds === 'string' ? labelIds.split(',') : labelIds as string[])
    : ['INBOX'];

  const result = await listEmails(req.userId, {
    maxResults: parseInt(maxResults as string, 10),
    query: query as string | undefined,
    pageToken: pageToken as string | undefined,
    labelIds: labels,
  });

  res.json({
    success: true,
    data: {
      emails: result.emails.map(e => formatEmailResponse(e)),
      nextPageToken: result.nextPageToken,
      totalEstimate: result.totalEstimate,
    },
  });
}

/**
 * GET /api/emails/prioritized
 * Get emails sorted by AI analysis priority
 */
export async function getPrioritizedEmailList(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { limit = '20' } = req.query;

  const emails = await getPrioritizedEmails(
    req.userId,
    parseInt(limit as string, 10)
  );

  res.json({
    success: true,
    data: {
      emails: emails.map(e => formatEmailResponse(e)),
    },
  });
}

/**
 * GET /api/emails/:id
 * Get a single email by Gmail ID
 */
export async function getEmailById(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    throw new BadRequestError('Email ID is required');
  }

  const email = await getEmail(req.userId, id);

  if (!email) {
    throw new NotFoundError('Email not found');
  }

  res.json({
    success: true,
    data: formatEmailResponse(email, true), // Include full body
  });
}

/**
 * GET /api/emails/thread/:threadId
 * Get all emails in a thread
 */
export async function getEmailThread(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { threadId } = req.params;

  if (!threadId || typeof threadId !== 'string') {
    throw new BadRequestError('Thread ID is required');
  }

  const emails = await getThread(req.userId, threadId);

  res.json({
    success: true,
    data: {
      threadId,
      emails: emails.map(e => formatEmailResponse(e, true)),
      messageCount: emails.length,
    },
  });
}

/**
 * GET /api/emails/search
 * Search emails using Gmail query syntax
 */
export async function searchEmailsByQuery(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { q, maxResults = '20' } = req.query;

  if (!q || typeof q !== 'string') {
    throw new BadRequestError('Search query (q) is required');
  }

  const emails = await searchEmails(
    req.userId,
    q,
    parseInt(maxResults as string, 10)
  );

  res.json({
    success: true,
    data: {
      query: q,
      emails: emails.map(e => formatEmailResponse(e)),
      resultCount: emails.length,
    },
  });
}

/**
 * POST /api/emails/sync
 * Sync emails from Gmail to local cache
 */
export async function syncEmailsFromGmail(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { maxResults = 50 } = req.body;

  const result = await syncEmails(req.userId, maxResults);

  res.json({
    success: true,
    data: {
      synced: result.synced,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
    },
  });
}

/**
 * Format cached email for API response
 *
 * Note: The frontend expects `sender` as a string and `aiAnalysis` for AI data.
 * We format the sender as "Name <email>" or just email if name is not available.
 */
function formatEmailResponse(
  email: CachedEmail,
  includeBody: boolean = false
): Record<string, unknown> {
  // Format sender as string: "Name <email>" or just email
  const senderString = email.sender && email.sender !== email.senderEmail
    ? `${email.sender} <${email.senderEmail}>`
    : email.senderEmail || email.sender;

  const response: Record<string, unknown> = {
    id: email.gmailId,
    gmailId: email.gmailId,
    threadId: email.threadId,
    subject: email.subject,
    sender: senderString,
    senderDetails: {
      name: email.sender,
      email: email.senderEmail,
    },
    recipients: email.recipients,
    snippet: email.snippet,
    labels: email.labelIds,
    isRead: email.isRead,
    isStarred: email.isStarred,
    hasAttachments: email.hasAttachments,
    receivedAt: email.receivedAt.toISOString(),
    cachedAt: email.cachedAt.toISOString(),
  };

  // Include body if requested (for single email view)
  if (includeBody && email.body) {
    response.body = email.body;
    response.bodyType = email.bodyType;
  }

  // Include AI analysis if available - use `aiAnalysis` to match frontend type
  if (email.aiPriority || email.aiSummary || email.aiActionItems) {
    // Cast aiCategories to array if it exists
    const categories = Array.isArray(email.aiCategories) ? email.aiCategories as string[] : null;
    
    response.aiAnalysis = {
      priority: email.aiPriority,
      summary: email.aiSummary,
      actionItems: email.aiActionItems,
      category: categories?.[0] || null,
      categories: categories,
      analyzedAt: email.analyzedAt?.toISOString(),
    };
  }

  return response;
}

export default {
  getEmails,
  getPrioritizedEmailList,
  getEmailById,
  getEmailThread,
  searchEmailsByQuery,
  syncEmailsFromGmail,
};
