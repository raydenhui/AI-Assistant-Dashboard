/**
 * Google Services Module
 * Exports Gmail and Calendar service functions
 */

// Gmail exports
export {
  type EmailListOptions,
  type EmailListResult,
  type EmailDetails,
  type EmailSyncResult,
  listEmails,
  getEmail,
  getThread,
  searchEmails,
  syncEmails,
  getCachedEmails,
  updateEmailAnalysis,
  getPrioritizedEmails,
  default as gmailService,
} from './gmail.service.js';

// Calendar exports
export {
  type EventListOptions,
  type EventListResult,
  type CreateEventInput,
  type UpdateEventInput,
  type EventDetails,
  type CalendarSyncResult,
  type TimeSlot,
  type ConflictCheckResult,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  syncEvents,
  getCachedEvents,
  updateEventAnalysis,
  checkConflicts,
  findFocusTime,
  getTodaysEvents,
  default as calendarService,
} from './calendar.service.js';
