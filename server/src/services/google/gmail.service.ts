import { google, gmail_v1 } from 'googleapis';
import { Auth } from 'googleapis';
import { CachedEmail, Priority } from '@prisma/client';
import { EmailAnalysisService } from '../ai/email-analysis.service.js';
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

    // Build query for recent emails.
    // Gmail returns messages newest-first. On the first sync for an account
    // with a large mailbox we must NOT page through the entire history — we
    // only fetch the most recent `maxResults` messages (the first page),
    // which always includes the absolute newest email.
    //
    // On subsequent syncs, we use `after:<last received>` so Gmail only
    // returns messages newer than what we've already seen. Because Gmail
    // returns newest-first, the very first item is the newest email in the
    // mailbox, guaranteeing the newest one is always processed.
    let query = '';
    if (latestCached) {
      // Gmail uses seconds since epoch for 'after' query.
      // Subtract 2 minutes as a safety buffer to avoid missing emails that
      // arrived concurrently with the last sync.
      const afterTimestamp = Math.floor(latestCached.receivedAt.getTime() / 1000) - 120;
      query = `after:${afterTimestamp}`;
    }

    // Fetch message list (Gmail returns newest first). We intentionally do NOT
    // use pageToken here — we only ever want the newest page of results.
    // We also request `internalDate` so we can explicitly sort by receive time
    // and guarantee the absolute newest message is processed first, regardless
    // of Gmail's implicit ordering on very large mailboxes.
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds: ['INBOX'],
      q: query || undefined,
    });

    const messages = listResponse.data.messages || [];

    // Fetch internalDate for each message so we can sort newest-first.
    // This guarantees that on a huge mailbox the absolute newest email is
    // always processed (cached + analyzed) rather than an arbitrary page.
    const messagesWithDate = await Promise.all(
      messages
        .filter((msg): msg is gmail_v1.Schema$Message & { id: string } => !!msg.id)
        .map(async (msg) => {
          try {
            const meta = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'metadata',
              metadataHeaders: [],
            });
            return {
              id: msg.id,
              internalDate: parseInt(meta.data.internalDate || '0', 10),
            };
          } catch {
            return { id: msg.id, internalDate: 0 };
          }
        })
    );

    // Sort newest first
    messagesWithDate.sort((a, b) => b.internalDate - a.internalDate);

    const newEmails: CachedEmail[] = [];

    for (const { id: messageId } of messagesWithDate) {
      try {
        // Check if we have this email
        const existing = await prisma.cachedEmail.findUnique({
          where: { gmailId: messageId },
        });

        // Fetch full message
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });

        const details = parseGmailMessage(fullMessage.data);

        if (existing) {
          // Update existing
          await prisma.cachedEmail.update({
            where: { gmailId: messageId },
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
          const newEmail = await prisma.cachedEmail.create({
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
          newEmails.push(newEmail);
          result.created++;
        }

        result.synced++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to sync email ${messageId}: ${errorMessage}`);
      }
    }

    // Analyze the emails we just synced, PLUS any backlog of un-analyzed
    // emails, always newest-first. The just-synced emails are analyzed first
    // so the absolute newest email is always prioritized immediately; any
    // remaining capacity is used to chip away at older un-analyzed emails.
    const syncedGmailIds = messagesWithDate.map(m => m.id);

    const freshlySynced = syncedGmailIds.length > 0
      ? await prisma.cachedEmail.findMany({
          where: { userId, gmailId: { in: syncedGmailIds }, aiPriority: null },
          orderBy: { receivedAt: 'desc' },
        })
      : [];

    // Backfill: older un-analyzed emails not part of this sync (newest first),
    // excluding the ones we're already analyzing above.
    const ANALYZE_BATCH_SIZE = 20;
    const remaining = ANALYZE_BATCH_SIZE - freshlySynced.length;
    const backlog = remaining > 0
      ? await prisma.cachedEmail.findMany({
          where: {
            userId,
            aiPriority: null,
            gmailId: { notIn: freshlySynced.map(e => e.gmailId) },
          },
          orderBy: { receivedAt: 'desc' },
          take: remaining,
        })
      : [];

    const emailsToAnalyze = [...freshlySynced, ...backlog];
    if (emailsToAnalyze.length > 0) {
      await EmailAnalysisService.analyzeEmails(userId, emailsToAnalyze);
    }

    // Also trigger re-evaluation of old emails
    await EmailAnalysisService.reevaluatePriorities(userId);

    // Enforce 30-email limit
    const emailCount = await prisma.cachedEmail.count({ where: { userId } });
    if (emailCount > 30) {
      const emailsToDelete = await prisma.cachedEmail.findMany({
        where: { userId },
        orderBy: { receivedAt: 'desc' },
        skip: 30,
        select: { id: true },
      });

      if (emailsToDelete.length > 0) {
        await prisma.cachedEmail.deleteMany({
          where: {
            id: { in: emailsToDelete.map(e => e.id) },
          },
        });
        console.log(`[GmailService] Deleted ${emailsToDelete.length} old emails to maintain 30-email limit`);
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
      aiPriority: {
        not: null,
        notIn: [Priority.LOW] // Filter out unrelevent emails
      },
      isDismissed: false, // Filter out dismissed emails
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
