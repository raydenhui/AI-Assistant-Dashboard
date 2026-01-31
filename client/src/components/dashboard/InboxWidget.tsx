import { useState, useRef } from 'react';
import { emailsApi } from '../../services/api';
import { usePolling } from '../../hooks/usePolling';
import { toast } from '../common/Toast';
import { ViewAllEmailsModal } from './ViewAllEmailsModal';
import type { Email } from '../../types';

// Polling interval: 3 minutes (180000ms)
const POLL_INTERVAL = 3 * 60 * 1000;

export function InboxWidget() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showViewAll, setShowViewAll] = useState(false);
  const hasShownError = useRef(false);

  // Use polling hook for auto-refresh
  const { lastUpdated, refresh } = usePolling(
    async () => {
      try {
        setIsLoading(true);
        // Trigger a quick sync before fetching prioritized emails
        try {
          await emailsApi.sync(10);
        } catch (syncErr) {
          console.warn('Background sync failed:', syncErr);
        }
        const data = await emailsApi.getPrioritized();
        setEmails(data);
        setError(null);
        hasShownError.current = false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch emails';
        setError(message);
        if (!hasShownError.current) {
          hasShownError.current = true;
          toast.error(message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    {
      interval: POLL_INTERVAL,
      enabled: true,
      immediate: true,
    }
  );

  const handleDismiss = async (id: string) => {
    try {
      await emailsApi.dismiss(id);
      setEmails(emails.filter(e => e.id !== id));
      toast.info('Email removed from prioritized inbox');
    } catch (err) {
      toast.error('Failed to dismiss email');
    }
  };

  const getPriorityClass = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'priority-urgent';
      case 'important':
        return 'priority-important';
      case 'normal':
        return 'priority-normal';
      case 'unrelevent':
        return 'priority-unrelevent';
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      default:
        return 'priority-low';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'Urgent';
      case 'important':
        return 'Important';
      case 'normal':
        return 'Normal';
      case 'unrelevent':
        return 'Unrelevent';
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
    
    if (diffHours < 1) {
      if (Math.floor((now.getTime() - date.getTime()) / (1000 * 60)) < 1) {
        return 'Just now'
      } else {
        const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));  
        return `${diffMinutes} minutes ago`;
      }
    };
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <div className="widget">
        <div className="widget-header">
          <div className="flex items-center gap-2">
            <span className="dark:text-white">Prioritized Inbox</span>
            {lastUpdated && (
              <span className="text-xs text-gray-400 font-normal dark:text-slate-500">
                Updated {formatDate(lastUpdated.toISOString())}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => refresh()}
              className="text-gray-400 hover:text-primary transition-colors dark:text-slate-500 dark:hover:text-primary"
              title="Refresh"
            >
              <i className="fas fa-sync-alt text-sm"></i>
            </button>
            <button 
              onClick={() => setShowViewAll(true)}
              className="text-primary hover:underline text-sm font-medium"
            >
              View All
            </button>
          </div>
        </div>

        {isLoading && emails.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="spinner"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            <i className="fas fa-exclamation-circle text-danger text-2xl mb-2"></i>
            <p className="text-sm">{error}</p>
            <button onClick={() => refresh()} className="text-primary text-sm mt-2 hover:underline">
              Try again
            </button>
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            <i className="fas fa-inbox text-3xl mb-2"></i>
            <p>No prioritized emails</p>
            <p className="text-xs mt-1">Your inbox is clear!</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {emails.slice(0, 5).map((email) => (
              <li key={email.id} className="py-3 first:pt-0 last:pb-0 group">
                {/* Main row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800 truncate block dark:text-slate-200">
                      {email.subject || '(No subject)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`priority-badge ${getPriorityClass(email.aiAnalysis?.priority)}`}>
                      {getPriorityLabel(email.aiAnalysis?.priority)}
                    </span>
                    <button
                      onClick={() => handleDismiss(email.id)}
                      className="delete-btn opacity-0 group-hover:opacity-100 transition-opacity dark:text-slate-500 dark:hover:text-danger"
                      aria-label="Dismiss email"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
                
                {/* Meta row */}
                <div className="flex gap-3 text-sm text-gray-500 mt-1 dark:text-slate-400">
                  <span className="truncate">From: {email.sender}</span>
                  <span className="flex-shrink-0">{formatDate(email.receivedAt)}</span>
                </div>
                
                {/* AI Summary */}
                {email.aiAnalysis?.summary && (
                  <p className="text-sm text-gray-500 italic mt-2 leading-relaxed line-clamp-2 dark:text-slate-400">
                    AI Summary: {email.aiAnalysis.summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Show count if more emails */}
        {emails.length > 5 && (
          <button 
            onClick={() => setShowViewAll(true)}
            className="w-full text-center text-sm text-primary hover:underline mt-3 pt-3 border-t border-border"
          >
            +{emails.length - 5} more emails
          </button>
        )}
      </div>

      {/* View All Modal */}
      <ViewAllEmailsModal isOpen={showViewAll} onClose={() => setShowViewAll(false)} />
    </>
  );
}

export default InboxWidget;
