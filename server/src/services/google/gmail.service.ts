import { google, gmail_v1 } from 'googleapis';
import { Auth } from 'googleapis';
import { CachedEmail, Priority } from '@prisma/client';
import prisma from '../../config/database.js';
import { getAuthenticatedGoogleClient } from '../auth.service.js';

// =============================================================================
// Types
// =============================================================================

export interface EmailListOptions {
  maxResults?: number;
  query?: string;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

export interface EmailListResult {
  emails: CachedEmail[];
  nextPageToken: string | null;
  totalEstimate: number | null;
}

export interface EmailDetails {
  id: string;
  threadId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  recipients: string[];
  snippet: string;
  body: string | null;
  bodyType: string;
  labelIds: string[];
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  receivedAt: Date;
}

export interface EmailSyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create Gmail API client from OAuth2 client
 */
function createGmailClient(auth: Auth.OAuth2Client): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth });
}

/**
 * Extract email address from "Name <email@example.com>" format
 */
function extractEmailAddress(headerValue: string): { name: string; email: string } {
  const match = headerValue.match(/^(.+?)\s*<(.+?)>$/);
  if (match && match[1] && match[2]) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  // If no name, the whole string is the email
  return { name: '', email: headerValue.trim() };
}

/**
 * Get header value from message headers
 */
function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) return '';
  const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

/**
 * Extract body content from message payload
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { body: string | null; bodyType: string } {
  if (!payload) {
    return { body: null, bodyType: 'text/plain' };
  }

  // Check if this part has a body
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    return { body: decoded, bodyType: payload.mimeType || 'text/plain' };
  }

  // If this is a multipart message, look for text/plain or text/html
  if (payload.parts) {
    // Prefer HTML over plain text
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      const decoded = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
      return { body: decoded, bodyType: 'text/html' };
    }

    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      const decoded = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      return { body: decoded, bodyType: 'text/plain' };
    }

    // Check nested parts (for multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part);
        if (nested.body) {
          return nested;
        }
      }
    }
  }

  return { body: null, bodyType: 'text/plain' };
}

/**
 * Check if message has attachments
 */
function hasAttachments(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
  if (!payload) return false;

  if (payload.filename && payload.filename.length > 0) {
    return true;
  }

  if (payload.parts) {
    return payload.parts.some(part => hasAttachments(part));
  }

  return false;
}

/**
 * Parse Gmail message to EmailDetails
 */
function parseGmailMessage(message: gmail_v1.Schema$Message): EmailDetails {
  const headers = message.payload?.headers;
  const senderHeader = getHeader(headers, 'From');
  const { name: senderName, email: senderEmail } = extractEmailAddress(senderHeader);

  const toHeader = getHeader(headers, 'To');
  const recipients = toHeader
    .split(',')
    .map(r => extractEmailAddress(r.trim()).email)
    .filter(Boolean);

  const { body, bodyType } = extractBody(message.payload);
  const labelIds = message.labelIds || [];

  return {
    id: message.id || '',
    threadId: message.threadId || '',
    subject: getHeader(headers, 'Subject') || '(No Subject)',
    sender: senderName || senderEmail,
    senderEmail: senderEmail,
    recipients,
    snippet: message.snippet || '',
    body,
    bodyType,
    labelIds,
    isRead: !labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    hasAttachments: hasAttachments(message.payload),
    receivedAt: new Date(parseInt(message.internalDate || '0', 10)),
  };
}

// =============================================================================
// Gmail Service
// =============================================================================

/**
 * List emails from Gmail with caching
 */
export async function listEmails(
  userId: string,
  options: EmailListOptions = {}
): Promise<EmailListResult> {
  const {
    maxResults = 20,
    query,
    pageToken,
    labelIds = ['INBOX'],
    includeSpamTrash = false,
  } = options;

  const auth = await getAuthenticatedGoogleClient(userId);
  const gmail = createGmailClient(auth);

  // Build Gmail query
  let gmailQuery = query || '';

  // Fetch message list
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    pageToken: pageToken || undefined,
    labelIds,
    q: gmailQuery || undefined,
    includeSpamTrash,
  });

  const messages = listResponse.data.messages || [];
  const emails: CachedEmail[] = [];

  // Fetch full details for each message
  for (const msg of messages) {
    if (!msg.id) continue;

    // Check if we have a cached version
    let cachedEmail = await prisma.cachedEmail.findUnique({
      where: { gmailId: msg.id },
    });

    if (!cachedEmail) {
      // Fetch full message details
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const details = parseGmailMessage(fullMessage.data);

      // Cache the email
      cachedEmail = await prisma.cachedEmail.create({
        data: {
          userId,
          gmailId: details.id,
          threadId: details.threadId,
          subject: details.subject,
          sender: details.sender,
          senderEmail: details.senderEmail,
          recipients: details.recipients,
          snippet: details.snippet,
          body: details.body,
          bodyType: details.bodyType,
          labelIds: details.labelIds,
          isRead: details.isRead,
          isStarred: details.isStarred,
          hasAttachments: details.hasAttachments,
          receivedAt: details.receivedAt,
        },
      });
    }

    emails.push(cachedEmail);
  }

  return {
    emails,
    nextPageToken: listResponse.data.nextPageToken || null,
    totalEstimate: listResponse.data.resultSizeEstimate || null,
  };
}

/**
 * Get a single email by Gmail ID
 */
export async function getEmail(userId: string, gmailId: string): Promise<CachedEmail | null> {
  // Check cache first
  let cachedEmail = await prisma.cachedEmail.findUnique({
    where: { gmailId },
  });

  if (cachedEmail && cachedEmail.body) {
    // We have full details cached
    return cachedEmail;
  }

  // Fetch from Gmail API
  const auth = await getAuthenticatedGoogleClient(userId);
  const gmail = createGmailClient(auth);

  try {
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: gmailId,
      format: 'full',
    });

    const details = parseGmailMessage(message.data);

    // Upsert cache
    cachedEmail = await prisma.cachedEmail.upsert({
      where: { gmailId },
      update: {
        subject: details.subject,
        sender: details.sender,
        senderEmail: details.senderEmail,
        recipients: details.recipients,
        snippet: details.snippet,
        body: details.body,
        bodyType: details.bodyType,
        labelIds: details.labelIds,
        isRead: details.isRead,
        isStarred: details.isStarred,
        hasAttachments: details.hasAttachments,
        cachedAt: new Date(),
      },
      create: {
        userId,
        gmailId: details.id,
        threadId: details.threadId,
        subject: details.subject,
        sender: details.sender,
        senderEmail: details.senderEmail,
        recipients: details.recipients,
        snippet: details.snippet,
        body: details.body,
        bodyType: details.bodyType,
        labelIds: details.labelIds,
        isRead: details.isRead,
        isStarred: details.isStarred,
        hasAttachments: details.hasAttachments,
        receivedAt: details.receivedAt,
      },
    });

    return cachedEmail;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as { code?: number }).code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get emails by thread ID
 */
export async function getThread(userId: string, threadId: string): Promise<CachedEmail[]> {
  const auth = await getAuthenticatedGoogleClient(userId);
  const gmail = createGmailClient(auth);

  const threadResponse = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const messages = threadResponse.data.messages || [];
  const emails: CachedEmail[] = [];

  for (const message of messages) {
    const details = parseGmailMessage(message);

    // Upsert to cache
    const cachedEmail = await prisma.cachedEmail.upsert({
      where: { gmailId: details.id },
      update: {
        subject: details.subject,
        sender: details.sender,
        senderEmail: details.senderEmail,
        recipients: details.recipients,
        snippet: details.snippet,
        body: details.body,
        bodyType: details.bodyType,
        labelIds: details.labelIds,
        isRead: details.isRead,
        isStarred: details.isStarred,
        hasAttachments: details.hasAttachments,
        cachedAt: new Date(),
      },
      create: {
        userId,
        gmailId: details.id,
        threadId: details.threadId,
        subject: details.subject,
        sender: details.sender,
        senderEmail: details.senderEmail,
        recipients: details.recipients,
        snippet: details.snippet,
        body: details.body,
        bodyType: details.bodyType,
        labelIds: details.labelIds,
        isRead: details.isRead,
        isStarred: details.isStarred,
        hasAttachments: details.hasAttachments,
        receivedAt: details.receivedAt,
      },
    });

    emails.push(cachedEmail);
  }

  // Sort by received date (oldest first in thread)
  emails.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());

  return emails;
}

/**
 * Search emails with Gmail query syntax
 */
export async function searchEmails(
  userId: string,
  query: string,
  maxResults: number = 20
): Promise<CachedEmail[]> {
  const result = await listEmails(userId, {
    maxResults,
    query,
    labelIds: [], // Search all labels
  });

  return result.emails;
}

/**
 * Sync emails from Gmail to local cache
 * Fetches emails newer than the last cached email
 */
export async function syncEmails(userId: string, maxResults: number = 50): Promise<EmailSyncResult> {
  const result: EmailSyncResult = {
    synced: 0,
    created: 0,
    updated: 0,
    errors: [],
  };

  try {
    const auth = await getAuthenticatedGoogleClient(userId);
    const gmail = createGmailClient(auth);

    // Get the most recent cached email timestamp
    const latestCached = await prisma.cachedEmail.findFirst({
      where: { userId },
      orderBy: { receivedAt: 'desc' },
    });

    // Build query for recent emails
    let query = '';
    if (latestCached) {
      // Gmail uses seconds since epoch for 'after' query
      const afterTimestamp = Math.floor(latestCached.receivedAt.getTime() / 1000);
      query = `after:${afterTimestamp}`;
    }

    // Fetch message list
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds: ['INBOX'],
      q: query || undefined,
    });

    const messages = listResponse.data.messages || [];

    for (const msg of messages) {
      if (!msg.id) continue;

      try {
        // Check if we have this email
        const existing = await prisma.cachedEmail.findUnique({
          where: { gmailId: msg.id },
        });

        // Fetch full message
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const details = parseGmailMessage(fullMessage.data);

        if (existing) {
          // Update existing
          await prisma.cachedEmail.update({
            where: { gmailId: msg.id },
            data: {
              labelIds: details.labelIds,
              isRead: details.isRead,
              isStarred: details.isStarred,
              cachedAt: new Date(),
            },
          });
          result.updated++;
        } else {
          // Create new
          await prisma.cachedEmail.create({
            data: {
              userId,
              gmailId: details.id,
              threadId: details.threadId,
              subject: details.subject,
              sender: details.sender,
              senderEmail: details.senderEmail,
              recipients: details.recipients,
              snippet: details.snippet,
              body: details.body,
              bodyType: details.bodyType,
              labelIds: details.labelIds,
              isRead: details.isRead,
              isStarred: details.isStarred,
              hasAttachments: details.hasAttachments,
              receivedAt: details.receivedAt,
            },
          });
          result.created++;
        }

        result.synced++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to sync email ${msg.id}: ${errorMessage}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Sync failed: ${errorMessage}`);
  }

  return result;
}

/**
 * Get cached emails from database (without calling Gmail API)
 */
export async function getCachedEmails(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    priority?: Priority;
    unreadOnly?: boolean;
    orderBy?: 'receivedAt' | 'aiPriority';
    order?: 'asc' | 'desc';
  } = {}
): Promise<CachedEmail[]> {
  const {
    limit = 20,
    offset = 0,
    priority,
    unreadOnly,
    orderBy = 'receivedAt',
    order = 'desc',
  } = options;

  // Build where clause dynamically
  const where: {
    userId: string;
    aiPriority?: Priority;
    isRead?: boolean;
  } = {
    userId,
  };

  if (priority) {
    where.aiPriority = priority;
  }

  if (unreadOnly) {
    where.isRead = false;
  }

  return prisma.cachedEmail.findMany({
    where,
    orderBy: { [orderBy]: order },
    take: limit,
    skip: offset,
  });
}

/**
 * Update AI analysis for an email
 */
export async function updateEmailAnalysis(
  gmailId: string,
  analysis: {
    aiPriority?: Priority;
    aiSummary?: string;
    aiActionItems?: unknown[];
    aiCategories?: string[];
  }
): Promise<CachedEmail> {
  return prisma.cachedEmail.update({
    where: { gmailId },
    data: {
      aiPriority: analysis.aiPriority,
      aiSummary: analysis.aiSummary,
      aiActionItems: analysis.aiActionItems as Parameters<typeof prisma.cachedEmail.update>[0]['data']['aiActionItems'],
      aiCategories: analysis.aiCategories as Parameters<typeof prisma.cachedEmail.update>[0]['data']['aiCategories'],
      analyzedAt: new Date(),
    },
  });
}

/**
 * Get prioritized emails (emails with AI priority analysis)
 */
export async function getPrioritizedEmails(userId: string, limit: number = 20): Promise<CachedEmail[]> {
  // First, get emails with AI priority (sorted by priority: URGENT > HIGH > MEDIUM > LOW)
  const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  const analyzedEmails = await prisma.cachedEmail.findMany({
    where: {
      userId,
      aiPriority: { not: null },
    },
    take: limit,
  });

  // Sort by priority
  analyzedEmails.sort((a, b) => {
    const priorityA = a.aiPriority ? priorityOrder[a.aiPriority] : 999;
    const priorityB = b.aiPriority ? priorityOrder[b.aiPriority] : 999;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    // If same priority, sort by received date (newer first)
    return b.receivedAt.getTime() - a.receivedAt.getTime();
  });

  return analyzedEmails;
}

export default {
  listEmails,
  getEmail,
  getThread,
  searchEmails,
  syncEmails,
  getCachedEmails,
  updateEmailAnalysis,
  getPrioritizedEmails,
};
