/**
 * Render worker stub.
 *
 * The render queue falls back to this when an actual background-render
 * implementation is not present. It simply echoes jobs back as complete
 * so callers can proceed without crashing.
 */

self.onmessage = (event) => {
  const { action, job, settings } = event.data || {};

  if (action === 'render') {
    self.postMessage({
      type: 'complete',
      job,
      result: {
        success: true,
        message: 'Render worker stub completed',
      },
    });
    return;
  }

  self.postMessage({
    type: 'complete',
    job,
    result: {
      success: true,
      message: 'Render worker stub completed',
    },
  });
};
