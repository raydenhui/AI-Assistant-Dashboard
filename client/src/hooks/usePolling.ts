import { useEffect, useRef, useCallback, useState } from 'react';

interface UsePollingOptions {
  interval: number;
  enabled?: boolean;
  immediate?: boolean;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for polling data at regular intervals
 * @param callback - The async function to call for fetching data
 * @param options - Polling configuration options
 */
export function usePolling(
  callback: () => Promise<void>,
  options: UsePollingOptions
) {
  const { interval, enabled = true, immediate = true, onError } = options;
  
  // Use refs to store callback and onError to avoid dependency issues
  const savedCallback = useRef(callback);
  const savedOnError = useRef(onError);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRunImmediate = useRef(false);
  
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Update saved callback and onError when they change
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    savedOnError.current = onError;
  }, [onError]);

  // Execute the callback - stable function that doesn't change
  const executeCallback = useCallback(async () => {
    try {
      setIsPolling(true);
      await savedCallback.current();
      setLastUpdated(new Date());
    } catch (error) {
      if (savedOnError.current && error instanceof Error) {
        savedOnError.current(error);
      }
    } finally {
      setIsPolling(false);
    }
  }, []); // No dependencies - uses refs

  // Manual refresh function
  const refresh = useCallback(async () => {
    await executeCallback();
  }, [executeCallback]);

  // Setup polling interval
  useEffect(() => {
    // Cleanup function for the interval
    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (!enabled) {
      cleanup();
      hasRunImmediate.current = false;
      return;
    }

    // Execute immediately if requested (only once)
    if (immediate && !hasRunImmediate.current) {
      hasRunImmediate.current = true;
      executeCallback();
    }

    // Clear any existing interval before setting a new one
    cleanup();

    // Set up the interval
    intervalRef.current = setInterval(executeCallback, interval);

    // Cleanup on unmount or when dependencies change
    return cleanup;
  }, [enabled, interval, immediate, executeCallback]);

  return {
    isPolling,
    lastUpdated,
    refresh,
  };
}

/**
 * Custom hook for fetching data with automatic refetch on focus
 */
export function useRefetchOnFocus(callback: () => void, enabled = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const handleFocus = () => {
      savedCallback.current();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
}

export default usePolling;
