import { useState, useEffect } from 'react';
import { useAuthStore, useChatStore } from '../../store';
import { SettingsModal } from '../settings/SettingsModal';

export function Header() {
  const { user, logout } = useAuthStore();
  const { isStreaming } = useChatStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiStatus, setAiStatus] = useState<'online' | 'offline' | 'thinking'>('online');

  // Update AI status based on chat store streaming state
  useEffect(() => {
    setAiStatus(isStreaming ? 'thinking' : 'online');
  }, [isStreaming]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  const handleOpenSettings = () => {
    setShowUserMenu(false);
    setShowSettings(true);
  };

  const getProviderLabel = (provider?: string) => {
    switch (provider) {
      case 'openrouter': return 'OpenRouter';
      case 'ollama': return 'Ollama (Local)';
      default: return 'OpenRouter';
    }
  };

  return (
    <>
      <header className="flex items-center justify-between bg-widget px-6 py-4 shadow-header sticky top-0 z-50 dark:bg-slate-800 dark:border-b dark:border-slate-700">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {/* User avatar */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm hover:opacity-90 transition-opacity"
              aria-label="User menu"
            >
              {getInitials(user?.name)}
            </button>
            
            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute top-full left-0 mt-2 bg-widget rounded-lg shadow-lg border border-border py-2 min-w-[220px] z-50 animate-slide-down dark:bg-slate-800 dark:border-slate-700">
                <div className="px-4 py-2 border-b border-border dark:border-slate-700">
                  <p className="font-medium text-gray-800 dark:text-white">{user?.name || 'User'}</p>
                  <p className="text-sm text-gray-500 truncate dark:text-slate-400">{user?.email}</p>
                </div>
                
                {/* Current LLM Provider */}
                <div className="px-4 py-2 border-b border-border dark:border-slate-700">
                  <p className="text-xs text-gray-400 uppercase tracking-wide dark:text-slate-500">AI Provider</p>
                  <p className="text-sm text-gray-700 flex items-center gap-2 dark:text-slate-300">
                    <i className={`fas ${user?.llmProvider === 'ollama' ? 'fa-server' : 'fa-cloud'}`}></i>
                    {getProviderLabel(user?.llmProvider)}
                  </p>
                </div>
                
                <button
                  onClick={handleOpenSettings}
                  className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <i className="fas fa-cog"></i>
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-danger hover:bg-gray-50 flex items-center gap-2 dark:hover:bg-slate-700"
                >
                  <i className="fas fa-sign-out-alt"></i>
                  Sign Out
                </button>
              </div>
            )}
          </div>
          
          {/* App title */}
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
              Productivity AI Assistant
            </h1>
            {user?.llmModel && (
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Model: {user.llmModel}
              </p>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* AI Status */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                aiStatus === 'online'
                  ? 'bg-secondary'
                  : aiStatus === 'thinking'
                  ? 'bg-warning animate-pulse'
                  : 'bg-gray-400'
              }`}
            ></span>
            <span>
              {aiStatus === 'online'
                ? 'AI Online'
                : aiStatus === 'thinking'
                ? 'AI Thinking...'
                : 'AI Offline'}
            </span>
          </div>

          {/* Settings icon */}
          <button
            onClick={handleOpenSettings}
            className="btn-icon text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200"
            title="Settings"
            aria-label="Open settings"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>

        {/* Click outside to close menu */}
        {showUserMenu && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowUserMenu(false)}
          />
        )}
      </header>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}

export default Header;
