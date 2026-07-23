import { google, calendar_v3 } from 'googleapis';
import { Auth } from 'googleapis';
import { CachedEvent, EventStatus } from '@prisma/client';
import prisma from '../../config/database.js';
import { getAuthenticatedGoogleClient } from '../auth.service.js';

// =============================================================================
// Types
// =============================================================================

export interface EventListOptions {
  maxResults?: number;
  timeMin?: Date;
  timeMax?: Date;
  singleEvents?: boolean;
  orderBy?: 'startTime' | 'updated';
  pageToken?: string;
  calendarId?: string;
}

export interface EventListResult {
  events: CachedEvent[];
  nextPageToken: string | null;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  timezone?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  attendees?: string[];
}

export interface EventDetails {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  timezone: string | null;
  attendees: Array<{
    email: string;
    name?: string;
    responseStatus?: string;
  }>;
  organizer: string | null;
  status: EventStatus;
  meetingLink: string | null;
  recurringEventId: string | null;
}

export interface CalendarSyncResult {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export interface TimeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: CachedEvent[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create Calendar API client from OAuth2 client
 */
function createCalendarClient(auth: Auth.OAuth2Client): calendar_v3.Calendar {
  return google.calendar({ version: 'v3', auth });
}

/**
 * Map Google Calendar event status to our EventStatus enum
 */
function mapEventStatus(status: string | undefined): EventStatus {
  switch (status?.toLowerCase()) {
    case 'confirmed':
      return 'CONFIRMED';
    case 'tentative':
      return 'TENTATIVE';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'CONFIRMED';
  }
}

/**
 * Extract meeting link from Google Calendar event
 */
function extractMeetingLink(event: calendar_v3.Schema$Event): string | null {
  // Check various common meeting link locations
  if (event.hangoutLink) {
    return event.hangoutLink;
  }

  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      ep => ep.entryPointType === 'video'
    );
    if (videoEntry?.uri) {
      return videoEntry.uri;
    }
  }

  // Check for Zoom/Teams links in location or description
  const zoomRegex = /https:\/\/[\w-]*\.?zoom\.us\/[^\s"<>]+/;
  const teamsRegex = /https:\/\/teams\.microsoft\.com\/[^\s"<>]+/;
  const meetRegex = /https:\/\/meet\.google\.com\/[^\s"<>]+/;

  for (const regex of [zoomRegex, teamsRegex, meetRegex]) {
    const locationMatch = event.location?.match(regex);
    if (locationMatch) return locationMatch[0];

    const descMatch = event.description?.match(regex);
    if (descMatch) return descMatch[0];
  }

  return null;
}

/**
 * Parse Google Calendar event to EventDetails
 */
function parseCalendarEvent(event: calendar_v3.Schema$Event): EventDetails {
  // Handle all-day events vs timed events
  const isAllDay = !!(event.start?.date && !event.start.dateTime);

  let startTime: Date;
  let endTime: Date;
  let timezone: string | null = null;

  if (isAllDay) {
    // All-day events use 'date' field (YYYY-MM-DD)
    startTime = new Date(event.start?.date || '');
    endTime = new Date(event.end?.date || '');
  } else {
    // Timed events use 'dateTime' field
    startTime = new Date(event.start?.dateTime || '');
    endTime = new Date(event.end?.dateTime || '');
    timezone = event.start?.timeZone || null;
  }

  // Parse attendees
  const attendees = (event.attendees || []).map(attendee => ({
    email: attendee.email || '',
    name: attendee.displayName || undefined,
    responseStatus: attendee.responseStatus || undefined,
  }));

  return {
    id: event.id || '',
    title: event.summary || '(No Title)',
    description: event.description || null,
    location: event.location || null,
    startTime,
    endTime,
    isAllDay,
    timezone,
    attendees,
    organizer: event.organizer?.email || null,
    status: mapEventStatus(event.status ?? undefined),
    meetingLink: extractMeetingLink(event),
    recurringEventId: event.recurringEventId || null,
  };
}

// =============================================================================
// Calendar Service
// =============================================================================

/**
 * List calendar events with caching
 */
export async function listEvents(
  userId: string,
  options: EventListOptions = {}
): Promise<EventListResult> {
  const {
    maxResults = 20,
    timeMin = new Date(),
    timeMax,
    singleEvents = true,
    orderBy = 'startTime',
    pageToken,
    calendarId = 'primary',
  } = options;

  const auth = await getAuthenticatedGoogleClient(userId);
  const calendar = createCalendarClient(auth);

  // Calculate default timeMax if not provided (7 days from now)
  const effectiveTimeMax = timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Fetch events from Google Calendar
  const listResponse = await calendar.events.list({
    calendarId,
    maxResults,
    timeMin: timeMin.toISOString(),
    timeMax: effectiveTimeMax.toISOString(),
    singleEvents,
    orderBy: singleEvents ? orderBy : undefined,
    pageToken: pageToken || undefined,
  });

  const googleEvents = listResponse.data.items || [];
  const cachedEvents: CachedEvent[] = [];

  // Process and cache each event
  for (const googleEvent of googleEvents) {
    if (!googleEvent.id) continue;

    const eventDetails = parseCalendarEvent(googleEvent);

    // Upsert to cache
    const cachedEvent = await prisma.cachedEvent.upsert({
      where: { calendarId: eventDetails.id },
      update: {
        title: eventDetails.title,
        description: eventDetails.description,
        location: eventDetails.location,
        startTime: eventDetails.startTime,
        endTime: eventDetails.endTime,
        isAllDay: eventDetails.isAllDay,
        timezone: eventDetails.timezone,
        attendees: eventDetails.attendees as Parameters<typeof prisma.cachedEvent.update>[0]['data']['attendees'],
        organizer: eventDetails.organizer,
        status: eventDetails.status,
        meetingLink: eventDetails.meetingLink,
        recurringEventId: eventDetails.recurringEventId,
        cachedAt: new Date(),
      },
      create: {
        userId,
        calendarId: eventDetails.id,
        recurringEventId: eventDetails.recurringEventId,
        title: eventDetails.title,
        description: eventDetails.description,
        location: eventDetails.location,
        startTime: eventDetails.startTime,
        endTime: eventDetails.endTime,
        isAllDay: eventDetails.isAllDay,
        timezone: eventDetails.timezone,
        attendees: eventDetails.attendees as Parameters<typeof prisma.cachedEvent.create>[0]['data']['attendees'],
        organizer: eventDetails.organizer,
        status: eventDetails.status,
        meetingLink: eventDetails.meetingLink,
      },
    });

    cachedEvents.push(cachedEvent);
  }

  return {
    events: cachedEvents,
    nextPageToken: listResponse.data.nextPageToken || null,
  };
}

/**
 * Get a single event by Calendar ID
 */
export async function getEvent(
  userId: string,
  eventId: string,
  calendarId: string = 'primary'
): Promise<CachedEvent | null> {
  // Check cache first
  let cachedEvent = await prisma.cachedEvent.findUnique({
    where: { calendarId: eventId },
  });

  if (cachedEvent) {
    return cachedEvent;
  }

  // Fetch from Calendar API
  const auth = await getAuthenticatedGoogleClient(userId);
  const calendar = createCalendarClient(auth);

  try {
    const response = await calendar.events.get({
      calendarId,
      eventId,
    });

    const eventDetails = parseCalendarEvent(response.data);

    // Cache the event
    cachedEvent = await prisma.cachedEvent.create({
      data: {
        userId,
        calendarId: eventDetails.id,
        recurringEventId: eventDetails.recurringEventId,
        title: eventDetails.title,
        description: eventDetails.description,
        location: eventDetails.location,
        startTime: eventDetails.startTime,
        endTime: eventDetails.endTime,
        isAllDay: eventDetails.isAllDay,
        timezone: eventDetails.timezone,
        attendees: eventDetails.attendees as Parameters<typeof prisma.cachedEvent.create>[0]['data']['attendees'],
        organizer: eventDetails.organizer,
        status: eventDetails.status,
        meetingLink: eventDetails.meetingLink,
      },
    });

    return cachedEvent;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as { code?: number }).code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a new calendar event
 */
export async function createEvent(
  userId: string,
  input: CreateEventInput,
  calendarId: string = 'primary'
): Promise<CachedEvent> {
  const auth = await getAuthenticatedGoogleClient(userId);
  const calendar = createCalendarClient(auth);

  // Build Google Calendar event
  const eventResource: calendar_v3.Schema$Event = {
    summary: input.title,
    description: input.description,
    location: input.location,
    start: {
      dateTime: input.startTime.toISOString(),
      timeZone: input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    },
    end: {
      dateTime: input.endTime.toISOString(),
      timeZone: input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    },
  };

  // Add attendees if provided
  if (input.attendees && input.attendees.length > 0) {
    eventResource.attendees = input.attendees.map(email => ({ email }));
  }

  // Create event in Google Calendar
  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventResource,
    conferenceDataVersion: 1, // Enable Google Meet link generation
    sendUpdates: 'all', // Send invites to attendees
  });

  const eventDetails = parseCalendarEvent(response.data);

  // Cache the created event
  const cachedEvent = await prisma.cachedEvent.create({
    data: {
      userId,
      calendarId: eventDetails.id,
      recurringEventId: eventDetails.recurringEventId,
      title: eventDetails.title,
      description: eventDetails.description,
      location: eventDetails.location,
      startTime: eventDetails.startTime,
      endTime: eventDetails.endTime,
      isAllDay: eventDetails.isAllDay,
      timezone: eventDetails.timezone,
      attendees: eventDetails.attendees as Parameters<typeof prisma.cachedEvent.create>[0]['data']['attendees'],
      organizer: eventDetails.organizer,
      status: eventDetails.status,
      meetingLink: eventDetails.meetingLink,
    },
  });

  return cachedEvent;
}

/**
 * Update an existing calendar event
 */
export async function updateEvent(
  userId: string,
  eventId: string,
  input: UpdateEventInput,
  calendarId: string = 'primary'
): Promise<CachedEvent> {
  const auth = await getAuthenticatedGoogleClient(userId);
  const calendar = createCalendarClient(auth);

  // First get the existing event
  const existingResponse = await calendar.events.get({
    calendarId,
    eventId,
  });

  const eventResource: calendar_v3.Schema$Event = {
    ...existingResponse.data,
  };

  // Apply updates
  if (input.title !== undefined) {
    eventResource.summary = input.title;
  }
  if (input.description !== undefined) {
    eventResource.description = input.description;
  }
  if (input.location !== undefined) {
    eventResource.location = input.location;
  }
  if (input.startTime !== undefined) {
    eventResource.start = {
      dateTime: input.startTime.toISOString(),
      timeZone: existingResponse.data.start?.timeZone || 'UTC',
    };
  }
  if (input.endTime !== undefined) {
    eventResource.end = {
      dateTime: input.endTime.toISOString(),
      timeZone: existingResponse.data.end?.timeZone || 'UTC',
    };
  }
  if (input.attendees !== undefined) {
    eventResource.attendees = input.attendees.map(email => ({ email }));
  }

  // Update event in Google Calendar
  const response = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: eventResource,
    sendUpdates: 'all',
  });

  const eventDetails = parseCalendarEvent(response.data);

  // Update cache
  const cachedEvent = await prisma.cachedEvent.upsert({
    where: { calendarId: eventDetails.id },
    update: {
      title: eventDetails.title,
      description: eventDetails.description,
      location: eventDetails.location,
      startTime: eventDetails.startTime,
      endTime: eventDetails.endTime,
      isAllDay: eventDetails.isAllDay,
      timezone: eventDetails.timezone,
      attendees: eventDetails.attendees as Parameters<typeof prisma.cachedEvent.update>[0]['data']['attendees'],
      organizer: eventDetails.organizer,
      status: eventDetails.status,
      meetingLink: eventDetails.meetingLink,
      cachedAt: new Date(),
    },
    create: {
      userId,
      calendarId: eventDetails.id,
      recurringEventId: eventDetails.recurringEventId,
      title: eventDetails.title,
      description: eventDetails.description,
      location: eventDetails.location,
      startTime: eventDetails.startTime,
      endTime: eventDetails.endTime,
      isAllDay: eventDetails.isAllDay,
      timezone: eventDetails.timezone,
      attendees: eventDetails.attendees as Parameters<typeof prisma.cachedEvent.create>[0]['data']['attendees'],
      organizer: eventDetails.organizer,
      status: eventDetails.status,
      meetingLink: eventDetails.meetingLink,
    },
  });

  return cachedEvent;
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(
  userId: string,
  eventId: string,
  calendarId: string = 'primary'
): Promise<void> {
  const auth = await getAuthenticatedGoogleClient(userId);
  const calendar = createCalendarClient(auth);

  // Delete from Google Calendar
  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates: 'all',
  });

  // Delete from cache
  await prisma.cachedEvent.deleteMany({
    where: { calendarId: eventId },
  });
}

/**
 * Sync calendar events from Google Calendar to local cache
 */
export async function syncEvents(
  userId: string,
  daysAhead: number = 30
): Promise<CalendarSyncResult> {
  const result: CalendarSyncResult = {
    synced: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  try {
    const auth = await getAuthenticatedGoogleClient(userId);
    const calendar = createCalendarClient(auth);

    const timeMin = new Date();
    const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

    // Get all events from Google Calendar
    let pageToken: string | undefined;
    const allGoogleEventIds: string[] = [];

    do {
      const response = await calendar.events.list({
        calendarId: 'primary',
        maxResults: 100,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        pageToken,
      });

      const googleEvents = response.data.items || [];

      for (const googleEvent of googleEvents) {
        if (!googleEvent.id) continue;
        allGoogleEventIds.push(googleEvent.id);

        try {
          const eventDetails = parseCalendarEvent(googleEvent);

          const existing = await prisma.cachedEvent.findUnique({
            where: { calendarId: eventDetails.id },
          });

          if (existing) {
            await prisma.cachedEvent.update({
              where: { calendarId: eventDetails.id },
              data: {
                title: eventDetails.title,
                description: eventDetails.description,
                location: eventDetails.location,
                startTime: eventDetails.startTime,
                endTime: eventDetails.endTime,
                isAllDay: eventDetails.isAllDay,
                timezone: eventDetails.timezone,
                attendees: eventDetails.attendees as Parameters<typeof prisma.cachedEvent.update>[0]['data']['attendees'],
                organizer: eventDetails.organizer,
                status: eventDetails.status,
                meetingLink: eventDetails.meetingLink,
                cachedAt: new Date(),
              },
            });
            result.updated++;
          } else {
            await prisma.cachedEvent.create({
              data: {
                userId,
                calendarId: eventDetails.id,
                recurringEventId: eventDetails.recurringEventId,
                title: eventDetails.title,
                description: eventDetails.description,
                location: eventDetails.location,
                startTime: eventDetails.startTime,
                endTime: eventDetails.endTime,
                isAllDay: eventDetails.isAllDay,
                timezone: eventDetails.timezone,
                attendees: eventDetails.attendees as Parameters<typeof prisma.cachedEvent.create>[0]['data']['attendees'],
                organizer: eventDetails.organizer,
                status: eventDetails.status,
                meetingLink: eventDetails.meetingLink,
              },
            });
            result.created++;
          }

          result.synced++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to sync event ${googleEvent.id}: ${errorMessage}`);
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    // Delete cached events that no longer exist in Google Calendar
    // (only for events within the sync time range)
    const cachedEvents = await prisma.cachedEvent.findMany({
      where: {
        userId,
        startTime: {
          gte: timeMin,
          lte: timeMax,
        },
      },
    });

    for (const cached of cachedEvents) {
      if (!allGoogleEventIds.includes(cached.calendarId)) {
        await prisma.cachedEvent.delete({
          where: { id: cached.id },
        });
        result.deleted++;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Sync failed: ${errorMessage}`);
  }

  return result;
}

/**
 * Get cached events from database (without calling Calendar API)
 */
export async function getCachedEvents(
  userId: string,
  options: {
    limit?: number;
    startAfter?: Date;
    startBefore?: Date;
    includeAllDay?: boolean;
  } = {}
): Promise<CachedEvent[]> {
  const {
    limit = 20,
    startAfter = new Date(),
    startBefore,
    includeAllDay = true,
  } = options;

  // Build where clause
  const where: {
    userId: string;
    startTime?: { gte?: Date; lte?: Date };
    isAllDay?: boolean;
    status?: EventStatus;
    isDismissed?: boolean;
  } = {
    userId,
    startTime: {
      gte: startAfter,
    },
    status: 'CONFIRMED', // Only get confirmed events
    isDismissed: false, // Filter out dismissed events
  };

  if (startBefore) {
    where.startTime = { ...where.startTime, lte: startBefore };
  }

  if (!includeAllDay) {
    where.isAllDay = false;
  }

  return prisma.cachedEvent.findMany({
    where,
    orderBy: { startTime: 'asc' },
    take: limit,
  });
}

/**
 * Update AI analysis for an event
 */
export async function updateEventAnalysis(
  calendarId: string,
  analysis: {
    aiSummary?: string;
    aiPrepNotes?: string;
    aiActionItems?: unknown[];
  }
): Promise<CachedEvent> {
  return prisma.cachedEvent.update({
    where: { calendarId },
    data: {
      aiSummary: analysis.aiSummary,
      aiPrepNotes: analysis.aiPrepNotes,
      aiActionItems: analysis.aiActionItems as Parameters<typeof prisma.cachedEvent.update>[0]['data']['aiActionItems'],
      analyzedAt: new Date(),
    },
  });
}

/**
 * Check for calendar conflicts in a time range
 */
export async function checkConflicts(
  userId: string,
  startTime: Date,
  endTime: Date
): Promise<ConflictCheckResult> {
  // First, sync to ensure we have latest data
  await listEvents(userId, {
    timeMin: new Date(startTime.getTime() - 24 * 60 * 60 * 1000), // Day before
    timeMax: new Date(endTime.getTime() + 24 * 60 * 60 * 1000), // Day after
  });

  // Find overlapping events
  const conflicts = await prisma.cachedEvent.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      OR: [
        // Event starts during the time range
        {
          startTime: {
            gte: startTime,
            lt: endTime,
          },
        },
        // Event ends during the time range
        {
          endTime: {
            gt: startTime,
            lte: endTime,
          },
        },
        // Event spans the entire time range
        {
          startTime: {
            lte: startTime,
          },
          endTime: {
            gte: endTime,
          },
        },
      ],
    },
    orderBy: { startTime: 'asc' },
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Find available focus time blocks
 */
export async function findFocusTime(
  userId: string,
  options: {
    daysAhead?: number;
    minBlockMinutes?: number;
    startHour?: number;
    endHour?: number;
  } = {}
): Promise<TimeSlot[]> {
  const {
    daysAhead = 5,
    minBlockMinutes = 60,
    startHour = 9, // 9 AM
    endHour = 17, // 5 PM
  } = options;

  // Get events for the time range
  const timeMin = new Date();
  const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

  // Ensure we have latest events
  await listEvents(userId, { timeMin, timeMax, maxResults: 100 });

  const events = await prisma.cachedEvent.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      startTime: { gte: timeMin, lte: timeMax },
    },
    orderBy: { startTime: 'asc' },
  });

  const focusSlots: TimeSlot[] = [];

  // Iterate through each day in the range
  for (let day = 0; day < daysAhead; day++) {
    const dayStart = new Date(timeMin);
    dayStart.setDate(dayStart.getDate() + day);
    dayStart.setHours(startHour, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(endHour, 0, 0, 0);

    // Skip weekends
    const dayOfWeek = dayStart.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Get events for this day
    const dayEvents = events.filter(e => {
      const start = new Date(e.startTime);
      return (
        start.getDate() === dayStart.getDate() &&
        start.getMonth() === dayStart.getMonth() &&
        start.getFullYear() === dayStart.getFullYear()
      );
    });

    // Sort by start time
    dayEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Find gaps between events
    let currentTime = dayStart;

    for (const event of dayEvents) {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);

      // Only consider events within work hours
      if (eventStart > dayEnd) continue;
      if (eventEnd < dayStart) continue;

      // Check for gap before this event
      if (eventStart > currentTime) {
        const gapEnd = eventStart < dayEnd ? eventStart : dayEnd;
        const gapMinutes = (gapEnd.getTime() - currentTime.getTime()) / (1000 * 60);

        if (gapMinutes >= minBlockMinutes) {
          focusSlots.push({
            start: new Date(currentTime),
            end: gapEnd,
            durationMinutes: gapMinutes,
          });
        }
      }

      // Move current time to after this event
      if (eventEnd > currentTime) {
        currentTime = eventEnd;
      }
    }

    // Check for gap after last event until end of day
    if (currentTime < dayEnd) {
      const gapMinutes = (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60);

      if (gapMinutes >= minBlockMinutes) {
        focusSlots.push({
          start: new Date(currentTime),
          end: dayEnd,
          durationMinutes: gapMinutes,
        });
      }
    }
  }

  return focusSlots;
}

/**
 * Get today's events for quick access
 */
export async function getTodaysEvents(userId: string): Promise<CachedEvent[]> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  // Sync events for today to ensure cache is up to date
  await syncEvents(userId, 1); // Sync 1 day ahead

  return prisma.cachedEvent.findMany({
    where: {
      userId,
      startTime: { gte: startOfDay, lte: endOfDay },
      status: 'CONFIRMED',
      isDismissed: false,
    },
    orderBy: { startTime: 'asc' },
  });
}

/**
 * Dismiss a calendar event
 */
export async function dismissEvent(userId: string, calendarId: string): Promise<void> {
  await prisma.cachedEvent.update({
    where: { calendarId },
    data: { isDismissed: true },
  });
}

export default {
  listEvents,
  dismissEvent,
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
};
