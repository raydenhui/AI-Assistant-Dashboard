import { useEffect } from 'react';
import { useTasksStore } from '../../store';

export function TasksWidget() {
  const { tasks, isLoading, error, fetchTasks, toggleTaskStatus, deleteTask } = useTasksStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

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

  const handleAddTask = () => {
    // TODO: Open add task modal
    console.log('Add task clicked');
  };

  return (
    <div className="widget">
      <div className="widget-header">
        <span>Action Items</span>
        <button 
          onClick={handleAddTask}
          className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
        >
          Add New <i className="fas fa-plus text-xs"></i>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="spinner"></div>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-exclamation-circle text-danger mb-2"></i>
          <p>{error}</p>
          <button onClick={() => fetchTasks()} className="text-primary text-sm mt-2 hover:underline">
            Try again
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-check-circle text-3xl mb-2"></i>
          <p>No tasks yet</p>
          <button onClick={handleAddTask} className="text-primary text-sm mt-2 hover:underline">
            Add your first task
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {tasks.slice(0, 5).map((task) => (
            <li key={task.id} className="py-3 first:pt-0 last:pb-0">
              {/* Main row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={() => toggleTaskStatus(task.id)}
                    className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label
                    className={`font-medium cursor-pointer ${
                      task.status === 'completed'
                        ? 'text-gray-400 line-through'
                        : 'text-gray-800'
                    }`}
                    onClick={() => toggleTaskStatus(task.id)}
                  >
                    {task.title}
                  </label>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="delete-btn"
                  aria-label="Delete task"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
              
              {/* Meta row */}
              <div className="flex gap-3 text-sm text-gray-500 mt-1 ml-7">
                {task.dueDate && (
                  <span className={task.status !== 'completed' && new Date(task.dueDate) < new Date() ? 'text-danger' : ''}>
                    {formatDueDate(task.dueDate)}
                  </span>
                )}
                {task.source && (
                  <span>Source: {task.source}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TasksWidget;
