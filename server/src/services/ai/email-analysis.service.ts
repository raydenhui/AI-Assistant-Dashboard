import { Priority, CachedEmail } from '@prisma/client';
import prisma from '../../config/database.js';
import { llmService } from '../llm/index.js';
import { EMAIL_PRIORITY_PROMPT } from './prompts.js';
import * as gmailService from '../google/gmail.service.js';

/**
 * Email Analysis Service
 * Handles automated prioritization and summarization of emails
 */
export class EmailAnalysisService {
  /**
   * Analyze a batch of emails
   */
  static async analyzeEmails(userId: string, emails: CachedEmail[]): Promise<void> {
    if (emails.length === 0) return;

    // Analyze in small batches so large syncs (many emails) don't produce an
    // oversized LLM response that gets truncated/invalid JSON and leaves every
    // email without a priority. Small batches reliably return complete JSON.
    // The newest email is always in the first batch (caller sorts newest-first).
    const BATCH_SIZE = 10;
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      // Await each batch sequentially so the LLM is not overwhelmed and the
      // results are persisted incrementally (visible in UI after each batch).
      await this.analyzeBatch(userId, batch);
    }
  }

  /**
   * Analyze a single small batch of emails and persist results
   */
  private static async analyzeBatch(userId: string, emails: CachedEmail[]): Promise<void> {
    if (emails.length === 0) return;

    // Get user for timezone
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const userTimezone = user?.timezone || 'UTC';

    const emailData = emails.map(e => ({
      id: e.gmailId,
      subject: e.subject,
      sender: e.sender,
      senderEmail: e.senderEmail,
      snippet: e.snippet,
      body: e.body?.substring(0, 2000), // Limit body size for LLM
      receivedAt: e.receivedAt,
    }));

    const currentTimeUTC = new Date().toISOString();
    const currentTimeLocal = new Date().toLocaleString('en-US', { timeZone: userTimezone });
    
    const prompt = `IMPORTANT:
- Current System Time (UTC): ${currentTimeUTC}
- User Local Time: ${currentTimeLocal}
- User Timezone: ${userTimezone}

Use the User Local Time and Timezone to judge the urgency of emails (e.g., "today", "tomorrow", "8:00pm") and to set accurate due dates for action items.
For due dates, use the exact time from the email content as-is. Do NOT convert or adjust the timezone — just output the date/time exactly as it appears in the email in ISO 8601 format.

${EMAIL_PRIORITY_PROMPT}

Emails to analyze:
${JSON.stringify(emailData, null, 2)}`;

    try {
      console.log(`[EmailAnalysisService] Analyzing ${emails.length} emails for user ${userId}`);
      const response = await llmService.chat(userId, {
        messages: [
          { role: 'system', content: 'You are a helpful assistant that analyzes emails. You MUST return a JSON object with a "results" array containing one entry per email.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.content;
      if (!content) {
        console.warn('[EmailAnalysisService] Empty response from LLM');
        return;
      }

      console.log(`[EmailAnalysisService] LLM Response: ${content}`);

      let results = [];
      try {
        const analysisResults = JSON.parse(content);
        if (analysisResults.results) {
          results = analysisResults.results;
        } else if (Array.isArray(analysisResults)) {
          results = analysisResults;
        } else if (analysisResults.id && analysisResults.priority) {
          // Single object case
          results = [analysisResults];
        }
      } catch (e) {
        console.error('[EmailAnalysisService] Failed to parse LLM response as JSON:', e);
        return;
      }

      console.log(`[EmailAnalysisService] Found ${results.length} analysis results for ${emails.length} emails`);

      // Track which of the analyzed emails the LLM actually returned a result
      // for so we can detect any that were dropped from a truncated response.
      const processedIds = new Set<string>();

      for (const result of results) {
        if (!result.id || !result.priority) continue;
        processedIds.add(result.id);

        const priority = this.mapPriority(result.priority);
        console.log(`[EmailAnalysisService] Updating email ${result.id} with priority ${priority} (${result.priority})`);

        await gmailService.updateEmailAnalysis(result.id, {
          aiPriority: priority,
          aiSummary: result.summary || 'No summary provided',
          aiCategories: [result.priority], // Store the original tier name in categories
          aiActionItems: result.actionItems || [],
        });

        // Create tasks for action items only for prioritized emails
        if (priority !== Priority.LOW && result.actionItems && Array.isArray(result.actionItems)) {
          for (const item of result.actionItems) {
            // Check if task already exists for this email and title
            const existingTask = await prisma.task.findFirst({
              where: {
                userId,
                sourceId: result.id,
                title: item.title,
              },
            });

            if (!existingTask) {
              await prisma.task.create({
                data: {
                  userId,
                  title: item.title,
                  description: item.description,
                  dueDate: item.dueDate ? new Date(item.dueDate) : null,
                  priority: this.mapTaskPriority(item.priority),
                  source: 'email',
                  sourceId: result.id,
                  status: 'PENDING',
                },
              });
              console.log(`[EmailAnalysisService] Created task: ${item.title} for email ${result.id}`);
            }
          }
        }
      }

      // Fallback: any email the LLM did not return a result for gets marked as
      // LOW so it does not stay stuck in the "un-analyzed" (aiPriority=null)
      // state forever and get silently skipped by the prioritized inbox.
      const unprocessed = emails.filter(e => !processedIds.has(e.gmailId));
      if (unprocessed.length > 0) {
        console.warn(`[EmailAnalysisService] LLM returned no result for ${unprocessed.length} email(s); marking as LOW: ${unprocessed.map(e => e.gmailId).join(', ')}`);
        for (const e of unprocessed) {
          await gmailService.updateEmailAnalysis(e.gmailId, {
            aiPriority: Priority.LOW,
            aiSummary: e.snippet?.substring(0, 100) || 'No summary available',
            aiCategories: ['unrelevent'],
            aiActionItems: [],
          });
        }
      }
    } catch (error) {
      console.error('[EmailAnalysisService] Error analyzing emails:', error);
    }
  }

  /**
   * Map string priority to Prisma Priority enum
   */
  private static mapPriority(priority: string): Priority {
    const p = priority.toLowerCase();
    if (p === 'urgent') return Priority.URGENT;
    if (p === 'important' || p === 'high') return Priority.HIGH;
    if (p === 'normal' || p === 'medium') return Priority.MEDIUM;
    if (p === 'unrelevent' || p === 'low') return Priority.LOW;
    return Priority.LOW;
  }

  /**
   * Map string priority to Prisma Priority enum for Tasks
   */
  private static mapTaskPriority(priority: string): Priority {
    const p = priority?.toLowerCase();
    if (p === 'high') return Priority.HIGH;
    if (p === 'medium') return Priority.MEDIUM;
    if (p === 'low') return Priority.LOW;
    return Priority.MEDIUM;
  }

  /**
   * Run periodic re-evaluation of prioritized emails
   * Checks emails analyzed more than 12 hours ago
   */
  static async reevaluatePriorities(userId: string): Promise<void> {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const emailsToReevaluate = await prisma.cachedEmail.findMany({
      where: {
        userId,
        aiPriority: { not: Priority.LOW }, // Only re-evaluate those in prioritized inbox
        analyzedAt: { lt: twelveHoursAgo },
      },
      take: 10, // Process in small batches
    });

    if (emailsToReevaluate.length === 0) return;

    console.log(`Re-evaluating ${emailsToReevaluate.length} emails for user ${userId}`);
    
    // Get user for timezone
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const userTimezone = user?.timezone || 'UTC';

    const emailData = emailsToReevaluate.map(e => ({
      id: e.gmailId,
      subject: e.subject,
      sender: e.sender,
      snippet: e.snippet,
      currentPriority: e.aiPriority,
      analyzedAt: e.analyzedAt,
    }));

    const currentTimeUTC = new Date().toISOString();
    const currentTimeLocal = new Date().toLocaleString('en-US', { timeZone: userTimezone });

    const prompt = `IMPORTANT:
- Current System Time (UTC): ${currentTimeUTC}
- User Local Time: ${currentTimeLocal}
- User Timezone: ${userTimezone}

Check if these emails still need user response or if their priority has changed based on the current time.
For due dates, use the exact time from the email content as-is. Do NOT convert or adjust the timezone — just output the date/time exactly as it appears in the email in ISO 8601 format.

Guidelines:
${EMAIL_PRIORITY_PROMPT}

Emails:
${JSON.stringify(emailData, null, 2)}`;

    try {
      const response = await llmService.chat(userId, {
        messages: [
          { role: 'system', content: 'You are a helpful assistant that re-evaluates email priorities.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.content;
      if (!content) return;

      let results = [];
      try {
        const analysisResults = JSON.parse(content);
        if (analysisResults.results) {
          results = analysisResults.results;
        } else if (Array.isArray(analysisResults)) {
          results = analysisResults;
        } else if (analysisResults.id && analysisResults.priority) {
          results = [analysisResults];
        }
      } catch (e) {
        console.error('[EmailAnalysisService] Failed to parse re-evaluation response:', e);
        return;
      }

      for (const result of results) {
        if (!result.id || !result.priority) continue;
        const priority = this.mapPriority(result.priority);
        
        await gmailService.updateEmailAnalysis(result.id, {
          aiPriority: priority,
          aiSummary: result.summary || 'No summary provided',
          aiCategories: [result.priority],
          aiActionItems: result.actionItems || [],
        });

        // Create tasks for action items only for prioritized emails
        if (priority !== Priority.LOW && result.actionItems && Array.isArray(result.actionItems)) {
          for (const item of result.actionItems) {
            const existingTask = await prisma.task.findFirst({
              where: {
                userId,
                sourceId: result.id,
                title: item.title,
              },
            });

            if (!existingTask) {
              await prisma.task.create({
                data: {
                  userId,
                  title: item.title,
                  description: item.description,
                  dueDate: item.dueDate ? new Date(item.dueDate) : null,
                  priority: this.mapTaskPriority(item.priority),
                  source: 'email',
                  sourceId: result.id,
                  status: 'PENDING',
                },
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error re-evaluating emails:', error);
    }
  }
}
