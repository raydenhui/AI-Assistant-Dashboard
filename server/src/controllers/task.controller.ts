/**
 * Task Controller
 * Handles task/action item management endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { BadRequestError, NotFoundError } from '../middleware/error.middleware';
import type { Priority, TaskStatus } from '@prisma/client';

// =============================================================================
// Validation Schemas
// =============================================================================

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  dueDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  priority: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  ).optional(),
  source: z.string().max(100).optional(),
  sourceId: z.string().max(255).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  dueDate: z.string().nullable().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  priority: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  ).optional(),
  status: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  ).optional(),
});

const listTasksQuerySchema = z.object({
  status: z.preprocess(
    (val) => (typeof val === 'string' ? val.toLowerCase() : val),
    z.enum(['all', 'pending', 'in_progress', 'completed', 'cancelled'])
  ).optional(),
  priority: z.preprocess(
    (val) => (typeof val === 'string' ? val.toLowerCase() : val),
    z.enum(['all', 'low', 'medium', 'high', 'urgent'])
  ).optional(),
  dueBefore: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  dueAfter: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

function mapPriorityFilter(priority: string | undefined): Priority | undefined {
  if (!priority || priority === 'all') return undefined;
  const mapping: Record<string, Priority> = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
    urgent: 'URGENT',
  };
  return mapping[priority.toLowerCase()];
}

function mapStatusFilter(status: string | undefined): TaskStatus | undefined {
  if (!status || status === 'all') return undefined;
  const mapping: Record<string, TaskStatus> = {
    pending: 'PENDING',
    in_progress: 'IN_PROGRESS',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
  };
  return mapping[status.toLowerCase()];
}

// =============================================================================
// Controllers
// =============================================================================

/**
 * List user tasks with optional filtering
 * GET /api/tasks
 */
export async function listTasks(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const query = listTasksQuerySchema.parse(req.query);

    const {
      status,
      priority,
      dueBefore,
      dueAfter,
      limit = 50,
      offset = 0,
    } = query;

    // Build filter conditions
    const where: Record<string, unknown> = {
      userId,
    };

    const mappedStatus = mapStatusFilter(status);
    if (mappedStatus) {
      where.status = mappedStatus;
    }

    const mappedPriority = mapPriorityFilter(priority);
    if (mappedPriority) {
      where.priority = mappedPriority;
    }

    if (dueBefore || dueAfter) {
      where.dueDate = {};
      if (dueBefore) {
        (where.dueDate as Record<string, Date>).lte = new Date(dueBefore);
      }
      if (dueAfter) {
        (where.dueDate as Record<string, Date>).gte = new Date(dueAfter);
      }
    }

    // Get total count
    const total = await prisma.task.count({ where });

    // Get tasks
    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // Pending first
        { priority: 'desc' }, // Higher priority first
        { dueDate: 'asc' }, // Earlier due dates first
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
    });

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + tasks.length < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single task by ID
 * GET /api/tasks/:id
 */
export async function getTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const taskId = req.params.id as string;

    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new task
 * POST /api/tasks
 */
export async function createTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const body = createTaskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        userId,
        title: body.title,
        description: body.description,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        priority: body.priority || 'MEDIUM',
        source: body.source,
        sourceId: body.sourceId,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing task
 * PATCH /api/tasks/:id
 */
export async function updateTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const taskId = req.params.id as string;
    const body = updateTaskSchema.parse(req.body);

    // Verify task exists and belongs to user
    const existingTask = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!existingTask) {
      throw new NotFoundError('Task not found');
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.status !== undefined) {
      updateData.status = body.status;
      // Set completedAt if marking as completed
      if (body.status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
        updateData.completedAt = new Date();
      } else if (body.status !== 'COMPLETED') {
        updateData.completedAt = null;
      }
    }
    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a task
 * DELETE /api/tasks/:id
 */
export async function deleteTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const taskId = req.params.id as string;

    // Verify task exists and belongs to user
    const existingTask = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!existingTask) {
      throw new NotFoundError('Task not found');
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    res.json({
      success: true,
      data: { deleted: taskId },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Bulk update task statuses
 * POST /api/tasks/bulk-update
 */
export async function bulkUpdateTasks(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    
    const bodySchema = z.object({
      taskIds: z.array(z.string()).min(1).max(100),
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    });
    
    const { taskIds, status } = bodySchema.parse(req.body);

    // Verify all tasks belong to user
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, userId },
      select: { id: true },
    });

    if (tasks.length !== taskIds.length) {
      throw new BadRequestError('Some tasks not found or do not belong to you');
    }

    // Update all tasks
    const updateData: Record<string, unknown> = { status };
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }

    await prisma.task.updateMany({
      where: { id: { in: taskIds }, userId },
      data: updateData,
    });

    res.json({
      success: true,
      data: { updated: taskIds.length },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get task statistics
 * GET /api/tasks/stats
 */
export async function getTaskStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    // Get counts by status
    const [pending, inProgress, completed, cancelled] = await Promise.all([
      prisma.task.count({ where: { userId, status: 'PENDING' } }),
      prisma.task.count({ where: { userId, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.task.count({ where: { userId, status: 'CANCELLED' } }),
    ]);

    // Get overdue tasks count
    const overdue = await prisma.task.count({
      where: {
        userId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() },
      },
    });

    // Get due today count
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const dueToday = await prisma.task.count({
      where: {
        userId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Get high priority pending count
    const highPriority = await prisma.task.count({
      where: {
        userId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        priority: { in: ['HIGH', 'URGENT'] },
      },
    });

    res.json({
      success: true,
      data: {
        byStatus: {
          pending,
          inProgress,
          completed,
          cancelled,
        },
        overdue,
        dueToday,
        highPriority,
        total: pending + inProgress + completed + cancelled,
      },
    });
  } catch (error) {
    next(error);
  }
}

export default {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  bulkUpdateTasks,
  getTaskStats,
};
