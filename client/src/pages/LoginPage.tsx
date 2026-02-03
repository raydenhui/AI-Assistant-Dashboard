import { useState, useEffect } from 'react';
import { authApi } from '../services/api';

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Load theme from local storage or system preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { authUrl } = await authApi.getGoogleAuthUrl();
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate login');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative transition-colors duration-200">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-border text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <i className="fas fa-moon"></i>
        ) : (
          <i className="fas fa-sun"></i>
        )}
      </button>

      <div className="widget max-w-md w-full mx-4 p-8">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <i className="fas fa-robot text-white text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            AI Productivity Dashboard
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-2">
            Your intelligent assistant for managing emails, calendar, and tasks
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-danger-light text-danger-dark px-4 py-3 rounded-lg mb-6 text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error}
          </div>
        )}

        {/* Login button */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-border rounded-lg px-6 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="spinner"></div>
              <span className="text-gray-700 dark:text-slate-200">Connecting...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-gray-700 dark:text-slate-200 font-medium">
                Continue with Google
              </span>
            </>
          )}
        </button>

        {/* Features */}
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-4">
            What you'll get:
          </h3>
          <ul className="space-y-3 text-sm text-gray-600 dark:text-slate-400">
            <li className="flex items-start gap-3">
              <i className="fas fa-envelope text-primary mt-0.5"></i>
              <span>AI-powered email prioritization and summaries</span>
            </li>
            <li className="flex items-start gap-3">
              <i className="fas fa-calendar text-primary mt-0.5"></i>
              <span>Smart calendar management and meeting briefs</span>
            </li>
            <li className="flex items-start gap-3">
              <i className="fas fa-tasks text-primary mt-0.5"></i>
              <span>Automatic action item extraction</span>
            </li>
            <li className="flex items-start gap-3">
              <i className="fas fa-comments text-primary mt-0.5"></i>
              <span>Conversational AI assistant</span>
            </li>
          </ul>
        </div>

        {/* Privacy note */}
        <p className="mt-6 text-xs text-center text-gray-400 dark:text-slate-500">
          Your data is processed securely. You can use local AI models for complete privacy.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
