// =============================================================================
// Timezone Utility Tests
// =============================================================================

import {
  hasTimezoneInfo,
  getTimezoneOffsetMs,
  parseInTimezone,
  isValidTimezone,
} from '../utils/timezone';
import { TOOL_HANDLERS } from '../services/ai/tools';
import type { User } from '@prisma/client';

// Mock the database and Google services so tool handlers can be tested in isolation
jest.mock('../config/database', () => ({
  prisma: {
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../services/google/calendar.service', () => ({
  createEvent: jest.fn(),
  checkConflicts: jest.fn(),
}));

import { prisma } from '../config/database';
import * as calendar from '../services/google/calendar.service';

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  timezone: 'Asia/Hong_Kong',
} as User;

describe('timezone utils', () => {
  describe('hasTimezoneInfo', () => {
    it('detects Z suffix', () => {
      expect(hasTimezoneInfo('2026-07-24T14:00:00Z')).toBe(true);
    });

    it('detects +HH:MM offset', () => {
      expect(hasTimezoneInfo('2026-07-24T14:00:00+08:00')).toBe(true);
    });

    it('detects -HHMM offset', () => {
      expect(hasTimezoneInfo('2026-07-24T14:00:00-0500')).toBe(true);
    });

    it('returns false for naive local time', () => {
      expect(hasTimezoneInfo('2026-07-24T14:00:00')).toBe(false);
      expect(hasTimezoneInfo('2026-07-24T14:00')).toBe(false);
      expect(hasTimezoneInfo('2026-07-24')).toBe(false);
    });
  });

  describe('getTimezoneOffsetMs', () => {
    it('returns +8h for Asia/Hong_Kong (no DST)', () => {
      const date = new Date('2026-07-24T06:00:00Z');
      const offset = getTimezoneOffsetMs('Asia/Hong_Kong', date);
      expect(offset).toBe(8 * 60 * 60 * 1000);
    });

    it('handles DST timezones', () => {
      // New York is UTC-4 in July (EDT)
      const summer = new Date('2026-07-24T12:00:00Z');
      expect(getTimezoneOffsetMs('America/New_York', summer)).toBe(-4 * 60 * 60 * 1000);

      // New York is UTC-5 in January (EST)
      const winter = new Date('2026-01-24T12:00:00Z');
      expect(getTimezoneOffsetMs('America/New_York', winter)).toBe(-5 * 60 * 60 * 1000);
    });

    it('returns 0 for UTC', () => {
      const date = new Date('2026-07-24T06:00:00Z');
      expect(getTimezoneOffsetMs('UTC', date)).toBe(0);
    });

    it('returns 0 for invalid timezone', () => {
      const date = new Date('2026-07-24T06:00:00Z');
      expect(getTimezoneOffsetMs('Not/AZone', date)).toBe(0);
    });
  });

  describe('parseInTimezone', () => {
    it('anchors naive local time to the given timezone', () => {
      // 14:00 in Asia/Hong_Kong (+08:00) == 06:00 UTC
      const result = parseInTimezone('2026-07-24T14:00:00', 'Asia/Hong_Kong');
      expect(result.toISOString()).toBe('2026-07-24T06:00:00.000Z');
    });

    it('anchors naive local time to a negative-offset timezone', () => {
      // 14:00 in America/New_York (-04:00 in July) == 18:00 UTC
      const result = parseInTimezone('2026-07-24T14:00:00', 'America/New_York');
      expect(result.toISOString()).toBe('2026-07-24T18:00:00.000Z');
    });

    it('respects explicit Z suffix', () => {
      const result = parseInTimezone('2026-07-24T14:00:00Z', 'Asia/Hong_Kong');
      expect(result.toISOString()).toBe('2026-07-24T14:00:00.000Z');
    });

    it('respects explicit offset', () => {
      const result = parseInTimezone('2026-07-24T14:00:00+08:00', 'America/New_York');
      expect(result.toISOString()).toBe('2026-07-24T06:00:00.000Z');
    });

    it('falls back to native parsing for invalid timezone', () => {
      const result = parseInTimezone('2026-07-24T14:00:00Z', 'Not/AZone');
      expect(result.toISOString()).toBe('2026-07-24T14:00:00.000Z');
    });

    it('returns Invalid Date for garbage input', () => {
      const result = parseInTimezone('not-a-date', 'Asia/Hong_Kong');
      expect(isNaN(result.getTime())).toBe(true);
    });
  });

  describe('isValidTimezone', () => {
    it('accepts valid IANA timezones', () => {
      expect(isValidTimezone('Asia/Hong_Kong')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('rejects invalid timezones', () => {
      expect(isValidTimezone('Not/AZone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone(null)).toBe(false);
      expect(isValidTimezone(undefined)).toBe(false);
    });
  });
});

// =============================================================================
// LLM Tool Timezone Regression Tests
// =============================================================================

describe('LLM tool timezone handling (create_calendar_event)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('anchors naive LLM local time to the user timezone before creating the event', async () => {
    const mockEvent = { id: 'evt-1', title: 'Meeting' };
    (calendar.createEvent as jest.Mock).mockResolvedValue(mockEvent);

    // LLM sends naive local time: 2:00 PM on 2026-07-24 (user is in Asia/Hong_Kong, UTC+8)
    const result = await TOOL_HANDLERS.create_calendar_event(
      {
        title: 'Team Meeting',
        startTime: '2026-07-24T14:00:00',
        endTime: '2026-07-24T15:00:00',
      },
      { user: mockUser }
    );

    expect(result.success).toBe(true);
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);

    const [userId, input] = (calendar.createEvent as jest.Mock).mock.calls[0];
    expect(userId).toBe('user-1');

    // 14:00 HKT == 06:00 UTC — this is the critical regression assertion
    expect(input.startTime.toISOString()).toBe('2026-07-24T06:00:00.000Z');
    expect(input.endTime.toISOString()).toBe('2026-07-24T07:00:00.000Z');

    // The user timezone must be forwarded so Google Calendar displays the event
    // in the correct local timezone
    expect(input.timezone).toBe('Asia/Hong_Kong');
  });

  it('respects explicit timezone offset provided by the LLM', async () => {
    (calendar.createEvent as jest.Mock).mockResolvedValue({ id: 'evt-2' });

    // LLM sends an explicit UTC offset
    const result = await TOOL_HANDLERS.create_calendar_event(
      {
        title: 'Call',
        startTime: '2026-07-24T14:00:00+08:00',
        endTime: '2026-07-24T15:00:00+08:00',
      },
      { user: mockUser }
    );

    expect(result.success).toBe(true);
    const [, input] = (calendar.createEvent as jest.Mock).mock.calls[0];
    expect(input.startTime.toISOString()).toBe('2026-07-24T06:00:00.000Z');
    expect(input.endTime.toISOString()).toBe('2026-07-24T07:00:00.000Z');
  });

  it('respects explicit Z (UTC) suffix provided by the LLM', async () => {
    (calendar.createEvent as jest.Mock).mockResolvedValue({ id: 'evt-3' });

    const result = await TOOL_HANDLERS.create_calendar_event(
      {
        title: 'UTC Event',
        startTime: '2026-07-24T06:00:00Z',
        endTime: '2026-07-24T07:00:00Z',
      },
      { user: mockUser }
    );

    expect(result.success).toBe(true);
    const [, input] = (calendar.createEvent as jest.Mock).mock.calls[0];
    expect(input.startTime.toISOString()).toBe('2026-07-24T06:00:00.000Z');
    expect(input.endTime.toISOString()).toBe('2026-07-24T07:00:00.000Z');
  });

  it('falls back to UTC when user timezone is not set', async () => {
    (calendar.createEvent as jest.Mock).mockResolvedValue({ id: 'evt-4' });

    const utcUser = { ...mockUser, timezone: 'UTC' } as User;
    const result = await TOOL_HANDLERS.create_calendar_event(
      {
        title: 'UTC User Event',
        startTime: '2026-07-24T14:00:00',
        endTime: '2026-07-24T15:00:00',
      },
      { user: utcUser }
    );

    expect(result.success).toBe(true);
    const [, input] = (calendar.createEvent as jest.Mock).mock.calls[0];
    // Naive time interpreted as UTC stays as-is
    expect(input.startTime.toISOString()).toBe('2026-07-24T14:00:00.000Z');
    expect(input.timezone).toBe('UTC');
  });
});

describe('LLM tool timezone handling (check_calendar_conflicts)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('anchors naive conflict-check range to the user timezone', async () => {
    (calendar.checkConflicts as jest.Mock).mockResolvedValue([]);

    const result = await TOOL_HANDLERS.check_calendar_conflicts(
      {
        startTime: '2026-07-24T09:00:00',
        endTime: '2026-07-24T10:00:00',
      },
      { user: mockUser }
    );

    expect(result.success).toBe(true);
    const [, startTime, endTime] = (calendar.checkConflicts as jest.Mock).mock.calls[0];
    // 09:00 HKT == 01:00 UTC
    expect(startTime.toISOString()).toBe('2026-07-24T01:00:00.000Z');
    expect(endTime.toISOString()).toBe('2026-07-24T02:00:00.000Z');
  });
});

describe('LLM tool timezone handling (create_task)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('anchors naive due date to the user timezone', async () => {
    const mockTask = { id: 'task-1', title: 'Submit report' };
    (prisma.task.create as jest.Mock).mockResolvedValue(mockTask);

    const result = await TOOL_HANDLERS.create_task(
      {
        title: 'Submit report',
        dueDate: '2026-07-25T09:00:00',
      },
      { user: mockUser }
    );

    expect(result.success).toBe(true);
    const createCall = (prisma.task.create as jest.Mock).mock.calls[0][0];
    // 09:00 HKT == 01:00 UTC
    expect(createCall.data.dueDate.toISOString()).toBe('2026-07-25T01:00:00.000Z');
  });
});
