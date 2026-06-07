import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus, EVENTS } from '../../utils/events';

describe('EventEmitter (eventBus)', () => {
  beforeEach(() => {
    // Clear all listeners between tests by creating fresh listeners
    // We can do this by removing them via the returned unsubscribe functions
  });

  describe('on()', () => {
    it('registers a callback and calls it when the event is emitted', () => {
      const handler = vi.fn();
      eventBus.on(EVENTS.REFRESH_TASKS, handler);

      eventBus.emit(EVENTS.REFRESH_TASKS);

      expect(handler).toHaveBeenCalledTimes(1);

      // Cleanup
      eventBus.off(EVENTS.REFRESH_TASKS, handler);
    });

    it('passes data to the callback when emitted with data', () => {
      const handler = vi.fn();
      const payload = { count: 5 };
      eventBus.on(EVENTS.REFRESH_EMAILS, handler);

      eventBus.emit(EVENTS.REFRESH_EMAILS, payload);

      expect(handler).toHaveBeenCalledWith(payload);

      eventBus.off(EVENTS.REFRESH_EMAILS, handler);
    });

    it('returns an unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on(EVENTS.REFRESH_TASKS, handler);

      unsubscribe();
      eventBus.emit(EVENTS.REFRESH_TASKS);

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple listeners on the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on(EVENTS.REFRESH_CALENDAR, handler1);
      eventBus.on(EVENTS.REFRESH_CALENDAR, handler2);

      eventBus.emit(EVENTS.REFRESH_CALENDAR);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      eventBus.off(EVENTS.REFRESH_CALENDAR, handler1);
      eventBus.off(EVENTS.REFRESH_CALENDAR, handler2);
    });
  });

  describe('off()', () => {
    it('removes a specific listener', () => {
      const handler = vi.fn();
      eventBus.on(EVENTS.REFRESH_TASKS, handler);
      eventBus.off(EVENTS.REFRESH_TASKS, handler);

      eventBus.emit(EVENTS.REFRESH_TASKS);

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not throw when removing a listener from a non-existent event', () => {
      const handler = vi.fn();
      expect(() => eventBus.off('non-existent-event', handler)).not.toThrow();
    });

    it('only removes the specified listener, not all listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on(EVENTS.REFRESH_TASKS, handler1);
      eventBus.on(EVENTS.REFRESH_TASKS, handler2);

      eventBus.off(EVENTS.REFRESH_TASKS, handler1);
      eventBus.emit(EVENTS.REFRESH_TASKS);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);

      eventBus.off(EVENTS.REFRESH_TASKS, handler2);
    });
  });

  describe('emit()', () => {
    it('does not throw when emitting an event with no listeners', () => {
      expect(() => eventBus.emit('event-with-no-listeners')).not.toThrow();
    });

    it('emits without data when no data is provided', () => {
      const handler = vi.fn();
      eventBus.on(EVENTS.REFRESH_TASKS, handler);

      eventBus.emit(EVENTS.REFRESH_TASKS);

      expect(handler).toHaveBeenCalledWith(undefined);

      eventBus.off(EVENTS.REFRESH_TASKS, handler);
    });
  });

  describe('EVENTS constants', () => {
    it('defines REFRESH_TASKS event', () => {
      expect(EVENTS.REFRESH_TASKS).toBe('refresh-tasks');
    });

    it('defines REFRESH_EMAILS event', () => {
      expect(EVENTS.REFRESH_EMAILS).toBe('refresh-emails');
    });

    it('defines REFRESH_CALENDAR event', () => {
      expect(EVENTS.REFRESH_CALENDAR).toBe('refresh-calendar');
    });
  });
});
