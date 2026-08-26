import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for polling job status with exponential backoff.
 *
 * @param {string} jobId - The job ID to poll
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Base polling interval in ms (default 2000)
 * @param {number} options.maxInterval - Maximum polling interval in ms (default 10000)
 * @param {number} options.backoffFactor - Multiplier for backoff (default 1.5)
 * @param {Function} options.onUpdate - Callback on status update
 * @param {Function} options.onError - Callback on error
 * @param {Function} options.onComplete - Callback on completion
 * @returns {{ status, error, isPolling, start, stop }}
 */
export function useJobPolling(jobId, options = {}) {
  const {
    interval = 2000,
    maxInterval = 10000,
    backoffFactor = 1.5,
    onUpdate,
    onError,
    onComplete,
  } = options;

  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const abortController = useRef(null);
  const currentInterval = useRef(interval);
  const pollFn = useRef(null);

  const getBackendUrl = () => {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
      return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') + '/openmontage';
    }
    if (typeof window !== 'undefined' && window.__BACKEND_URL__) {
      return window.__BACKEND_URL__.replace(/\/$/, '') + '/openmontage';
    }
    return '/openmontage';
  };

  const poll = useCallback(async () => {
    if (!jobId || !isPolling) return;

    abortController.current = new AbortController();

    try {
      const res = await fetch(
        `${getBackendUrl()}/api/productions/${encodeURIComponent(jobId)}`,
        { signal: abortController.current.signal, credentials: 'include' }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setStatus(data);
      onUpdate?.(data);

      // Terminal states — stop polling
      if (['completed', 'failed', 'cancelled'].includes(data.status)) {
        setIsPolling(false);
        onComplete?.(data);
        return;
      }

      // Increase interval during long stages
      if (['assets', 'compose'].includes(data.stage)) {
        currentInterval.current = Math.min(
          currentInterval.current * backoffFactor,
          maxInterval
        );
      } else {
        currentInterval.current = interval;
      }

      // Schedule next poll
      pollFn.current = setTimeout(poll, currentInterval.current);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err);
        onError?.(err);
        // Retry with backoff on error
        currentInterval.current = Math.min(currentInterval.current * 2, maxInterval);
        pollFn.current = setTimeout(poll, currentInterval.current);
      }
    }
  }, [jobId, isPolling, interval, maxInterval, backoffFactor, onUpdate, onError, onComplete]);

  const start = useCallback(() => {
    if (!jobId) return;
    setIsPolling(true);
    setError(null);
    currentInterval.current = interval;
    poll();
  }, [jobId, interval, poll]);

  const stop = useCallback(() => {
    setIsPolling(false);
    if (pollFn.current) clearTimeout(pollFn.current);
    abortController.current?.abort();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollFn.current) clearTimeout(pollFn.current);
      abortController.current?.abort();
    };
  }, []);

  return { status, error, isPolling, start, stop };
}
