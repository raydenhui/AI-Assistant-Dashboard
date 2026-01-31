// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  llmProvider: 'openrouter' | 'ollama';
  llmModel: string | null;
  openRouterKey: string | null;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM' | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
}

// Auth types
export interface AuthStatus {
  authenticated: boolean;
  user?: User;
}

export interface GoogleAuthResponse {
  authUrl: string;
}

// Task types
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  source: string | null;
  sourceId: string | null;
  status: TaskStatus;
  dueDate: string | null;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  dueToday: number;
  dueTomorrow: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: TaskPriority;
  source?: string;
  sourceId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string;
  priority?: TaskPriority;
}

// Email types
export interface Email {
  id: string;
  gmailId: string;
  threadId: string | null;
  subject: string | null;
  sender: string | null;
  snippet: string | null;
  body: string | null;
  receivedAt: string;
  cachedAt: string;
  aiAnalysis: EmailAIAnalysis | null;
}

export interface EmailAIAnalysis {
  priority?: 'urgent' | 'important' | 'normal' | 'unrelevent' | 'high' | 'medium' | 'low';
  summary?: string;
  actionItems?: string[];
  category?: string;
}

// Calendar types
export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  attendees: EventAttendee[] | null;
  aiAnalysis: EventAIAnalysis | null;
}

export interface EventAttendee {
  email: string;
  name?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
}

export interface EventAIAnalysis {
  summary?: string;
  preparationNotes?: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
}

// Chat types
export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls: ToolCall[] | null;
  toolResults: ToolResult[] | null;
  createdAt: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
}

export interface SendMessageInput {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  message: Message;
  conversation: Conversation;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// LLM Settings types
export interface LLMSettings {
  provider: 'openrouter' | 'ollama';
  model: string;
}

// User Settings Update types
export interface UserSettingsUpdate {
  provider?: 'openrouter' | 'ollama';
  model?: string;
  openRouterKey?: string;
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  timezone?: string;
}
