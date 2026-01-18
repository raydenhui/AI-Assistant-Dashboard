/**
 * Task Routes
 * API endpoints for task management
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  bulkUpdateTasks,
  getTaskStats,
} from '../controllers/task.controller';

const router = Router();

// All task routes require authentication
router.use(requireAuth);

/**
 * @route   GET /api/tasks
 * @desc    List user tasks with optional filtering
 * @access  Private
 * @query   status - Filter by status (all, pending, in_progress, completed, cancelled)
 * @query   priority - Filter by priority (all, low, medium, high, urgent)
 * @query   dueBefore - Filter tasks due before this date (ISO format)
 * @query   dueAfter - Filter tasks due after this date (ISO format)
 * @query   limit - Number of tasks to return (default: 50, max: 100)
 * @query   offset - Offset for pagination (default: 0)
 */
router.get('/', listTasks);

/**
 * @route   GET /api/tasks/stats
 * @desc    Get task statistics for the user
 * @access  Private
 */
router.get('/stats', getTaskStats);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 * @body    title - Task title (required)
 * @body    description - Task description
 * @body    dueDate - Due date in ISO format
 * @body    priority - LOW, MEDIUM, HIGH, or URGENT
 * @body    source - Source of the task (email, calendar, chat, manual)
 * @body    sourceId - ID of the source item
 */
router.post('/', createTask);

/**
 * @route   POST /api/tasks/bulk-update
 * @desc    Bulk update task statuses
 * @access  Private
 * @body    taskIds - Array of task IDs to update
 * @body    status - New status for all tasks
 */
router.post('/bulk-update', bulkUpdateTasks);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get a single task by ID
 * @access  Private
 */
router.get('/:id', getTask);

/**
 * @route   PATCH /api/tasks/:id
 * @desc    Update a task
 * @access  Private
 * @body    title - New task title
 * @body    description - New description
 * @body    dueDate - New due date in ISO format
 * @body    priority - New priority level
 * @body    status - New status
 */
router.patch('/:id', updateTask);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete('/:id', deleteTask);

export default router;
