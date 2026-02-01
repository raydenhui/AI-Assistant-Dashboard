import { useState, useEffect } from 'react';
import { useTasksStore } from '../../store';
import { usePolling } from '../../hooks/usePolling';
import { eventBus, EVENTS } from '../../utils/events';
import { toast } from '../common/Toast';
import { AddTaskModal } from './AddTaskModal';
import { EditTaskModal } from './EditTaskModal';

// Polling interval: 1 minute (60000ms)
const POLL_INTERVAL = 1 * 60 * 1000;

export function TasksWidget() {
  const { tasks, isLoading, error, fetchTasks, toggleTaskStatus, deleteTask } = useTasksStore();
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

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

  // Listen for external refresh requests
  useEffect(() => {
    return eventBus.on(EVENTS.REFRESH_TASKS, () => {
      refresh();
    });
  }, [refresh]);

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    if (date.toDateString() === now.toDateString()) return `Due: Today at ${timeStr}`;
    if (date.toDateString() === tomorrow.toDateString()) return `Due: Tomorrow at ${timeStr}`;
    
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Overdue: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${timeStr}`;
    if (diffDays <= 7) return `Due: ${date.toLocaleDateString('en-US', { weekday: 'short' })} at ${timeStr}`;
    return `Due: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${timeStr}`;
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

  // Sort by due date
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const taskCount = tasks.length;

  return (
    <>
      <div className="widget h-full flex flex-col">
        <div className="widget-header !mb-2 !pb-1.5 flex-col !items-start">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="dark:text-white whitespace-nowrap text-base">Action Items</span>
              {taskCount > 0 && (
                <span className="text-[10px] bg-primary text-white px-1.5 py-0 rounded-full">
                  {taskCount}
                </span>
              )}
              {lastUpdated && (
                <span className="text-[10px] text-gray-400 font-normal dark:text-slate-500 ml-1">
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
                <i className="fas fa-sync-alt text-xs"></i>
              </button>
              <button
                onClick={() => setShowAddTask(true)}
                className="text-primary hover:underline text-xs font-medium whitespace-nowrap"
              >
                Add New
              </button>
            </div>
          </div>
        </div>

        {isLoading && tasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="spinner"></div>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-gray-500 dark:text-slate-400">
            <i className="fas fa-exclamation-circle text-danger text-2xl mb-2"></i>
            <p className="text-sm">{error}</p>
            <button onClick={() => refresh()} className="text-primary text-sm mt-2 hover:underline">
              Try again
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-gray-500 dark:text-slate-400">
            <i className="fas fa-check-circle text-3xl mb-2"></i>
            <p>No tasks yet</p>
            <button onClick={() => setShowAddTask(true)} className="text-primary text-sm mt-2 hover:underline">
              Add your first task
            </button>
          </div>
        ) : (
          <>
            <ul className="widget-content divide-y divide-border overflow-auto flex-1">
              {sortedTasks.slice(0, 5).map((task) => (
                <li key={task.id} className="py-3 first:pt-0 last:pb-0 group">
                  {/* Main row */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => setEditingTask(task)}
                    >
                      <div className="mt-1.5">
                        <i className="fas fa-circle text-primary/30 text-[8px]"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium block truncate text-gray-800 dark:text-slate-200">
                          {task.title}
                        </span>
                      </div>
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
                  <div
                    className="flex gap-3 text-sm text-gray-500 mt-1 ml-7 dark:text-slate-400 cursor-pointer"
                    onClick={() => setEditingTask(task)}
                  >
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
            {tasks.length > 5 && (
              <div className="flex items-center justify-end text-sm text-gray-500 mt-3 pt-3 border-t border-border dark:text-slate-400">
                <span className="text-primary">
                  +{tasks.length - 5} more tasks
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Task Modal */}
      <AddTaskModal isOpen={showAddTask} onClose={() => setShowAddTask(false)} />

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          task={editingTask}
        />
      )}
    </>
  );
}

export default TasksWidget;
