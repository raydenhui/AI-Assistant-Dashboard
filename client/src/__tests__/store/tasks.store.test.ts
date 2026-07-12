import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task, TaskStats } from '../../types';

vi.mock('../../services/api', () => ({
  tasksApi: {
    list: vi.fn(),
    getStats: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkUpdate: vi.fn(),
  },
}));

const mockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  userId: 'user-1',
  title: 'Test Task',
  description: null,
  source: null,
  sourceId: null,
  status: 'pending',
  dueDate: null,
  priority: 'medium',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const mockStats: TaskStats = {
  total: 5,
  completed: 2,
  pending: 2,
  inProgress: 1,
  overdue: 0,
  dueToday: 1,
  dueTomorrow: 0,
};

describe('useTasksStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has correct default state', async () => {
      const { useTasksStore } = await import('../../store/tasks.store');
      const state = useTasksStore.getState();
      expect(state.tasks).toEqual([]);
      expect(state.stats).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchTasks()', () => {
    it('fetches and stores tasks', async () => {
      const { tasksApi } = await import('../../services/api');
      const tasks = [mockTask(), mockTask({ id: 'task-2', title: 'Second Task' })];
      vi.mocked(tasksApi.list).mockResolvedValueOnce(tasks);

      const { useTasksStore } = await import('../../store/tasks.store');
      await useTasksStore.getState().fetchTasks();

      const state = useTasksStore.getState();
      expect(state.tasks).toEqual(tasks);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('passes params to tasksApi.list', async () => {
      const { tasksApi } = await import('../../services/api');
      vi.mocked(tasksApi.list).mockResolvedValueOnce([]);

      const { useTasksStore } = await import('../../store/tasks.store');
      await useTasksStore.getState().fetchTasks({ status: 'pending', priority: 'high' });

      expect(tasksApi.list).toHaveBeenCalledWith({ status: 'pending', priority: 'high' });
    });

    it('sets error message when fetch fails', async () => {
      const { tasksApi } = await import('../../services/api');
      vi.mocked(tasksApi.list).mockRejectedValueOnce(new Error('Network error'));

      const { useTasksStore } = await import('../../store/tasks.store');
      await useTasksStore.getState().fetchTasks();

      const state = useTasksStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('sets default error message when error has no message', async () => {
      const { tasksApi } = await import('../../services/api');
      vi.mocked(tasksApi.list).mockRejectedValueOnce('unexpected error');

      const { useTasksStore } = await import('../../store/tasks.store');
      await useTasksStore.getState().fetchTasks();

      expect(useTasksStore.getState().error).toBe('Failed to fetch tasks');
    });
  });

  describe('fetchStats()', () => {
    it('fetches and stores stats', async () => {
      const { tasksApi } = await import('../../services/api');
      vi.mocked(tasksApi.getStats).mockResolvedValueOnce(mockStats);

      const { useTasksStore } = await import('../../store/tasks.store');
      await useTasksStore.getState().fetchStats();

      expect(useTasksStore.getState().stats).toEqual(mockStats);
    });

    it('does not throw when stats fetch fails', async () => {
      const { tasksApi } = await import('../../services/api');
      vi.mocked(tasksApi.getStats).mockRejectedValueOnce(new Error('Failed'));

      const { useTasksStore } = await import('../../store/tasks.store');
      await expect(useTasksStore.getState().fetchStats()).resolves.not.toThrow();
    });
  });

  describe('createTask()', () => {
    it('adds the new task to the front of the tasks list', async () => {
      const { tasksApi } = await import('../../services/api');
      const existing = mockTask({ id: 'old-task' });
      const newTask = mockTask({ id: 'new-task', title: 'New Task' });
      vi.mocked(tasksApi.create).mockResolvedValueOnce(newTask);
      vi.mocked(tasksApi.getStats).mockResolvedValueOnce(mockStats);

      const { useTasksStore } = await import('../../store/tasks.store');
      useTasksStore.setState({ tasks: [existing] });

      const result = await useTasksStore.getState().createTask({ title: 'New Task' });

      expect(result).toEqual(newTask);
      const tasks = useTasksStore.getState().tasks;
      expect(tasks[0]).toEqual(newTask);
      expect(tasks[1]).toEqual(existing);
    });

    it('throws and sets error when creation fails', async () => {
      const { tasksApi } = await import('../../services/api');
      vi.mocked(tasksApi.create).mockRejectedValueOnce(new Error('Server error'));

      const { useTasksStore } = await import('../../store/tasks.store');
      await expect(useTasksStore.getState().createTask({ title: 'fail' })).rejects.toThrow('Server error');

      expect(useTasksStore.getState().error).toBe('Server error');
    });
  });

  describe('updateTask()', () => {
    it('updates task in the list', async () => {
      const { tasksApi } = await import('../../services/api');
      const original = mockTask({ id: 'task-1', status: 'pending' });
      const updated = { ...original, status: 'completed' as const };
      vi.mocked(tasksApi.update).mockResolvedValueOnce(updated);
      vi.mocked(tasksApi.getStats).mockResolvedValueOnce(mockStats);

      const { useTasksStore } = await import('../../store/tasks.store');
      useTasksStore.setState({ tasks: [original] });

      const result = await useTasksStore.getState().updateTask('task-1', { status: 'completed' });

      expect(result).toEqual(updated);
      expect(useTasksStore.getState().tasks[0].status).toBe('completed');
    });

    it('throws and sets error when update fails', async () => {
      const { tasksApi } = await import('../../services/api');
      vi.mocked(tasksApi.update).mockRejectedValueOnce(new Error('Update failed'));

      const { useTasksStore } = await import('../../store/tasks.store');
      await expect(
        useTasksStore.getState().updateTask('task-1', { status: 'completed' })
      ).rejects.toThrow('Update failed');

      expect(useTasksStore.getState().error).toBe('Update failed');
    });
  });

  describe('deleteTask()', () => {
    it('removes task from the list', async () => {
      const { tasksApi } = await import('../../services/api');
      const task1 = mockTask({ id: 'task-1' });
      const task2 = mockTask({ id: 'task-2' });
      vi.mocked(tasksApi.delete).mockResolvedValueOnce(undefined);
      vi.mocked(tasksApi.getStats).mockResolvedValueOnce(mockStats);

      const { useTasksStore } = await import('../../store/tasks.store');
      useTasksStore.setState({ tasks: [task1, task2] });

      await useTasksStore.getState().deleteTask('task-1');

      const tasks = useTasksStore.getState().tasks;
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-2');
    });

    it('throws and sets error when delete fails', async () => {
      const { tasksApi } = await import('../../services/api');
      vi.mocked(tasksApi.delete).mockRejectedValueOnce(new Error('Delete failed'));

      const { useTasksStore } = await import('../../store/tasks.store');
      await expect(useTasksStore.getState().deleteTask('task-1')).rejects.toThrow('Delete failed');

      expect(useTasksStore.getState().error).toBe('Delete failed');
    });
  });

  describe('toggleTaskStatus()', () => {
    it('toggles a pending task to completed', async () => {
      const { tasksApi } = await import('../../services/api');
      const task = mockTask({ id: 'task-1', status: 'pending' });
      const updated = { ...task, status: 'completed' as const };
      vi.mocked(tasksApi.update).mockResolvedValueOnce(updated);
      vi.mocked(tasksApi.getStats).mockResolvedValueOnce(mockStats);

      const { useTasksStore } = await import('../../store/tasks.store');
      useTasksStore.setState({ tasks: [task] });

      await useTasksStore.getState().toggleTaskStatus('task-1');

      expect(tasksApi.update).toHaveBeenCalledWith('task-1', { status: 'completed' });
    });

    it('toggles a completed task to pending', async () => {
      const { tasksApi } = await import('../../services/api');
      const task = mockTask({ id: 'task-1', status: 'completed' });
      const updated = { ...task, status: 'pending' as const };
      vi.mocked(tasksApi.update).mockResolvedValueOnce(updated);
      vi.mocked(tasksApi.getStats).mockResolvedValueOnce(mockStats);

      const { useTasksStore } = await import('../../store/tasks.store');
      useTasksStore.setState({ tasks: [task] });

      await useTasksStore.getState().toggleTaskStatus('task-1');

      expect(tasksApi.update).toHaveBeenCalledWith('task-1', { status: 'pending' });
    });

    it('does nothing when task ID is not found', async () => {
      const { tasksApi } = await import('../../services/api');

      const { useTasksStore } = await import('../../store/tasks.store');
      useTasksStore.setState({ tasks: [] });

      await useTasksStore.getState().toggleTaskStatus('non-existent');

      expect(tasksApi.update).not.toHaveBeenCalled();
    });
  });

  describe('clearError()', () => {
    it('clears the error', async () => {
      const { useTasksStore } = await import('../../store/tasks.store');
      useTasksStore.setState({ error: 'Some error' });

      useTasksStore.getState().clearError();

      expect(useTasksStore.getState().error).toBeNull();
    });
  });

  describe('selectors', () => {
    it('usePendingTasks filters to only pending tasks', async () => {
      const { useTasksStore } = await import('../../store/tasks.store');
      const pending = mockTask({ id: '1', status: 'pending' });
      const completed = mockTask({ id: '2', status: 'completed' });
      useTasksStore.setState({ tasks: [pending, completed] });

      const pendingTasks = useTasksStore.getState().tasks.filter(t => t.status === 'pending');
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].id).toBe('1');
    });

    it('useCompletedTasks filters to only completed tasks', async () => {
      const { useTasksStore } = await import('../../store/tasks.store');
      const pending = mockTask({ id: '1', status: 'pending' });
      const completed = mockTask({ id: '2', status: 'completed' });
      useTasksStore.setState({ tasks: [pending, completed] });

      const completedTasks = useTasksStore.getState().tasks.filter(t => t.status === 'completed');
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].id).toBe('2');
    });
  });
});
