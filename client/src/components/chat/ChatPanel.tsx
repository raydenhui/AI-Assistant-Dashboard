import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store';
import { ChatMessage } from './ChatMessage';
export function ChatPanel() {
  const {
    messages,
    conversations,
    currentConversation,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    clearError,
    fetchConversations,
    selectConversation,
    sendMessage,
    createNewChat,
    deleteConversation,
  } = useChatStore();
  
  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || isStreaming) return;

    const message = inputValue.trim();
    setInputValue('');
    await sendMessage(message);
    inputRef.current?.focus();
  };

  const handleNewChat = () => {
    createNewChat();
    setInputValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="widget h-full flex flex-col !p-0 overflow-hidden relative">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-slate-700 bg-white dark:bg-slate-800 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowHistory(!showHistory);
            }}
            className={`p-2 rounded-lg transition-colors ${
              showHistory
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400'
            }`}
            title="Chat History"
          >
            <i className="fas fa-history"></i>
          </button>
          <span className="text-lg font-semibold text-gray-800 dark:text-white">
            {currentConversation?.title || 'AI Chat'}
          </span>
        </div>
        <button
          onClick={handleNewChat}
          className="btn-outline rounded-full px-4 py-2 text-sm flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          New Chat
        </button>
      </div>

      {/* Chat History Overlay */}
      {showHistory && (
        <div className="absolute inset-0 top-[65px] z-20 bg-white dark:bg-slate-800 border-r border-border dark:border-slate-700 flex flex-col">
          <div className="p-4 border-b border-border dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-medium text-gray-700 dark:text-slate-200">Recent Conversations</h3>
            <button
              onClick={() => setShowHistory(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              title="Close History"
              aria-label="Close History"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!Array.isArray(conversations) || conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-slate-400">
                <p>No history yet</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center justify-between p-4 cursor-pointer border-b border-border/50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
                      currentConversation?.id === conv.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                    }`}
                    onClick={() => {
                      if (conv.id) {
                        selectConversation(conv.id);
                        setShowHistory(false);
                      }
                    }}
                  >
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                        {conv.title}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {conv.updatedAt ? new Date(conv.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No date'}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this conversation?')) {
                          if (conv.id) deleteConversation(conv.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all"
                      title="Delete Conversation"
                      aria-label="Delete Conversation"
                    >
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {/* Streaming message */}
            {isStreaming && streamingContent && (
              <div className="chat-bubble chat-bubble-ai dark:text-slate-200">
                {streamingContent}
                <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse"></span>
              </div>
            )}
          </>
        }
        
        {/* Error message */}
        {error && (
          <div className="flex items-start gap-3 p-3 mx-1 rounded-xl bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800/40">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0 mt-0.5 dark:bg-red-900/40 dark:text-red-400">
              <i className="fas fa-exclamation-triangle text-[10px]"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">AI Error</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 break-words">{error}</p>
              {error.toLowerCase().includes('model') && (
                <p className="text-[10px] text-red-500 dark:text-red-500 mt-1">
                  Tip: Go to Settings and select a model that's installed in Ollama (e.g., gemma4:latest).
                </p>
              )}
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-300 shrink-0"
              title="Dismiss error"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !isStreaming && (
          <div className="chat-bubble chat-bubble-ai flex items-center gap-2 dark:text-slate-200">
            <div className="spinner !w-4 !h-4"></div>
            <span>Thinking...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border px-5 py-4 flex gap-3 dark:border-slate-700"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask your AI assistant..."
          disabled={isLoading || isStreaming}
          className="flex-1 border border-border rounded-full px-4 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:disabled:bg-slate-900"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading || isStreaming}
          className="bg-primary text-white rounded-full px-4 py-2.5 flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <i className="fas fa-paper-plane"></i>
        </button>
      </form>
    </div>
  );
}

export default ChatPanel;
