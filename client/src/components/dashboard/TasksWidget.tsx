import { useState } from 'react';
import { useTasksStore } from '../../store';
import { usePolling } from '../../hooks/usePolling';
import { toast } from '../common/Toast';
import { AddTaskModal } from './AddTaskModal';

// Polling interval: 2 minutes (120000ms)
const POLL_INTERVAL = 2 * 60 * 1000;

export function TasksWidget() {
  const { tasks, isLoading, error, fetchTasks, toggleTaskStatus, deleteTask } = useTasksStore();
  const [showAddTask, setShowAddTask] = useState(false);

  // Use polling hook for auto-refresh
  const { lastUpdated, refresh } = usePolling(
    async () => {
      await fetchTasks();
    },
    {
      interval: POLL_INTERVAL,
      enabled: true,
      immediate: true,
    }
  );

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === now.toDateString()) return 'Due: Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Due: Tomorrow';
    
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Overdue: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    if (diffDays <= 7) return `Due: ${date.toLocaleDateString('en-US', { weekday: 'short' })}`;
    return `Due: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleTaskStatus(id);
      const task = tasks.find(t => t.id === id);
      if (task) {
        toast.success(task.status === 'completed' ? 'Task reopened' : 'Task completed!');
      }
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteTask(id);
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Filter pending tasks first, then completed
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === b.status) {
      // Sort by due date if same status
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    }
    return a.status === 'completed' ? 1 : -1;
  });

  const pendingCount = tasks.filter(t => t.status !== 'completed').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <>
      <div className="widget">
        <div className="widget-header">
          <div className="flex items-center gap-2">
            <span className="dark:text-white">Action Items</span>
            {pendingCount > 0 && (
              <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
            {lastUpdated && (
              <span className="text-xs text-gray-400 font-normal dark:text-slate-500">
                {formatLastUpdated(lastUpdated)}
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
              onClick={() => setShowAddTask(true)}
              className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
            >
              Add New <i className="fas fa-plus text-xs"></i>
            </button>
          </div>
        </div>

        {isLoading && tasks.length === 0 ? (
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
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            <i className="fas fa-check-circle text-3xl mb-2"></i>
            <p>No tasks yet</p>
            <button onClick={() => setShowAddTask(true)} className="text-primary text-sm mt-2 hover:underline">
              Add your first task
            </button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {sortedTasks.slice(0, 5).map((task) => (
                <li key={task.id} className="py-3 first:pt-0 last:pb-0 group">
                  {/* Main row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={task.status === 'completed'}
                        onChange={() => handleToggleStatus(task.id)}
                        className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                        aria-label={`Mark "${task.title}" as ${task.status === 'completed' ? 'incomplete' : 'complete'}`}
                      />
                      <label
                        className={`font-medium cursor-pointer ${
                          task.status === 'completed'
                            ? 'text-gray-400 line-through dark:text-slate-500'
                            : 'text-gray-800 dark:text-slate-200'
                        }`}
                        onClick={() => handleToggleStatus(task.id)}
                      >
                        {task.title}
                      </label>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {task.priority === 'high' && task.status !== 'completed' && (
                        <span className="priority-badge priority-high">High</span>
                      )}
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="delete-btn opacity-0 group-hover:opacity-100 transition-opacity dark:text-slate-500 dark:hover:text-danger"
                        aria-label="Delete task"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                  
                  {/* Meta row */}
                  <div className="flex gap-3 text-sm text-gray-500 mt-1 ml-7 dark:text-slate-400">
                    {task.dueDate && (
                      <span className={
                        task.status !== 'completed' && new Date(task.dueDate) < new Date() 
                          ? 'text-danger font-medium dark:text-red-400' 
                          : ''
                      }>
                        {formatDueDate(task.dueDate)}
                      </span>
                    )}
                    {task.source && (
                      <span className="flex items-center gap-1">
                        <i className="fas fa-tag text-xs"></i>
                        {task.source}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Stats and View More */}
            {(tasks.length > 5 || completedCount > 0) && (
              <div className="flex items-center justify-between text-sm text-gray-500 mt-3 pt-3 border-t border-border dark:text-slate-400">
                <span>
                  {completedCount > 0 && `${completedCount} completed`}
                </span>
                {tasks.length > 5 && (
                  <span className="text-primary">
                    +{tasks.length - 5} more tasks
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Task Modal */}
      <AddTaskModal isOpen={showAddTask} onClose={() => setShowAddTask(false)} />
    </>
  );
}

export default TasksWidget;
