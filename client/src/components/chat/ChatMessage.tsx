import type { Message } from '../../types';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role.toLowerCase() === 'user';
  const isAssistant = message.role.toLowerCase() === 'assistant';

  if (!isUser && !isAssistant) {
    // Don't render system or tool messages
    return null;
  }

  return (
    <div
      className={`chat-bubble ${
        isUser ? 'chat-bubble-user dark:text-slate-200' : 'chat-bubble-ai dark:text-slate-200'
      }`}
    >
      {/* Message content with basic markdown-like formatting */}
      <div className="whitespace-pre-wrap">
        {message.content.split('\n').map((line, i) => {
          // Bold text handling (simple **text** pattern)
          const formattedLine = line.replace(
            /\*\*(.*?)\*\*/g,
            '<strong>$1</strong>'
          );
          
          return (
            <span key={i}>
              {i > 0 && <br />}
              <span dangerouslySetInnerHTML={{ __html: formattedLine }} />
            </span>
          );
        })}
      </div>

      {/* Tool calls indicator (if any) */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50 text-xs text-gray-500 dark:text-slate-400 dark:border-slate-700">
          <span className="flex items-center gap-1">
            <i className="fas fa-cog"></i>
            Used {message.toolCalls.length} tool
            {message.toolCalls.length > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export default ChatMessage;
