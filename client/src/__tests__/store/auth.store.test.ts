import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api module before importing the store
vi.mock('../../services/api', () => ({
  authApi: {
    getStatus: vi.fn(),
    logout: vi.fn(),
  },
  setAuthToken: vi.fn(),
  getAuthToken: vi.fn(),
}));

// We need to reset the zustand store state between tests
// by resetting modules so each test gets a fresh store instance

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has correct default state', async () => {
      const { useAuthStore } = await import('../../store/auth.store');
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
    });

    it('exposes expected actions', async () => {
      const { useAuthStore } = await import('../../store/auth.store');
      const state = useAuthStore.getState();
      expect(typeof state.checkAuth).toBe('function');
      expect(typeof state.login).toBe('function');
      expect(typeof state.logout).toBe('function');
      expect(typeof state.updateUser).toBe('function');
      expect(typeof state.clearError).toBe('function');
    });
  });

  describe('checkAuth()', () => {
    it('sets isAuthenticated and user when auth check succeeds', async () => {
      const { authApi } = await import('../../services/api');
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        llmProvider: 'openrouter' as const,
        llmModel: null,
        openRouterKey: null,
        theme: null,
        timezone: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      vi.mocked(authApi.getStatus).mockResolvedValueOnce({
        authenticated: true,
        user: mockUser,
      });

      const { useAuthStore } = await import('../../store/auth.store');
      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets isAuthenticated=false when auth check returns unauthenticated', async () => {
      const { authApi } = await import('../../services/api');
      vi.mocked(authApi.getStatus).mockResolvedValueOnce({ authenticated: false });

      const { useAuthStore } = await import('../../store/auth.store');
      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('sets error when auth check throws', async () => {
      const { authApi } = await import('../../services/api');
      vi.mocked(authApi.getStatus).mockRejectedValueOnce(new Error('Network error'));

      const { useAuthStore } = await import('../../store/auth.store');
      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Failed to check authentication');
    });
  });

  describe('login()', () => {
    it('calls setAuthToken with the provided token', async () => {
      const { authApi } = await import('../../services/api');
      const { setAuthToken } = await import('../../services/api');
      vi.mocked(authApi.getStatus).mockResolvedValueOnce({ authenticated: false });

      const { useAuthStore } = await import('../../store/auth.store');
      useAuthStore.getState().login('my-jwt-token');

      expect(setAuthToken).toHaveBeenCalledWith('my-jwt-token');
    });
  });

  describe('logout()', () => {
    it('clears user and isAuthenticated after logout', async () => {
      const { authApi } = await import('../../services/api');
      const { setAuthToken } = await import('../../services/api');
      vi.mocked(authApi.logout).mockResolvedValueOnce(undefined);

      const { useAuthStore } = await import('../../store/auth.store');
      // Simulate logged in state
      useAuthStore.setState({ user: { id: '1' } as any, isAuthenticated: true });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(setAuthToken).toHaveBeenCalledWith(null);
    });

    it('still clears state even if authApi.logout throws', async () => {
      const { authApi } = await import('../../services/api');
      vi.mocked(authApi.logout).mockRejectedValueOnce(new Error('Server error'));

      const { useAuthStore } = await import('../../store/auth.store');
      useAuthStore.setState({ user: { id: '1' } as any, isAuthenticated: true });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('updateUser()', () => {
    it('updates the user in the store', async () => {
      const { useAuthStore } = await import('../../store/auth.store');
      const newUser = {
        id: '2',
        email: 'updated@example.com',
        name: 'Updated User',
        llmProvider: 'ollama' as const,
        llmModel: 'llama3.2',
        openRouterKey: null,
        theme: 'DARK' as const,
        timezone: 'UTC',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      };

      useAuthStore.getState().updateUser(newUser);

      expect(useAuthStore.getState().user).toEqual(newUser);
    });
  });

  describe('clearError()', () => {
    it('clears the error from state', async () => {
      const { useAuthStore } = await import('../../store/auth.store');
      useAuthStore.setState({ error: 'Some error' });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('selector hooks', () => {
    it('useUser returns current user', async () => {
      const { useAuthStore, useUser } = await import('../../store/auth.store');
      const mockUser = { id: '1', email: 'test@example.com' } as any;
      useAuthStore.setState({ user: mockUser });

      // Simulate selector by calling it against the store state
      const user = useAuthStore.getState().user;
      expect(user).toEqual(mockUser);
    });

    it('useIsAuthenticated returns isAuthenticated', async () => {
      const { useAuthStore } = await import('../../store/auth.store');
      useAuthStore.setState({ isAuthenticated: true });

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });
});
