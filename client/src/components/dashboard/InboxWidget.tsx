import { useEffect, useState } from 'react';
import { emailsApi } from '../../services/api';
import type { Email } from '../../types';

export function InboxWidget() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setIsLoading(true);
      const data = await emailsApi.getPrioritized();
      setEmails(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = (id: string) => {
    setEmails(emails.filter(e => e.id !== id));
  };

  const getPriorityClass = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      default:
        return 'priority-low';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'High Priority';
      case 'medium':
        return 'Important';
      default:
        return 'Digest';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="widget">
      <div className="widget-header">
        <span>Prioritized Inbox</span>
        <button className="text-primary hover:underline text-sm font-medium">
          View All
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="spinner"></div>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-exclamation-circle text-danger mb-2"></i>
          <p>{error}</p>
          <button onClick={fetchEmails} className="text-primary text-sm mt-2 hover:underline">
            Try again
          </button>
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-inbox text-3xl mb-2"></i>
          <p>No prioritized emails</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {emails.map((email) => (
            <li key={email.id} className="py-3 first:pt-0 last:pb-0">
              {/* Main row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800 truncate block">
                    {email.subject || '(No subject)'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`priority-badge ${getPriorityClass(email.aiAnalysis?.priority)}`}>
                    {getPriorityLabel(email.aiAnalysis?.priority)}
                  </span>
                  <button
                    onClick={() => handleDismiss(email.id)}
                    className="delete-btn"
                    aria-label="Dismiss email"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
              
              {/* Meta row */}
              <div className="flex gap-3 text-sm text-gray-500 mt-1">
                <span>From: {email.sender}</span>
                <span>{formatDate(email.receivedAt)}</span>
              </div>
              
              {/* AI Summary */}
              {email.aiAnalysis?.summary && (
                <p className="text-sm text-gray-500 italic mt-2 leading-relaxed">
                  AI Summary: {email.aiAnalysis.summary}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default InboxWidget;
