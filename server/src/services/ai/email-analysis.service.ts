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

    const emailData = emails.map(e => ({
      id: e.gmailId,
      subject: e.subject,
      sender: e.sender,
      senderEmail: e.senderEmail,
      snippet: e.snippet,
      body: e.body?.substring(0, 2000), // Limit body size for LLM
      receivedAt: e.receivedAt,
    }));

    const currentTime = new Date().toISOString();
    const prompt = `Current System Time: ${currentTime}\n\n${EMAIL_PRIORITY_PROMPT}\n\nEmails to analyze:\n${JSON.stringify(emailData, null, 2)}`;

    try {
      console.log(`[EmailAnalysisService] Analyzing ${emails.length} emails for user ${userId}`);
      const response = await llmService.chat(userId, {
        messages: [
          { role: 'system', content: 'You are a helpful assistant that analyzes emails. You MUST return a JSON object with a "results" array.' },
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
        // Fallback: try to extract something if it's not perfect JSON
        return;
      }

      console.log(`[EmailAnalysisService] Found ${results.length} analysis results`);

      for (const result of results) {
        if (!result.id || !result.priority) continue;

        const priority = this.mapPriority(result.priority);
        console.log(`[EmailAnalysisService] Updating email ${result.id} with priority ${priority} (${result.priority})`);
        
        await gmailService.updateEmailAnalysis(result.id, {
          aiPriority: priority,
          aiSummary: result.summary || 'No summary provided',
          aiCategories: [result.priority], // Store the original tier name in categories
          aiActionItems: result.actionItems || [],
        });

        // Create tasks for action items
        if (result.actionItems && Array.isArray(result.actionItems)) {
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
    
    const emailData = emailsToReevaluate.map(e => ({
      id: e.gmailId,
      subject: e.subject,
      sender: e.sender,
      snippet: e.snippet,
      currentPriority: e.aiPriority,
      analyzedAt: e.analyzedAt,
    }));

    const currentTime = new Date().toISOString();
    const prompt = `Current System Time: ${currentTime}\n\nCheck if these emails still need user response or if their priority has changed based on the current time. Guidelines:\n${EMAIL_PRIORITY_PROMPT}\n\nEmails:\n${JSON.stringify(emailData, null, 2)}`;

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

        // Create tasks for action items
        if (result.actionItems && Array.isArray(result.actionItems)) {
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
