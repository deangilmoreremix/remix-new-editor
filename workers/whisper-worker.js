/**
 * Whisper worker stub.
 *
 * The speech transcriber falls back to this when the actual whisper worker
 * is not present. It echoes back a completed status so callers can cleanly
 * handle the no-op path.
 */

self.onmessage = (event) => {
  const { action, audio, options } = event.data || {};

  if (action === 'transcribe') {
    self.postMessage({
      type: 'complete',
      requestId: event.data && event.data.requestId,
      result: {
        text: '',
        segments: [],
        language: 'en',
      },
    });
    return;
  }

  self.postMessage({
    type: 'error',
    error: 'Whisper worker stub received unknown action: ' + action,
  });
};
