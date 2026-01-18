import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { emailsApi } from '../../services/api';
import { toast } from '../common/Toast';
import type { Email } from '../../types';

interface ViewAllEmailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ViewAllEmailsModal({ isOpen, onClose }: ViewAllEmailsModalProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchEmails = useCallback(async (query?: string) => {
    try {
      setIsLoading(true);
      const data = query 
        ? await emailsApi.search(query)
        : await emailsApi.list({ maxResults: 50 });
      setEmails(data);
    } catch (error) {
      toast.error('Failed to fetch emails');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
    }
  }, [isOpen, fetchEmails]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmails(searchQuery);
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const result = await emailsApi.sync(50);
      toast.success(`Synced ${result.synced} emails`);
      fetchEmails();
    } catch (error) {
      toast.error('Failed to sync emails');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-danger';
      case 'medium': return 'bg-warning text-gray-800';
      case 'low': return 'bg-secondary';
      default: return 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-400';
    }
  };

  const extractSenderName = (sender: string | null) => {
    if (!sender) return 'Unknown';
    const match = sender.match(/^([^<]+)/);
    return match ? match[1].trim() : sender;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="All Emails" size="5xl">
      <div className="flex flex-col h-[60vh]">
        {/* Search and Actions */}
        <div className="flex gap-3 mb-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emails..."
                className="form-input"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="btn btn-secondary whitespace-nowrap"
          >
            {isSyncing ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i>Syncing...</>
            ) : (
              <><i className="fas fa-sync-alt mr-2"></i>Sync Emails</>
            )}
          </button>
        </div>

        {/* Email List / Detail View */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Email List */}
          <div className={`${selectedEmail ? 'w-2/5' : 'w-full'} overflow-auto border border-gray-200 rounded-lg dark:border-slate-700`}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="spinner w-8 h-8"></div>
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4 dark:text-slate-400">
                <i className="fas fa-inbox text-4xl mb-3"></i>
                <p>No emails found</p>
                {searchQuery && (
                  <button 
                    onClick={() => { setSearchQuery(''); fetchEmails(); }}
                    className="text-primary text-sm mt-2 hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-slate-700">
                {emails.map((email) => (
                  <li 
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`
                      p-3 cursor-pointer hover:bg-gray-50 transition-colors dark:hover:bg-slate-800/50
                      ${selectedEmail?.id === email.id ? 'bg-primary/5 border-l-2 border-primary dark:bg-primary/10' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate dark:text-white">
                            {extractSenderName(email.sender)}
                          </span>
                          {email.aiAnalysis?.priority && (
                            <span className={`priority-badge ${getPriorityColor(email.aiAnalysis.priority)}`}>
                              {email.aiAnalysis.priority}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 font-medium truncate mt-0.5 dark:text-slate-200">
                          {email.subject || '(No subject)'}
                        </p>
                        <p className="text-sm text-gray-500 truncate dark:text-slate-400">
                          {email.snippet}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap dark:text-slate-500">
                        {formatDate(email.receivedAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Email Detail */}
          {selectedEmail && (
            <div className="w-3/5 border border-gray-200 rounded-lg p-4 overflow-auto dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <button 
                  onClick={() => setSelectedEmail(null)}
                  className="text-gray-500 hover:text-gray-700 md:hidden dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <i className="fas fa-arrow-left mr-2"></i>Back
                </button>
                {selectedEmail.aiAnalysis?.priority && (
                  <span className={`priority-badge ${getPriorityColor(selectedEmail.aiAnalysis.priority)}`}>
                    {selectedEmail.aiAnalysis.priority} Priority
                  </span>
                )}
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">
                {selectedEmail.subject || '(No subject)'}
              </h3>
              
              <div className="flex items-center gap-3 text-sm text-gray-500 mb-4 dark:text-slate-400">
                <span className="font-medium">{selectedEmail.sender}</span>
                <span>•</span>
                <span>{new Date(selectedEmail.receivedAt).toLocaleString()}</span>
              </div>

              {selectedEmail.aiAnalysis?.summary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 dark:bg-blue-900/20 dark:border-blue-900/30">
                  <div className="flex items-center gap-2 text-blue-700 text-sm font-medium mb-1 dark:text-blue-400">
                    <i className="fas fa-robot"></i>
                    AI Summary
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-300">{selectedEmail.aiAnalysis.summary}</p>
                </div>
              )}

              {selectedEmail.aiAnalysis?.actionItems && selectedEmail.aiAnalysis.actionItems.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 dark:bg-yellow-900/20 dark:border-yellow-900/30">
                  <div className="flex items-center gap-2 text-yellow-700 text-sm font-medium mb-1 dark:text-yellow-400">
                    <i className="fas fa-tasks"></i>
                    Action Items
                  </div>
                  <ul className="text-sm text-yellow-800 list-disc list-inside dark:text-yellow-300">
                    {selectedEmail.aiAnalysis.actionItems.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div 
                  className="text-gray-700 whitespace-pre-wrap dark:text-slate-300"
                  dangerouslySetInnerHTML={{ 
                    __html: selectedEmail.body || selectedEmail.snippet || 'No content available' 
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default ViewAllEmailsModal;
