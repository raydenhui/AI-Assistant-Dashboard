import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  ApiResponse,
  AuthStatus,
  GoogleAuthResponse,
  User,
  Task,
  TaskStats,
  CreateTaskInput,
  UpdateTaskInput,
  Email,
  CalendarEvent,
  CreateEventInput,
  UpdateEventInput,
  Conversation,
  ChatResponse,
  UserSettingsUpdate,
} from '../types';

// API base URL - proxied through Vite in development
const API_BASE_URL = '/api';

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Token management
let authToken: string | null = localStorage.getItem('auth_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = () => authToken;

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Track if we're already redirecting to prevent loops
let isRedirecting = false;

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message: string }>) => {
    if (error.response?.status === 401) {
      // Clear token on unauthorized
      setAuthToken(null);
      
      // Only redirect if not already on login page and not already redirecting
      // Use a check to prevent redirect loops and allow auth checks to fail gracefully
      const isAuthStatusCheck = error.config?.url?.includes('/auth/status');
      const isOnLoginPage = window.location.pathname === '/login';
      const isOnCallbackPage = window.location.pathname.includes('/auth/callback');
      
      if (!isAuthStatusCheck && !isOnLoginPage && !isOnCallbackPage && !isRedirecting) {
        isRedirecting = true;
        // Use setTimeout to allow current execution to complete
        setTimeout(() => {
          window.location.href = '/login';
          isRedirecting = false;
        }, 100);
      }
    }
    return Promise.reject(error);
  }
);

// Generic request handler
async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await apiClient.request<ApiResponse<T>>(config);
    if (response.data.success && response.data.data !== undefined) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Request failed');
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
}

// ==================== Auth API ====================

export const authApi = {
  // Get Google OAuth URL
  getGoogleAuthUrl: async (): Promise<GoogleAuthResponse> => {
    const response = await apiClient.get<ApiResponse<GoogleAuthResponse>>('/auth/google');
    return response.data.data!;
  },

  // Check auth status
  getStatus: async (): Promise<AuthStatus> => {
    const response = await apiClient.get<ApiResponse<any>>('/auth/me');
    return {
      authenticated: true,
      user: response.data.data
    };
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    return request<User>({ method: 'GET', url: '/auth/me' });
  },

  // Update user settings
  updateSettings: async (settings: UserSettingsUpdate): Promise<User> => {
    const payload: any = {};
    
    if (settings.provider) {
      payload.llmProvider = settings.provider.toUpperCase();
    }
    
    if (settings.model) {
      payload.llmSettings = { model: settings.model };
    }

    // Always send openRouterKey if it's in settings, even if empty (to allow clearing)
    if (settings.openRouterKey !== undefined) {
      payload.openRouterKey = settings.openRouterKey;
    }
    
    if (settings.theme) {
      payload.theme = settings.theme.toUpperCase();
    }
    
    if (settings.timezone) {
      payload.timezone = settings.timezone;
    }

    return request<User>({
      method: 'PATCH',
      url: '/auth/settings',
      data: payload,
    });
  },

  // Logout
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
    setAuthToken(null);
  },

  // Delete account
  deleteAccount: async (): Promise<void> => {
    await apiClient.delete('/auth/account');
    setAuthToken(null);
  },
};

// ==================== Tasks API ====================

export const tasksApi = {
  // List tasks
  list: async (params?: {
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<Task[]> => {
    const response = await request<{ tasks: Task[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>({
      method: 'GET',
      url: '/tasks',
      params,
    });
    return response.tasks;
  },

  // Get task stats
  getStats: async (): Promise<TaskStats> => {
    return request<TaskStats>({
      method: 'GET',
      url: '/tasks/stats',
    });
  },

  // Get single task
  get: async (id: string): Promise<Task> => {
    return request<Task>({
      method: 'GET',
      url: `/tasks/${id}`,
    });
  },

  // Create task
  create: async (data: CreateTaskInput): Promise<Task> => {
    return request<Task>({
      method: 'POST',
      url: '/tasks',
      data,
    });
  },

  // Update task
  update: async (id: string, data: UpdateTaskInput): Promise<Task> => {
    return request<Task>({
      method: 'PATCH',
      url: `/tasks/${id}`,
      data,
    });
  },

  // Delete task
  delete: async (id: string): Promise<void> => {
    await request<void>({
      method: 'DELETE',
      url: `/tasks/${id}`,
    });
  },

  // Bulk update tasks
  bulkUpdate: async (taskIds: string[], status: string): Promise<{ updated: number }> => {
    return request<{ updated: number }>({
      method: 'POST',
      url: '/tasks/bulk-update',
      data: { taskIds, status },
    });
  },
};

// ==================== Emails API ====================

export const emailsApi = {
  // List emails
  list: async (params?: {
    maxResults?: number;
    query?: string;
    cached?: boolean;
  }): Promise<Email[]> => {
    const response = await request<{ emails: Email[]; nextPageToken?: string; totalEstimate?: number }>({
      method: 'GET',
      url: '/emails',
      params,
    });
    return response.emails;
  },

  // Get prioritized emails
  getPrioritized: async (): Promise<Email[]> => {
    const response = await request<{ emails: Email[] }>({
      method: 'GET',
      url: '/emails/prioritized',
    });
    return response.emails;
  },

  // Search emails
  search: async (query: string): Promise<Email[]> => {
    const response = await request<{ emails: Email[]; query: string; resultCount: number }>({
      method: 'GET',
      url: '/emails/search',
      params: { q: query },
    });
    return response.emails;
  },

  // Get email by ID
  get: async (id: string): Promise<Email> => {
    return request<Email>({
      method: 'GET',
      url: `/emails/${id}`,
    });
  },

  // Get email thread
  getThread: async (threadId: string): Promise<Email[]> => {
    const response = await request<{ threadId: string; emails: Email[]; messageCount: number }>({
      method: 'GET',
      url: `/emails/thread/${threadId}`,
    });
    return response.emails;
  },

  // Sync emails from Gmail
  sync: async (maxResults?: number): Promise<{ synced: number }> => {
    return request<{ synced: number }>({
      method: 'POST',
      url: '/emails/sync',
      data: { maxResults },
    });
  },

  // Dismiss an email
  dismiss: async (id: string): Promise<void> => {
    await request<void>({
      method: 'PATCH',
      url: `/emails/${id}/dismiss`,
    });
  },
};

// ==================== Calendar API ====================

export const calendarApi = {
  // List events
  list: async (params?: {
    days?: number;
    includeDeclined?: boolean;
    cached?: boolean;
  }): Promise<CalendarEvent[]> => {
    const response = await request<{ events: CalendarEvent[]; nextPageToken?: string }>({
      method: 'GET',
      url: '/calendar/events',
      params,
    });
    return response.events;
  },

  // Get today's events
  getToday: async (): Promise<CalendarEvent[]> => {
    const response = await request<{ events: CalendarEvent[]; date: string; eventCount: number }>({
      method: 'GET',
      url: '/calendar/events/today',
    });
    return response.events;
  },

  // Get event by ID
  get: async (id: string): Promise<CalendarEvent> => {
    return request<CalendarEvent>({
      method: 'GET',
      url: `/calendar/events/${id}`,
    });
  },

  // Create event
  create: async (data: CreateEventInput): Promise<CalendarEvent> => {
    return request<CalendarEvent>({
      method: 'POST',
      url: '/calendar/events',
      data,
    });
  },

  // Update event
  update: async (id: string, data: UpdateEventInput): Promise<CalendarEvent> => {
    return request<CalendarEvent>({
      method: 'PATCH',
      url: `/calendar/events/${id}`,
      data,
    });
  },

  // Delete event
  delete: async (id: string): Promise<void> => {
    await request<void>({
      method: 'DELETE',
      url: `/calendar/events/${id}`,
    });
  },

  // Sync events from Google Calendar
  sync: async (days?: number): Promise<{ synced: number }> => {
    return request<{ synced: number }>({
      method: 'POST',
      url: '/calendar/sync',
      data: { days },
    });
  },

  // Check for conflicts
  checkConflicts: async (startTime: string, endTime: string): Promise<CalendarEvent[]> => {
    return request<CalendarEvent[]>({
      method: 'POST',
      url: '/calendar/check-conflicts',
      data: { startTime, endTime },
    });
  },

  // Find focus time slots
  getFocusTime: async (days?: number, minBlockMinutes?: number): Promise<{ start: string; end: string }[]> => {
    return request<{ start: string; end: string }[]>({
      method: 'GET',
      url: '/calendar/focus-time',
      params: { days, minBlockMinutes },
    });
  },

  // Dismiss an event
  dismiss: async (id: string): Promise<void> => {
    await request<void>({
      method: 'PATCH',
      url: `/calendar/events/${id}/dismiss`,
    });
  },
};

// ==================== Chat API ====================

export const chatApi = {
  // Send message (non-streaming)
  sendMessage: async (
    message: string,
    conversationId?: string
  ): Promise<ChatResponse> => {
    return request<ChatResponse>({
      method: 'POST',
      url: '/chat/messages',
      data: { message, conversationId },
    });
  },

  // Send message (streaming) - returns EventSource for SSE
  sendMessageStream: (
    message: string,
    conversationId: string | undefined,
    onMessage: (data: string) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): (() => void) => {
    const params = new URLSearchParams();
    params.append('message', message);
    if (conversationId) {
      params.append('conversationId', conversationId);
    }

    const eventSource = new EventSource(
      `${API_BASE_URL}/chat/messages/stream?${params.toString()}`,
      { withCredentials: true }
    );

    eventSource.onmessage = (event) => {
      if (event.data === '[DONE]') {
        onComplete();
        eventSource.close();
      } else {
        try {
          const data = JSON.parse(event.data);
          onMessage(data.content || '');
        } catch {
          onMessage(event.data);
        }
      }
    };

    eventSource.onerror = () => {
      onError(new Error('Stream connection error'));
      eventSource.close();
    };

    // Return cleanup function
    return () => eventSource.close();
  },

  // Get daily briefing
  getBriefing: async (): Promise<ChatResponse> => {
    return request<ChatResponse>({
      method: 'POST',
      url: '/chat/briefing',
    });
  },

  // List conversations
  listConversations: async (): Promise<Conversation[]> => {
    return request<Conversation[]>({
      method: 'GET',
      url: '/chat/conversations',
    });
  },

  // Get conversation with messages
  getConversation: async (id: string): Promise<Conversation> => {
    return request<Conversation>({
      method: 'GET',
      url: `/chat/conversations/${id}`,
    });
  },

  // Update conversation title
  updateConversation: async (id: string, title: string): Promise<Conversation> => {
    return request<Conversation>({
      method: 'PATCH',
      url: `/chat/conversations/${id}`,
      data: { title },
    });
  },

  // Delete conversation
  deleteConversation: async (id: string): Promise<void> => {
    await request<void>({
      method: 'DELETE',
      url: `/chat/conversations/${id}`,
    });
  },
};

// Export all APIs
export default {
  auth: authApi,
  tasks: tasksApi,
  emails: emailsApi,
  calendar: calendarApi,
  chat: chatApi,
};
