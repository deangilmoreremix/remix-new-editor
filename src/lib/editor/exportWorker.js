/**
 * Export worker stub.
 *
 * The export pipeline falls back to this when an actual export worker is
 * not present. It reports success with an empty payload so callers can
 * complete the export flow without crashing.
 */

self.onmessage = (event) => {
  const { action, settings, timelineData } = event.data || {};

  if (action === 'export') {
    self.postMessage({
      type: 'progress',
      progress: 100,
    });

    self.postMessage({
      type: 'complete',
      result: {
        success: true,
        message: 'Export worker stub completed',
        url: null,
        blob: null,
      },
    });
    return;
  }

  self.postMessage({
    type: 'error',
    error: 'Export worker stub received unknown action: ' + action,
  });
};
