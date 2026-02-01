import { create } from 'zustand';
import { chatApi } from '../services/api';
import type { Conversation, Message } from '../types';

interface ChatState {
  // State
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;

  // Actions
  fetchConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  sendMessageStream: (message: string) => void;
  createNewChat: () => void;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  clearError: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  // Initial state
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
  error: null,

  // Fetch all conversations
  fetchConversations: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await chatApi.listConversations();
      // Ensure conversations is always an array
      const conversations = Array.isArray(response) ? response : (response as any)?.conversations || [];
      set({ conversations, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch conversations';
      set({ error: message, isLoading: false });
    }
  },

  // Select and load a conversation
  selectConversation: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const conversation = await chatApi.getConversation(id);
      set({
        currentConversation: conversation,
        messages: conversation.messages || [],
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load conversation';
      set({ error: message, isLoading: false });
    }
  },

  // Send message (non-streaming)
  sendMessage: async (message: string) => {
    const { currentConversation } = get();
    
    // Add user message optimistically
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: currentConversation?.id || '',
      role: 'user',
      content: message,
      toolCalls: null,
      toolResults: null,
      createdAt: new Date().toISOString(),
    };
    
    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const response = await chatApi.sendMessage(message, currentConversation?.id);
      
      set((state) => ({
        currentConversation: response.conversation,
        messages: [...state.messages.filter(m => !m.id.startsWith('temp-')), userMessage, response.message],
        isLoading: false,
      }));

      // Update conversations list
      get().fetchConversations();
    } catch (error) {
      console.error('[ChatStore] Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      set((state) => ({
        // Keep the user message but remove the loading state and show error
        messages: state.messages.map(m => m.id === userMessage.id ? { ...m, error: true } : m),
        error: errorMessage,
        isLoading: false,
      }));
    }
  },

  // Send message with streaming
  sendMessageStream: (message: string) => {
    const { currentConversation } = get();
    
    // Add user message optimistically
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: currentConversation?.id || '',
      role: 'user',
      content: message,
      toolCalls: null,
      toolResults: null,
      createdAt: new Date().toISOString(),
    };
    
    set((state) => ({
      messages: [...state.messages, userMessage],
      isStreaming: true,
      streamingContent: '',
      error: null,
    }));

    chatApi.sendMessageStream(
      message,
      currentConversation?.id,
      // onMessage
      (content) => {
        set((state) => ({
          streamingContent: state.streamingContent + content,
        }));
      },
      // onError
      (error) => {
        set({
          error: error.message,
          isStreaming: false,
          streamingContent: '',
        });
      },
      // onComplete
      () => {
        const { streamingContent } = get();
        const assistantMessage: Message = {
          id: `stream-${Date.now()}`,
          conversationId: currentConversation?.id || '',
          role: 'assistant',
          content: streamingContent,
          toolCalls: null,
          toolResults: null,
          createdAt: new Date().toISOString(),
        };
        
        set((state) => ({
          messages: [...state.messages, assistantMessage],
          isStreaming: false,
          streamingContent: '',
        }));
        
        // Refresh conversations
        get().fetchConversations();
      }
    );
  },

  // Create new chat
  createNewChat: () => {
    set({
      currentConversation: null,
      messages: [],
      error: null,
    });
  },

  // Delete conversation
  deleteConversation: async (id: string) => {
    try {
      await chatApi.deleteConversation(id);
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        currentConversation: state.currentConversation?.id === id ? null : state.currentConversation,
        messages: state.currentConversation?.id === id ? [] : state.messages,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete conversation';
      set({ error: message });
    }
  },

  // Update conversation title
  updateConversationTitle: async (id: string, title: string) => {
    try {
      const updated = await chatApi.updateConversation(id, title);
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? updated : c),
        currentConversation: state.currentConversation?.id === id ? updated : state.currentConversation,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update conversation';
      set({ error: message });
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));

// Selectors
export const useCurrentMessages = () => useChatStore((state) => state.messages);
export const useIsStreaming = () => useChatStore((state) => state.isStreaming);
export const useStreamingContent = () => useChatStore((state) => state.streamingContent);
