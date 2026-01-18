import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, setAuthToken } from '../services/api';
import type { User, AuthStatus } from '../types';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  checkAuth: () => Promise<void>;
  login: (token: string) => void;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      // Check authentication status
      checkAuth: async () => {
        try {
          set({ isLoading: true, error: null });
          const status: AuthStatus = await authApi.getStatus();
          
          if (status.authenticated && status.user) {
            console.log('[AuthStore] Auth check successful, user:', status.user);
            set({
              user: status.user,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Failed to check authentication',
          });
        }
      },

      // Set auth token after OAuth callback
      login: (token: string) => {
        setAuthToken(token);
        // After setting token, check auth to get user info
        get().checkAuth();
      },

      // Logout
      logout: async () => {
        try {
          await authApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          setAuthToken(null);
          set({
            user: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      // Update user (after settings change)
      updateUser: (user: User) => {
        set({ user });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist minimal auth state, not user details
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selector hooks for common patterns
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
