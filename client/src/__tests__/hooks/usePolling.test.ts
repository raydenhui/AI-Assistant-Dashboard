import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePolling, useRefetchOnFocus } from '../../hooks/usePolling';

describe('usePolling', () => {
  beforeEach(() => {
    // Only fake interval/timeout timers, NOT Date/queueMicrotask/etc.
    // which React internals depend on
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the callback immediately when immediate=true (default)', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      usePolling(callback, { interval: 1000, immediate: true })
    );

    // Allow the immediate call to settle
    await act(async () => {
      await Promise.resolve();
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does NOT call the callback immediately when immediate=false', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      usePolling(callback, { interval: 1000, immediate: false })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('calls the callback at each interval tick', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      usePolling(callback, { interval: 1000, immediate: false })
    );

    // Advance by one interval
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Advance by another interval
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not poll when enabled=false', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      usePolling(callback, { interval: 1000, enabled: false, immediate: true })
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('stops polling when enabled changes from true to false', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    let enabled = true;

    const { rerender } = renderHook(() =>
      usePolling(callback, { interval: 1000, enabled, immediate: false })
    );

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Disable polling
    enabled = false;
    rerender();

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should still be 1 - no more calls after disable
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('returns isPolling=false initially when immediate=false', () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      usePolling(callback, { interval: 1000, immediate: false })
    );

    expect(result.current.isPolling).toBe(false);
  });

  it('returns lastUpdated=null initially', () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      usePolling(callback, { interval: 1000, immediate: false })
    );

    expect(result.current.lastUpdated).toBeNull();
  });

  it('updates lastUpdated after a successful callback', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      usePolling(callback, { interval: 1000, immediate: true })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  it('calls onError when the callback throws', async () => {
    const onError = vi.fn();
    const error = new Error('Fetch failed');
    const callback = vi.fn().mockRejectedValue(error);

    renderHook(() =>
      usePolling(callback, { interval: 1000, immediate: true, onError })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('does not call onError when onError is not provided', async () => {
    const callback = vi.fn().mockRejectedValue(new Error('Fail'));

    expect(() => {
      renderHook(() =>
        usePolling(callback, { interval: 1000, immediate: true })
      );
    }).not.toThrow();
  });

  it('refresh() manually triggers the callback', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      usePolling(callback, { interval: 60000, immediate: false })
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cleans up the interval on unmount', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

    const { unmount } = renderHook(() =>
      usePolling(callback, { interval: 1000, immediate: false })
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});

describe('useRefetchOnFocus', () => {
  it('calls callback when window gains focus', () => {
    const callback = vi.fn();

    renderHook(() => useRefetchOnFocus(callback));

    window.dispatchEvent(new Event('focus'));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls callback when document becomes visible', () => {
    const callback = vi.fn();

    renderHook(() => useRefetchOnFocus(callback));

    // Simulate visibility change to visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does NOT call callback when enabled=false', () => {
    const callback = vi.fn();

    renderHook(() => useRefetchOnFocus(callback, false));

    window.dispatchEvent(new Event('focus'));

    expect(callback).not.toHaveBeenCalled();
  });

  it('removes event listeners on unmount', () => {
    const callback = vi.fn();
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useRefetchOnFocus(callback));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function));
  });
});
