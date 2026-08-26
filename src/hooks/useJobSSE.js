import { useState, useEffect } from 'react';

/**
 * Custom hook for Server-Sent Events job status updates.
 *
 * @param {string} jobId - The job ID to subscribe to
 * @returns {Object|null} Current job status or null
 */
export function useJobSSE(jobId) {
  const [status, setStatus] = useState(null);

  const getBackendUrl = () => {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
      return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') + '/openmontage';
    }
    if (typeof window !== 'undefined' && window.__BACKEND_URL__) {
      return window.__BACKEND_URL__.replace(/\/$/, '') + '/openmontage';
    }
    return '/openmontage';
  };

  useEffect(() => {
    if (!jobId) return;

    const eventSource = new EventSource(
      `${getBackendUrl()}/api/productions/${encodeURIComponent(jobId)}/events`,
      { withCredentials: true }
    );

    eventSource.addEventListener('update', (e) => {
      try {
        setStatus(JSON.parse(e.data));
      } catch (err) {
        console.error('[useJobSSE] Failed to parse update:', err);
      }
    });

    eventSource.addEventListener('completed', (e) => {
      try {
        setStatus(JSON.parse(e.data));
      } catch (err) {
        console.error('[useJobSSE] Failed to parse completed:', err);
      }
      eventSource.close();
    });

    eventSource.addEventListener('failed', (e) => {
      try {
        setStatus(JSON.parse(e.data));
      } catch (err) {
        console.error('[useJobSSE] Failed to parse failed:', err);
      }
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      console.error('[useJobSSE] SSE error:', e);
      eventSource.close();
    });

    return () => eventSource.close();
  }, [jobId]);

  return status;
}
