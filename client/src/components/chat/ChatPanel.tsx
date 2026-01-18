import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store';
import { ChatMessage } from './ChatMessage';

export function ChatPanel() {
  const {
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    createNewChat,
  } = useChatStore();
  
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

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
    <div className="widget h-full flex flex-col !p-0 overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-slate-700">
        <span className="text-lg font-semibold text-gray-800 dark:text-white">AI Chat</span>
        <button
          onClick={handleNewChat}
          className="btn-outline rounded-full px-4 py-2 text-sm flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          New Chat
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="chat-bubble chat-bubble-ai dark:text-slate-200">
            Hello! How can I help you manage your workday today?
          </div>
        ) : (
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
