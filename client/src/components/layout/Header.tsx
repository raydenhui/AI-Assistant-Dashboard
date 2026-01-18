import { useState } from 'react';
import { useAuthStore } from '../../store';

export function Header() {
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [aiStatus] = useState<'online' | 'offline' | 'thinking'>('online');

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

  return (
    <header className="flex items-center justify-between bg-widget px-6 py-4 shadow-header sticky top-0 z-50">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* User avatar */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm hover:opacity-90 transition-opacity"
          >
            {getInitials(user?.name)}
          </button>
          
          {/* User dropdown menu */}
          {showUserMenu && (
            <div className="absolute top-full left-0 mt-2 bg-widget rounded-lg shadow-lg border border-border py-2 min-w-[200px] z-50">
              <div className="px-4 py-2 border-b border-border">
                <p className="font-medium text-gray-800">{user?.name || 'User'}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={() => {/* TODO: Open settings */}}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <i className="fas fa-cog"></i>
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-left text-danger hover:bg-gray-50 flex items-center gap-2"
              >
                <i className="fas fa-sign-out-alt"></i>
                Sign Out
              </button>
            </div>
          )}
        </div>
        
        {/* App title */}
        <h1 className="text-xl font-semibold text-gray-800">
          Productivity AI Assistant
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* AI Status */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
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
          onClick={() => {/* TODO: Open settings modal */}}
          className="btn-icon text-gray-400 hover:text-gray-600"
          title="Settings"
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
  );
}

export default Header;
