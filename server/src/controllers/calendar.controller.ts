import { Request, Response } from 'express';
import { CachedEvent } from '@prisma/client';
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  syncEvents,
  getCachedEvents,
  checkConflicts,
  findFocusTime,
  getTodaysEvents,
} from '../services/google/calendar.service.js';
import { BadRequestError, NotFoundError } from '../middleware/error.middleware.js';

/**
 * GET /api/calendar/events
 * List calendar events
 */
export async function getEvents(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const {
    maxResults = '20',
    timeMin,
    timeMax,
    pageToken,
    cached = 'false',
  } = req.query;

  // If requesting cached only, don't call Calendar API
  if (cached === 'true') {
    const events = await getCachedEvents(req.userId, {
      limit: parseInt(maxResults as string, 10),
      startAfter: timeMin ? new Date(timeMin as string) : undefined,
      startBefore: timeMax ? new Date(timeMax as string) : undefined,
    });

    res.json({
      success: true,
      data: {
        events: events.map(e => formatEventResponse(e)),
        nextPageToken: null,
      },
    });
    return;
  }

  const result = await listEvents(req.userId, {
    maxResults: parseInt(maxResults as string, 10),
    timeMin: timeMin ? new Date(timeMin as string) : undefined,
    timeMax: timeMax ? new Date(timeMax as string) : undefined,
    pageToken: pageToken as string | undefined,
  });

  res.json({
    success: true,
    data: {
      events: result.events.map(e => formatEventResponse(e)),
      nextPageToken: result.nextPageToken,
    },
  });
}

/**
 * GET /api/calendar/events/today
 * Get today's events
 */
export async function getTodaysEventList(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const events = await getTodaysEvents(req.userId);

  res.json({
    success: true,
    data: {
      date: new Date().toISOString().split('T')[0],
      events: events.map(e => formatEventResponse(e)),
      eventCount: events.length,
    },
  });
}

/**
 * GET /api/calendar/events/:id
 * Get a single event by ID
 */
export async function getEventById(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    throw new BadRequestError('Event ID is required');
  }

  const event = await getEvent(req.userId, id);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  res.json({
    success: true,
    data: formatEventResponse(event, true), // Include full details
  });
}

/**
 * POST /api/calendar/events
 * Create a new calendar event
 */
export async function createNewEvent(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const {
    title,
    description,
    startTime,
    endTime,
    location,
    attendees,
    timezone,
  } = req.body;

  // Validate required fields
  if (!title || typeof title !== 'string') {
    throw new BadRequestError('Event title is required');
  }
  if (!startTime) {
    throw new BadRequestError('Start time is required');
  }
  if (!endTime) {
    throw new BadRequestError('End time is required');
  }

  // Parse dates
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime())) {
    throw new BadRequestError('Invalid start time format');
  }
  if (isNaN(end.getTime())) {
    throw new BadRequestError('Invalid end time format');
  }
  if (end <= start) {
    throw new BadRequestError('End time must be after start time');
  }

  const event = await createEvent(req.userId, {
    title,
    description,
    startTime: start,
    endTime: end,
    location,
    attendees,
    timezone,
  });

  res.status(201).json({
    success: true,
    data: formatEventResponse(event, true),
  });
}

/**
 * PATCH /api/calendar/events/:id
 * Update an existing calendar event
 */
export async function updateExistingEvent(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    throw new BadRequestError('Event ID is required');
  }

  const { title, description, startTime, endTime, location, attendees } = req.body;

  // Build update input
  const updateInput: {
    title?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    location?: string;
    attendees?: string[];
  } = {};

  if (title !== undefined) updateInput.title = title;
  if (description !== undefined) updateInput.description = description;
  if (location !== undefined) updateInput.location = location;
  if (attendees !== undefined) updateInput.attendees = attendees;

  if (startTime !== undefined) {
    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      throw new BadRequestError('Invalid start time format');
    }
    updateInput.startTime = start;
  }

  if (endTime !== undefined) {
    const end = new Date(endTime);
    if (isNaN(end.getTime())) {
      throw new BadRequestError('Invalid end time format');
    }
    updateInput.endTime = end;
  }

  // Validate time order if both are provided
  if (updateInput.startTime && updateInput.endTime && updateInput.endTime <= updateInput.startTime) {
    throw new BadRequestError('End time must be after start time');
  }

  const event = await updateEvent(req.userId, id, updateInput);

  res.json({
    success: true,
    data: formatEventResponse(event, true),
  });
}

/**
 * DELETE /api/calendar/events/:id
 * Delete a calendar event
 */
export async function deleteExistingEvent(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    throw new BadRequestError('Event ID is required');
  }

  await deleteEvent(req.userId, id);

  res.json({
    success: true,
    data: {
      message: 'Event deleted successfully',
    },
  });
}

/**
 * POST /api/calendar/sync
 * Sync calendar events from Google Calendar
 */
export async function syncCalendarEvents(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { daysAhead = 30 } = req.body;

  const result = await syncEvents(req.userId, daysAhead);

  res.json({
    success: true,
    data: {
      synced: result.synced,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      errors: result.errors,
    },
  });
}

/**
 * POST /api/calendar/check-conflicts
 * Check for scheduling conflicts
 */
export async function checkSchedulingConflicts(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { startTime, endTime } = req.body;

  if (!startTime) {
    throw new BadRequestError('Start time is required');
  }
  if (!endTime) {
    throw new BadRequestError('End time is required');
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime())) {
    throw new BadRequestError('Invalid start time format');
  }
  if (isNaN(end.getTime())) {
    throw new BadRequestError('Invalid end time format');
  }

  const result = await checkConflicts(req.userId, start, end);

  res.json({
    success: true,
    data: {
      hasConflict: result.hasConflict,
      conflicts: result.conflicts.map(e => formatEventResponse(e)),
      conflictCount: result.conflicts.length,
    },
  });
}

/**
 * GET /api/calendar/focus-time
 * Find available focus time blocks
 */
export async function getFocusTimeSlots(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const {
    daysAhead = '5',
    minBlockMinutes = '60',
    startHour = '9',
    endHour = '17',
  } = req.query;

  const slots = await findFocusTime(req.userId, {
    daysAhead: parseInt(daysAhead as string, 10),
    minBlockMinutes: parseInt(minBlockMinutes as string, 10),
    startHour: parseInt(startHour as string, 10),
    endHour: parseInt(endHour as string, 10),
  });

  res.json({
    success: true,
    data: {
      slots: slots.map(slot => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        durationMinutes: slot.durationMinutes,
      })),
      slotCount: slots.length,
      totalMinutes: slots.reduce((sum, s) => sum + s.durationMinutes, 0),
    },
  });
}

/**
 * Format cached event for API response
 */
function formatEventResponse(
  event: CachedEvent,
  includeDetails: boolean = false
): Record<string, unknown> {
  const response: Record<string, unknown> = {
    id: event.calendarId,
    title: event.title,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    isAllDay: event.isAllDay,
    location: event.location,
    status: event.status,
    meetingLink: event.meetingLink,
  };

  // Include additional details if requested
  if (includeDetails) {
    response.description = event.description;
    response.attendees = event.attendees;
    response.organizer = event.organizer;
    response.timezone = event.timezone;
    response.recurringEventId = event.recurringEventId;
  }

  // Include AI analysis if available
  if (event.aiSummary || event.aiPrepNotes || event.aiActionItems) {
    response.analysis = {
      summary: event.aiSummary,
      prepNotes: event.aiPrepNotes,
      actionItems: event.aiActionItems,
      analyzedAt: event.analyzedAt?.toISOString(),
    };
  }

  return response;
}

export default {
  getEvents,
  getTodaysEventList,
  getEventById,
  createNewEvent,
  updateExistingEvent,
  deleteExistingEvent,
  syncCalendarEvents,
  checkSchedulingConflicts,
  getFocusTimeSlots,
};
