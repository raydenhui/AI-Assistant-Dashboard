import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Conversation, Message, ChatResponse } from '../../types';

vi.mock('../../services/api', () => ({
  chatApi: {
    listConversations: vi.fn(),
    getConversation: vi.fn(),
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversation: vi.fn(),
  },
}));

const mockMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  conversationId: 'conv-1',
  role: 'user',
  content: 'Hello',
  toolCalls: null,
  toolResults: null,
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const mockConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'conv-1',
  userId: 'user-1',
  title: 'Test Conversation',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  messages: [],
  ...overrides,
});

describe('useChatStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has correct default state', async () => {
      const { useChatStore } = await import('../../store/chat.store');
      const state = useChatStore.getState();
      expect(state.conversations).toEqual([]);
      expect(state.currentConversation).toBeNull();
      expect(state.messages).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.isStreaming).toBe(false);
      expect(state.streamingContent).toBe('');
      expect(state.error).toBeNull();
    });
  });

  describe('fetchConversations()', () => {
    it('fetches and stores conversations array', async () => {
      const { chatApi } = await import('../../services/api');
      const convs = [mockConversation(), mockConversation({ id: 'conv-2' })];
      vi.mocked(chatApi.listConversations).mockResolvedValueOnce(convs);

      const { useChatStore } = await import('../../store/chat.store');
      await useChatStore.getState().fetchConversations();

      const state = useChatStore.getState();
      expect(state.conversations).toEqual(convs);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('handles response that wraps conversations in an object', async () => {
      const { chatApi } = await import('../../services/api');
      const convs = [mockConversation()];
      // Simulate server returning { conversations: [...] } instead of array
      vi.mocked(chatApi.listConversations).mockResolvedValueOnce({ conversations: convs } as any);

      const { useChatStore } = await import('../../store/chat.store');
      await useChatStore.getState().fetchConversations();

      expect(useChatStore.getState().conversations).toEqual(convs);
    });

    it('sets error when fetch fails', async () => {
      const { chatApi } = await import('../../services/api');
      vi.mocked(chatApi.listConversations).mockRejectedValueOnce(new Error('Network error'));

      const { useChatStore } = await import('../../store/chat.store');
      await useChatStore.getState().fetchConversations();

      expect(useChatStore.getState().error).toBe('Network error');
      expect(useChatStore.getState().isLoading).toBe(false);
    });
  });

  describe('selectConversation()', () => {
    it('loads a conversation and its messages', async () => {
      const { chatApi } = await import('../../services/api');
      const messages = [mockMessage()];
      const conv = mockConversation({ messages });
      vi.mocked(chatApi.getConversation).mockResolvedValueOnce(conv);

      const { useChatStore } = await import('../../store/chat.store');
      await useChatStore.getState().selectConversation('conv-1');

      const state = useChatStore.getState();
      expect(state.currentConversation).toEqual(conv);
      expect(state.messages).toEqual(messages);
      expect(state.isLoading).toBe(false);
    });

    it('sets error when loading conversation fails', async () => {
      const { chatApi } = await import('../../services/api');
      vi.mocked(chatApi.getConversation).mockRejectedValueOnce(new Error('Not found'));

      const { useChatStore } = await import('../../store/chat.store');
      await useChatStore.getState().selectConversation('non-existent');

      expect(useChatStore.getState().error).toBe('Not found');
    });
  });

  describe('sendMessage()', () => {
    it('optimistically adds user message and then adds assistant response', async () => {
      const { chatApi } = await import('../../services/api');
      const conv = mockConversation({ id: 'conv-1' });
      const assistantMsg = mockMessage({ id: 'msg-2', role: 'assistant', content: 'Hi there!' });
      const chatResponse: ChatResponse = { message: assistantMsg, conversation: conv };
      vi.mocked(chatApi.sendMessage).mockResolvedValueOnce(chatResponse);
      vi.mocked(chatApi.listConversations).mockResolvedValueOnce([conv]);

      const { useChatStore } = await import('../../store/chat.store');
      useChatStore.setState({ currentConversation: conv });

      await useChatStore.getState().sendMessage('Hello');

      const state = useChatStore.getState();
      // Should contain both user message and assistant message
      const userMsgs = state.messages.filter(m => m.role === 'user');
      const assistantMsgs = state.messages.filter(m => m.role === 'assistant');
      expect(userMsgs.length).toBeGreaterThanOrEqual(1);
      expect(assistantMsgs.length).toBeGreaterThanOrEqual(1);
      expect(assistantMsgs[0].content).toBe('Hi there!');
    });

    it('sets error state when sendMessage fails', async () => {
      const { chatApi } = await import('../../services/api');
      vi.mocked(chatApi.sendMessage).mockRejectedValueOnce(new Error('AI unavailable'));

      const { useChatStore } = await import('../../store/chat.store');
      await useChatStore.getState().sendMessage('Hello');

      expect(useChatStore.getState().error).toBe('AI unavailable');
      expect(useChatStore.getState().isLoading).toBe(false);
    });
  });

  describe('sendMessageStream()', () => {
    it('sets isStreaming to true and calls chatApi.sendMessageStream', async () => {
      const { chatApi } = await import('../../services/api');
      vi.mocked(chatApi.sendMessageStream).mockImplementation(() => {
        // Simulate stream - do nothing (just return cleanup)
        return () => {};
      });

      const { useChatStore } = await import('../../store/chat.store');
      useChatStore.getState().sendMessageStream('Hello');

      expect(chatApi.sendMessageStream).toHaveBeenCalledWith(
        'Hello',
        undefined, // no current conversation
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('accumulates streamed content via onMessage callback', async () => {
      const { chatApi } = await import('../../services/api');
      let capturedOnMessage: ((data: string) => void) | undefined;

      vi.mocked(chatApi.sendMessageStream).mockImplementation((_msg, _convId, onMessage) => {
        capturedOnMessage = onMessage;
        return () => {};
      });

      const { useChatStore } = await import('../../store/chat.store');
      useChatStore.getState().sendMessageStream('Hello');

      // Simulate receiving stream chunks
      capturedOnMessage?.('Hello ');
      capturedOnMessage?.('world!');

      expect(useChatStore.getState().streamingContent).toBe('Hello world!');
    });

    it('handles stream error via onError callback', async () => {
      const { chatApi } = await import('../../services/api');
      let capturedOnError: ((err: Error) => void) | undefined;

      vi.mocked(chatApi.sendMessageStream).mockImplementation((_msg, _convId, _onMsg, onError) => {
        capturedOnError = onError;
        return () => {};
      });

      const { useChatStore } = await import('../../store/chat.store');
      useChatStore.getState().sendMessageStream('Hello');

      capturedOnError?.(new Error('Stream failed'));

      const state = useChatStore.getState();
      expect(state.error).toBe('Stream failed');
      expect(state.isStreaming).toBe(false);
      expect(state.streamingContent).toBe('');
    });

    it('finalizes streaming and adds assistant message via onComplete callback', async () => {
      const { chatApi } = await import('../../services/api');
      vi.mocked(chatApi.listConversations).mockResolvedValueOnce([]);
      let capturedOnMessage: ((data: string) => void) | undefined;
      let capturedOnComplete: (() => void) | undefined;

      vi.mocked(chatApi.sendMessageStream).mockImplementation((_msg, _convId, onMessage, _onError, onComplete) => {
        capturedOnMessage = onMessage;
        capturedOnComplete = onComplete;
        return () => {};
      });

      const { useChatStore } = await import('../../store/chat.store');
      useChatStore.getState().sendMessageStream('Hello');

      capturedOnMessage?.('Final response');
      capturedOnComplete?.();

      const state = useChatStore.getState();
      expect(state.isStreaming).toBe(false);
      expect(state.streamingContent).toBe('');
      const assistantMsgs = state.messages.filter(m => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(1);
      expect(assistantMsgs[0].content).toBe('Final response');
    });
  });

  describe('createNewChat()', () => {
    it('resets currentConversation, messages, and error', async () => {
      const { useChatStore } = await import('../../store/chat.store');
      useChatStore.setState({
        currentConversation: mockConversation(),
        messages: [mockMessage()],
        error: 'Some error',
      });

      useChatStore.getState().createNewChat();

      const state = useChatStore.getState();
      expect(state.currentConversation).toBeNull();
      expect(state.messages).toEqual([]);
      expect(state.error).toBeNull();
    });
  });

  describe('deleteConversation()', () => {
    it('removes conversation from the list', async () => {
      const { chatApi } = await import('../../services/api');
      vi.mocked(chatApi.deleteConversation).mockResolvedValueOnce(undefined);

      const conv1 = mockConversation({ id: 'conv-1' });
      const conv2 = mockConversation({ id: 'conv-2' });

      const { useChatStore } = await import('../../store/chat.store');
      useChatStore.setState({ conversations: [conv1, conv2] });

      await useChatStore.getState().deleteConversation('conv-1');

      const convs = useChatStore.getState().conversations;
      expect(convs).toHaveLength(1);
      expect(convs[0].id).toBe('conv-2');
    });

    it('clears current conversation and messages if currently selected conversation is deleted', async () => {
      const { chatApi } = await import('../../services/api');
      vi.mocked(chatApi.deleteConversation).mockResolvedValueOnce(undefined);

      const conv = mockConversation({ id: 'conv-1' });

      const { useChatStore } = await import('../../store/chat.store');
      useChatStore.setState({
        conversations: [conv],
        currentConversation: conv,
        messages: [mockMessage()],
      });

      await useChatStore.getState().deleteConversation('conv-1');

      expect(useChatStore.getState().currentConversation).toBeNull();
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it('sets error when delete fails', async () => {
      const { chatApi } = await import('../../services/api');
      vi.mocked(chatApi.deleteConversation).mockRejectedValueOnce(new Error('Cannot delete'));

      const { useChatStore } = await import('../../store/chat.store');
      await useChatStore.getState().deleteConversation('conv-1');

      expect(useChatStore.getState().error).toBe('Cannot delete');
    });
  });

  describe('updateConversationTitle()', () => {
    it('updates title in conversations list and current conversation', async () => {
      const { chatApi } = await import('../../services/api');
      const conv = mockConversation({ id: 'conv-1', title: 'Old Title' });
      const updated = { ...conv, title: 'New Title' };
      vi.mocked(chatApi.updateConversation).mockResolvedValueOnce(updated);

      const { useChatStore } = await import('../../store/chat.store');
      useChatStore.setState({ conversations: [conv], currentConversation: conv });

      await useChatStore.getState().updateConversationTitle('conv-1', 'New Title');

      expect(useChatStore.getState().conversations[0].title).toBe('New Title');
      expect(useChatStore.getState().currentConversation?.title).toBe('New Title');
    });

    it('sets error when update fails', async () => {
      const { chatApi } = await import('../../services/api');
      vi.mocked(chatApi.updateConversation).mockRejectedValueOnce(new Error('Update failed'));

      const { useChatStore } = await import('../../store/chat.store');
      await useChatStore.getState().updateConversationTitle('conv-1', 'New Title');

      // The store propagates the actual error message from the thrown Error
      expect(useChatStore.getState().error).toBe('Update failed');
    });
  });

  describe('clearError()', () => {
    it('clears the error from state', async () => {
      const { useChatStore } = await import('../../store/chat.store');
      useChatStore.setState({ error: 'Some error' });

      useChatStore.getState().clearError();

      expect(useChatStore.getState().error).toBeNull();
    });
  });
});
