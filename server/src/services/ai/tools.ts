/**
 * AI Tools Definitions and Handlers
 * Defines all function-calling tools available to the AI agent
 */

import type { Tool } from '../llm/llm.types';
import { prisma } from '../../config/database';
import * as gmail from '../google/gmail.service';
import * as calendar from '../google/calendar.service';
import { parseInTimezone } from '../../utils/timezone';
import type { User, Priority, TaskStatus, CachedEmail, CachedEvent } from '@prisma/client';

/**
 * Tool execution context passed to tool handlers
 */
export interface ToolContext {
  user: User;
}

/**
 * Result from executing a tool
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Tool handler function type
 */
type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>;

/**
 * Helper to map lowercase priority to Prisma enum
 */
function mapPriority(priority: string | undefined): Priority {
  const mapping: Record<string, Priority> = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
    urgent: 'URGENT',
  };
  return mapping[priority?.toLowerCase() || 'medium'] || 'MEDIUM';
}

/**
 * Helper to map lowercase status to Prisma enum
 */
function mapTaskStatus(status: string | undefined): TaskStatus {
  const mapping: Record<string, TaskStatus> = {
    pending: 'PENDING',
    in_progress: 'IN_PROGRESS',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
  };
  return mapping[status?.toLowerCase() || 'pending'] || 'PENDING';
}

/**
 * All available AI tools definitions for function calling
 */
export const AI_TOOLS: Tool[] = [
  // ==================== Email Tools ====================
  {
    type: 'function',
    function: {
      name: 'get_emails',
      description: 'Fetch recent emails from Gmail with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          maxResults: {
            type: 'number',
            description: 'Maximum number of emails to fetch (default: 20)',
          },
          query: {
            type: 'string',
            description: 'Gmail search query (e.g., "from:boss@company.com", "is:unread")',
          },
          includeThreads: {
            type: 'boolean',
            description: 'Include full thread context for each email',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_email_details',
      description: 'Get full details of a specific email including body content',
      parameters: {
        type: 'object',
        properties: {
          emailId: {
            type: 'string',
            description: 'Gmail message ID',
          },
        },
        required: ['emailId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_email_priority',
      description: 'Analyze emails and assign priority levels based on urgency and importance',
      parameters: {
        type: 'object',
        properties: {
          emailIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email IDs to analyze. If empty, analyzes recent emails.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_action_items',
      description: 'Extract action items and tasks from emails or text',
      parameters: {
        type: 'object',
        properties: {
          emailIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email IDs to extract actions from',
          },
          text: {
            type: 'string',
            description: 'Or provide raw text to analyze for action items',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_email_reply',
      description: 'Draft a reply to an email based on context and user intent',
      parameters: {
        type: 'object',
        properties: {
          emailId: {
            type: 'string',
            description: 'Email ID to reply to',
          },
          intent: {
            type: 'string',
            description: 'What the user wants to convey in the reply',
          },
          tone: {
            type: 'string',
            enum: ['formal', 'casual', 'friendly'],
            description: 'Desired tone (default: formal)',
          },
        },
        required: ['emailId', 'intent'],
      },
    },
  },

  // ==================== Calendar Tools ====================
  {
    type: 'function',
    function: {
      name: 'get_calendar_events',
      description: 'Fetch upcoming calendar events',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Number of days to look ahead (default: 7)',
          },
          includeDeclined: {
            type: 'boolean',
            description: 'Include declined events (default: false)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_event_details',
      description: 'Get full details of a calendar event',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'Calendar event ID',
          },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Create a new calendar event',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Event title',
          },
          description: {
            type: 'string',
            description: 'Event description',
          },
          startTime: {
            type: 'string',
            description: 'Event start time. Provide the user\'s local wall-clock time in ISO 8601 format without a timezone suffix (e.g., "2026-07-24T14:00:00"); the server interprets it in the user\'s timezone. You may also pass a full ISO string with an explicit offset.',
          },
          endTime: {
            type: 'string',
            description: 'Event end time. Provide the user\'s local wall-clock time in ISO 8601 format without a timezone suffix (e.g., "2026-07-24T15:00:00"); the server interprets it in the user\'s timezone. You may also pass a full ISO string with an explicit offset.',
          },
          location: {
            type: 'string',
            description: 'Event location',
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email addresses of attendees',
          },
        },
        required: ['title', 'startTime', 'endTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_calendar_conflicts',
      description: 'Check for scheduling conflicts in a time range',
      parameters: {
        type: 'object',
        properties: {
          startTime: {
            type: 'string',
            description: 'Start of range. Provide the user\'s local wall-clock time in ISO 8601 format without a timezone suffix (e.g., "2026-07-24T14:00:00"); the server interprets it in the user\'s timezone.',
          },
          endTime: {
            type: 'string',
            description: 'End of range. Provide the user\'s local wall-clock time in ISO 8601 format without a timezone suffix (e.g., "2026-07-24T15:00:00"); the server interprets it in the user\'s timezone.',
          },
        },
        required: ['startTime', 'endTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_focus_time',
      description: 'Analyze calendar and suggest optimal focus time blocks',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Days to analyze (default: 5)',
          },
          minBlockMinutes: {
            type: 'number',
            description: 'Minimum focus block duration in minutes (default: 60)',
          },
        },
      },
    },
  },

  // ==================== Task Tools ====================
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: 'Get user tasks with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['all', 'pending', 'in_progress', 'completed'],
            description: 'Filter by task status (default: all)',
          },
          priority: {
            type: 'string',
            enum: ['all', 'low', 'medium', 'high'],
            description: 'Filter by priority level (default: all)',
          },
          dueBefore: {
            type: 'string',
            description: 'Filter tasks due before this date. Provide the user\'s local wall-clock time in ISO 8601 format without a timezone suffix; the server interprets it in the user\'s timezone.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task or action item',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Task title (clear, actionable)',
          },
          description: {
            type: 'string',
            description: 'Detailed task description',
          },
          dueDate: {
            type: 'string',
            description: 'Due date. Provide the user\'s local wall-clock time in ISO 8601 format without a timezone suffix (e.g., "2026-07-25T09:00:00"); the server interprets it in the user\'s timezone.',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Task priority (default: medium)',
          },
          source: {
            type: 'string',
            description: 'Source of the task (e.g., email ID, meeting)',
          },
          sourceId: {
            type: 'string',
            description: 'ID of the source (email ID, event ID)',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update an existing task',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to update',
          },
          title: {
            type: 'string',
            description: 'New task title',
          },
          description: {
            type: 'string',
            description: 'New description',
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed'],
            description: 'New status',
          },
          dueDate: {
            type: 'string',
            description: 'New due date. Provide the user\'s local wall-clock time in ISO 8601 format without a timezone suffix; the server interprets it in the user\'s timezone.',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'New priority level',
          },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to delete',
          },
        },
        required: ['taskId'],
      },
    },
  },

  // ==================== Analysis Tools ====================
  {
    type: 'function',
    function: {
      name: 'generate_daily_briefing',
      description: 'Generate a comprehensive daily briefing with priorities, schedule, and action items',
      parameters: {
        type: 'object',
        properties: {
          includeEmailSummary: {
            type: 'boolean',
            description: 'Include email summary (default: true)',
          },
          includeCalendar: {
            type: 'boolean',
            description: 'Include calendar events (default: true)',
          },
          includeTasks: {
            type: 'boolean',
            description: 'Include pending tasks (default: true)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_meeting_brief',
      description: 'Generate preparation notes for an upcoming meeting',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'Calendar event ID',
          },
        },
        required: ['eventId'],
      },
    },
  },
];

/**
 * Tool handlers map - executes the actual tool logic
 */
export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  // ==================== Email Handlers ====================
  async get_emails(args, context): Promise<ToolResult> {
    try {
      const maxResults = (args.maxResults as number) || 20;
      const query = args.query as string | undefined;
      
      let emails: CachedEmail[];
      if (query) {
        emails = await gmail.searchEmails(
          context.user.id,
          query,
          maxResults
        );
      } else {
        const result = await gmail.listEmails(context.user.id, {
          maxResults,
        });
        emails = result.emails;
      }
      
      // Return only essential fields to save tokens
      const conciseEmails = emails.map(e => ({
        id: e.gmailId,
        subject: e.subject,
        sender: e.sender,
        receivedAt: e.receivedAt,
        snippet: e.snippet,
        isRead: e.isRead,
      }));
      
      return { success: true, data: conciseEmails };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch emails: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async get_email_details(args, context): Promise<ToolResult> {
    try {
      const emailId = args.emailId as string;
      if (!emailId) {
        return { success: false, error: 'Email ID is required' };
      }
      
      const email = await gmail.getEmail(context.user.id, emailId);
      if (!email) {
        return { success: false, error: 'Email not found' };
      }
      return { success: true, data: email };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get email details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async analyze_email_priority(args, context): Promise<ToolResult> {
    try {
      const emailIds = args.emailIds as string[] | undefined;
      
      let emails: CachedEmail[];
      if (emailIds && emailIds.length > 0) {
        // Fetch specific emails
        const results = await Promise.all(
          emailIds.map(id => gmail.getEmail(context.user.id, id))
        );
        emails = results.filter((e): e is CachedEmail => e !== null);
      } else {
        // Fetch recent emails for analysis
        const result = await gmail.listEmails(context.user.id, {
          maxResults: 20,
        });
        emails = result.emails;
      }
      
      // Return emails for LLM to analyze with the priority prompt
      return {
        success: true,
        data: {
          emailsToAnalyze: emails.map(e => ({
            id: e.gmailId,
            subject: e.subject,
            sender: e.sender,
            senderEmail: e.senderEmail,
            snippet: e.snippet,
            body: e.body ? e.body.substring(0, 2000) : undefined, // Limit body length
            receivedAt: e.receivedAt,
            isRead: e.isRead,
          })),
          instruction: 'Analyze these emails and assign priority levels (high/medium/low) based on urgency, sender importance, and action required.',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch emails for analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async extract_action_items(args, context): Promise<ToolResult> {
    try {
      const emailIds = args.emailIds as string[] | undefined;
      const text = args.text as string | undefined;
      
      const content: string[] = [];
      
      if (emailIds && emailIds.length > 0) {
        const results = await Promise.all(
          emailIds.map(id => gmail.getEmail(context.user.id, id))
        );
        const emails = results.filter((e): e is CachedEmail => e !== null);
        emails.forEach((e) => {
          const body = e.body ? e.body.substring(0, 2000) : e.snippet;
          content.push(`From: ${e.sender}\nSubject: ${e.subject}\n\n${body}`);
        });
      }
      
      if (text) {
        content.push(text);
      }
      
      return {
        success: true,
        data: {
          contentToAnalyze: content.join('\n\n---\n\n'),
          instruction: 'Extract clear, actionable tasks from this content. Include title, description, suggested due date, and priority.',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to extract action items: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async draft_email_reply(args, context): Promise<ToolResult> {
    try {
      const emailId = args.emailId as string;
      const intent = args.intent as string;
      const tone = (args.tone as string) || 'formal';
      
      const email = await gmail.getEmail(context.user.id, emailId);
      if (!email) {
        return { success: false, error: 'Email not found' };
      }
      
      return {
        success: true,
        data: {
          originalEmail: {
            subject: email.subject,
            sender: email.sender,
            senderEmail: email.senderEmail,
            body: email.body ? email.body.substring(0, 3000) : email.snippet,
            receivedAt: email.receivedAt,
          },
          userIntent: intent,
          desiredTone: tone,
          instruction: `Draft a ${tone} reply to this email that conveys: ${intent}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to prepare email reply: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  // ==================== Calendar Handlers ====================
  async get_calendar_events(args, context): Promise<ToolResult> {
    try {
      const days = (args.days as number) || 7;
      
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + days);
      
      const result = await calendar.listEvents(context.user.id, {
        timeMin: now,
        timeMax: endDate,
      });
      
      // Return only essential fields to save tokens
      const conciseEvents = result.events.map(e => ({
        id: e.calendarId,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        status: e.status,
      }));
      
      return { success: true, data: conciseEvents };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async get_event_details(args, context): Promise<ToolResult> {
    try {
      const eventId = args.eventId as string;
      if (!eventId) {
        return { success: false, error: 'Event ID is required' };
      }
      
      const event = await calendar.getEvent(context.user.id, eventId);
      if (!event) {
        return { success: false, error: 'Event not found' };
      }
      return { success: true, data: event };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get event details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async create_calendar_event(args, context): Promise<ToolResult> {
    try {
      const timezone = context.user.timezone || 'UTC';
      const eventData: calendar.CreateEventInput = {
        title: args.title as string,
        description: args.description as string | undefined,
        location: args.location as string | undefined,
        // LLM provides local wall-clock times; anchor them to the user's timezone
        startTime: parseInTimezone(args.startTime as string, timezone),
        endTime: parseInTimezone(args.endTime as string, timezone),
        attendees: args.attendees as string[] | undefined,
        timezone,
      };

      const event = await calendar.createEvent(context.user.id, eventData);
      return { success: true, data: event };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async check_calendar_conflicts(args, context): Promise<ToolResult> {
    try {
      const timezone = context.user.timezone || 'UTC';
      const startTime = parseInTimezone(args.startTime as string, timezone);
      const endTime = parseInTimezone(args.endTime as string, timezone);
      
      const conflicts = await calendar.checkConflicts(
        context.user.id,
        startTime,
        endTime
      );
      
      return { success: true, data: conflicts };
    } catch (error) {
      return {
        success: false,
        error: `Failed to check conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async find_focus_time(args, context): Promise<ToolResult> {
    try {
      const days = (args.days as number) || 5;
      const minBlockMinutes = (args.minBlockMinutes as number) || 60;
      
      const focusBlocks = await calendar.findFocusTime(context.user.id, {
        daysAhead: days,
        minBlockMinutes,
      });
      
      return { success: true, data: focusBlocks };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find focus time: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  // ==================== Task Handlers ====================
  async get_tasks(args, context): Promise<ToolResult> {
    try {
      const status = args.status as string | undefined;
      const priority = args.priority as string | undefined;
      const dueBefore = args.dueBefore as string | undefined;
      
      // Build filter conditions
      const where: Record<string, unknown> = {
        userId: context.user.id,
      };
      
      if (status && status !== 'all') {
        where.status = mapTaskStatus(status);
      }
      
      if (priority && priority !== 'all') {
        where.priority = mapPriority(priority);
      }
      
      if (dueBefore) {
        where.dueDate = { lte: new Date(dueBefore) };
      }
      
      const tasks = await prisma.task.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
      });
      
      // Return only essential fields to save tokens
      const conciseTasks = tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
      }));
      
      return { success: true, data: conciseTasks };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async create_task(args, context): Promise<ToolResult> {
    try {
      const title = args.title as string;
      if (!title) {
        return { success: false, error: 'Task title is required' };
      }

      const timezone = context.user.timezone || 'UTC';
      const task = await prisma.task.create({
        data: {
          userId: context.user.id,
          title,
          description: args.description as string | undefined,
          dueDate: args.dueDate ? parseInTimezone(args.dueDate as string, timezone) : undefined,
          priority: mapPriority(args.priority as string | undefined),
          source: args.source as string | undefined,
          sourceId: args.sourceId as string | undefined,
          status: 'PENDING',
        },
      });
      
      return { success: true, data: task };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async update_task(args, context): Promise<ToolResult> {
    try {
      const taskId = args.taskId as string;
      if (!taskId) {
        return { success: false, error: 'Task ID is required' };
      }
      
      // Verify task belongs to user
      const existingTask = await prisma.task.findFirst({
        where: { id: taskId, userId: context.user.id },
      });
      
      if (!existingTask) {
        return { success: false, error: 'Task not found' };
      }
      
      const updateData: Record<string, unknown> = {};
      if (args.title) updateData.title = args.title;
      if (args.description !== undefined) updateData.description = args.description;
      if (args.status) updateData.status = mapTaskStatus(args.status as string);
      if (args.priority) updateData.priority = mapPriority(args.priority as string);
      if (args.dueDate) {
        updateData.dueDate = parseInTimezone(args.dueDate as string, context.user.timezone || 'UTC');
      }
      
      const task = await prisma.task.update({
        where: { id: taskId },
        data: updateData,
      });
      
      return { success: true, data: task };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async delete_task(args, context): Promise<ToolResult> {
    try {
      const taskId = args.taskId as string;
      if (!taskId) {
        return { success: false, error: 'Task ID is required' };
      }
      
      // Verify task belongs to user
      const existingTask = await prisma.task.findFirst({
        where: { id: taskId, userId: context.user.id },
      });
      
      if (!existingTask) {
        return { success: false, error: 'Task not found' };
      }
      
      await prisma.task.delete({
        where: { id: taskId },
      });
      
      return { success: true, data: { deleted: taskId } };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  // ==================== Analysis Handlers ====================
  async generate_daily_briefing(args, context): Promise<ToolResult> {
    try {
      const includeEmailSummary = args.includeEmailSummary !== false;
      const includeCalendar = args.includeCalendar !== false;
      const includeTasks = args.includeTasks !== false;
      
      const briefingData: Record<string, unknown> = {};
      
      // Fetch calendar events for today
      if (includeCalendar) {
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        
        const todaysResult = await calendar.listEvents(context.user.id, {
          timeMin: now,
          timeMax: endOfDay,
        });
        
        // Also get week ahead for context
        const weekAhead = new Date(now);
        weekAhead.setDate(weekAhead.getDate() + 7);
        
        const upcomingResult = await calendar.listEvents(context.user.id, {
          timeMin: now,
          timeMax: weekAhead,
        });
        
        briefingData.todaysEvents = todaysResult.events.map(e => ({
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
        }));
        briefingData.upcomingEvents = upcomingResult.events.map(e => ({
          title: e.title,
          startTime: e.startTime,
        }));
      }
      
      // Fetch recent emails
      if (includeEmailSummary) {
        const emailResult = await gmail.listEmails(context.user.id, {
          maxResults: 10, // Reduced from 20
        });
        briefingData.recentEmails = emailResult.emails.map(e => ({
          subject: e.subject,
          sender: e.sender,
          snippet: e.snippet,
        }));
      }
      
      // Fetch pending tasks
      if (includeTasks) {
        const tasks = await prisma.task.findMany({
          where: {
            userId: context.user.id,
            status: { not: 'COMPLETED' },
          },
          orderBy: [
            { dueDate: 'asc' },
            { priority: 'desc' },
          ],
          take: 15, // Limit number of tasks
        });
        briefingData.pendingTasks = tasks.map(t => ({
          title: t.title,
          dueDate: t.dueDate,
          priority: t.priority,
        }));
      }
      
      return {
        success: true,
        data: {
          ...briefingData,
          instruction: 'Generate a comprehensive daily briefing from this data.',
          currentTime: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to gather briefing data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  async prepare_meeting_brief(args, context): Promise<ToolResult> {
    try {
      const eventId = args.eventId as string;
      if (!eventId) {
        return { success: false, error: 'Event ID is required' };
      }
      
      // Get the event details
      const event = await calendar.getEvent(context.user.id, eventId);
      if (!event) {
        return { success: false, error: 'Event not found' };
      }
      
      // Search for related emails based on attendees and subject
      interface Attendee {
        email?: string;
        displayName?: string;
        responseStatus?: string;
      }
      
      const attendees = event.attendees as Attendee[] | null;
      const attendeeEmails: string[] = attendees
        ?.map((a) => a.email)
        .filter((email): email is string => email !== undefined) || [];
      
      const searchQueries = [
        ...attendeeEmails.map((email) => `from:${email}`),
        event.title ? `subject:${event.title}` : '',
      ].filter(Boolean);
      
      let relatedEmails: CachedEmail[] = [];
      for (const query of searchQueries.slice(0, 3)) { // Limit queries
        try {
          const emails = await gmail.searchEmails(
            context.user.id,
            query,
            10
          );
          relatedEmails = [...relatedEmails, ...emails];
        } catch {
          // Continue if search fails
        }
      }
      
      // Get any related tasks
      const relatedTasks = await prisma.task.findMany({
        where: {
          userId: context.user.id,
          OR: [
            { sourceId: eventId },
            { title: { contains: event.title || '' } },
          ],
        },
      });
      
      return {
        success: true,
        data: {
          event: {
            id: event.calendarId,
            title: event.title,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            attendees: event.attendees,
            meetingLink: event.meetingLink,
          },
          relatedEmails: relatedEmails.slice(0, 10).map(e => ({
            id: e.gmailId,
            subject: e.subject,
            sender: e.sender,
            snippet: e.snippet,
            receivedAt: e.receivedAt,
          })),
          relatedTasks,
          instruction: 'Generate a meeting preparation brief with objectives, context, prep checklist, and talking points.',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to prepare meeting brief: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

/**
 * Execute a tool by name with given arguments and context
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const handler = TOOL_HANDLERS[toolName];
  
  if (!handler) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }
  
  return handler(args, context);
}

/**
 * Get tool definitions for the LLM
 */
export function getToolDefinitions(): Tool[] {
  return AI_TOOLS;
}
