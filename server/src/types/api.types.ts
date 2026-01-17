// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard API response wrapper for successful responses
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * Standard API response wrapper for errors
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
    stack?: string;
  };
}

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Common query parameters
 */
export interface QueryParams extends PaginationParams {
  search?: string;
  filter?: Record<string, unknown>;
}

// =============================================================================
// User Types
// =============================================================================

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  llmProvider: 'OPENROUTER' | 'OLLAMA';
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  timezone: string;
  createdAt: string;
}

export interface UserSettings {
  llmProvider: 'OPENROUTER' | 'OLLAMA';
  llmSettings?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  timezone: string;
}

// =============================================================================
// Conversation & Message Types
// =============================================================================

export interface Conversation {
  id: string;
  title: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessage?: Message;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  createdAt: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

export interface SendMessageRequest {
  content: string;
  conversationId?: string;
}

export interface SendMessageResponse {
  conversation: Conversation;
  message: Message;
  assistantMessage: Message;
}

// =============================================================================
// Task Types
// =============================================================================

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  completedAt: string | null;
  source: string | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  source?: string;
  sourceId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
}

// =============================================================================
// Email Types
// =============================================================================

export interface Email {
  id: string;
  gmailId: string;
  threadId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  aiPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
  aiSummary: string | null;
  aiActionItems: string[] | null;
  receivedAt: string;
}

export interface EmailThread {
  threadId: string;
  subject: string;
  emails: Email[];
  latestEmail: Email;
}

export interface PrioritizedEmail extends Email {
  priorityReason?: string;
}

// =============================================================================
// Calendar Types
// =============================================================================

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  attendees: EventAttendee[] | null;
  organizer: string | null;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  meetingLink: string | null;
  aiSummary: string | null;
  aiPrepNotes: string | null;
}

export interface EventAttendee {
  email: string;
  name?: string;
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  organizer?: boolean;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
}

// =============================================================================
// AI Analysis Types
// =============================================================================

export interface DailyBriefing {
  date: string;
  summary: string;
  priorities: {
    emails: PrioritizedEmail[];
    tasks: Task[];
    events: CalendarEvent[];
  };
  actionItems: Task[];
  focusTimeBlocks: FocusTimeBlock[];
  warnings: string[];
}

export interface FocusTimeBlock {
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  quality: 'optimal' | 'good' | 'limited';
  reason?: string;
}

export interface MeetingBrief {
  event: CalendarEvent;
  prepNotes: string;
  relevantEmails: Email[];
  relatedTasks: Task[];
  attendeeInfo: string[];
  suggestedQuestions: string[];
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  context?: string;
}

// =============================================================================
// LLM Types
// =============================================================================

export interface LLMProviderStatus {
  provider: 'OPENROUTER' | 'OLLAMA';
  available: boolean;
  model: string;
  error?: string;
}

export interface LLMSettings {
  provider: 'OPENROUTER' | 'OLLAMA';
  model: string;
  temperature?: number;
  maxTokens?: number;
}
