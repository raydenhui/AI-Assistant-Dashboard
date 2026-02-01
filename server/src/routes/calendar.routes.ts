import { Router } from 'express';
import {
  getEvents,
  getTodaysEventList,
  getEventById,
  createNewEvent,
  updateExistingEvent,
  deleteExistingEvent,
  syncCalendarEvents,
  checkSchedulingConflicts,
  getFocusTimeSlots,
  dismissCalendarEvent,
} from '../controllers/calendar.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = Router();

// =============================================================================
// All calendar routes require authentication
// =============================================================================

/**
 * @route   GET /api/calendar/events
 * @desc    List calendar events
 * @access  Private
 * @query   maxResults, timeMin, timeMax, pageToken, cached
 */
router.get('/events', requireAuth, asyncHandler(getEvents));

/**
 * @route   GET /api/calendar/events/today
 * @desc    Get today's events
 * @access  Private
 */
router.get('/events/today', requireAuth, asyncHandler(getTodaysEventList));

/**
 * @route   GET /api/calendar/focus-time
 * @desc    Find available focus time blocks
 * @access  Private
 * @query   daysAhead, minBlockMinutes, startHour, endHour
 */
router.get('/focus-time', requireAuth, asyncHandler(getFocusTimeSlots));

/**
 * @route   POST /api/calendar/sync
 * @desc    Sync calendar events from Google Calendar
 * @access  Private
 * @body    { daysAhead }
 */
router.post('/sync', requireAuth, asyncHandler(syncCalendarEvents));

/**
 * @route   POST /api/calendar/check-conflicts
 * @desc    Check for scheduling conflicts
 * @access  Private
 * @body    { startTime, endTime }
 */
router.post('/check-conflicts', requireAuth, asyncHandler(checkSchedulingConflicts));

/**
 * @route   POST /api/calendar/events
 * @desc    Create a new calendar event
 * @access  Private
 * @body    { title, description, startTime, endTime, location, attendees, timezone }
 */
router.post('/events', requireAuth, asyncHandler(createNewEvent));

/**
 * @route   GET /api/calendar/events/:id
 * @desc    Get a single event by ID
 * @access  Private
 */
router.get('/events/:id', requireAuth, asyncHandler(getEventById));

/**
 * @route   PATCH /api/calendar/events/:id
 * @desc    Update an existing calendar event
 * @access  Private
 * @body    { title, description, startTime, endTime, location, attendees }
 */
router.patch('/events/:id', requireAuth, asyncHandler(updateExistingEvent));

/**
 * @route   DELETE /api/calendar/events/:id
 * @desc    Delete a calendar event
 * @access  Private
 */
router.delete('/events/:id', requireAuth, asyncHandler(deleteExistingEvent));

/**
 * @route   PATCH /api/calendar/events/:id/dismiss
 * @desc    Dismiss a calendar event
 * @access  Private
 */
router.patch('/events/:id/dismiss', requireAuth, asyncHandler(dismissCalendarEvent));

export default router;
