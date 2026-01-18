import { create } from 'zustand';
import { tasksApi } from '../services/api';
import type { Task, TaskStats, CreateTaskInput, UpdateTaskInput } from '../types';

interface TasksState {
  // State
  tasks: Task[];
  stats: TaskStats | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTasks: (params?: { status?: string; priority?: string }) => Promise<void>;
  fetchStats: () => Promise<void>;
  createTask: (data: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, data: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useTasksStore = create<TasksState>()((set, get) => ({
  // Initial state
  tasks: [],
  stats: null,
  isLoading: false,
  error: null,

  // Fetch tasks
  fetchTasks: async (params) => {
    try {
      set({ isLoading: true, error: null });
      const tasks = await tasksApi.list(params);
      set({ tasks, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch tasks';
      set({ error: message, isLoading: false });
    }
  },

  // Fetch stats
  fetchStats: async () => {
    try {
      const stats = await tasksApi.getStats();
      set({ stats });
    } catch (error) {
      console.error('Failed to fetch task stats:', error);
    }
  },

  // Create task
  createTask: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const task = await tasksApi.create(data);
      set((state) => ({
        tasks: [task, ...state.tasks],
        isLoading: false,
      }));
      // Refresh stats
      get().fetchStats();
      return task;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create task';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Update task
  updateTask: async (id, data) => {
    try {
      const task = await tasksApi.update(id, data);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      }));
      // Refresh stats
      get().fetchStats();
      return task;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update task';
      set({ error: message });
      throw error;
    }
  },

  // Delete task
  deleteTask: async (id) => {
    try {
      await tasksApi.delete(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      }));
      // Refresh stats
      get().fetchStats();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete task';
      set({ error: message });
      throw error;
    }
  },

  // Toggle task status (pending <-> completed)
  toggleTaskStatus: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await get().updateTask(id, { status: newStatus });
  },

  // Clear error
  clearError: () => set({ error: null }),
}));

// Selectors
export const usePendingTasks = () =>
  useTasksStore((state) => state.tasks.filter((t) => t.status === 'pending'));
export const useCompletedTasks = () =>
  useTasksStore((state) => state.tasks.filter((t) => t.status === 'completed'));
