import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const workerPath = path.join(__dirname, '../lib/editor/renderExportWorker.js');
const workerSource = fs.readFileSync(workerPath, 'utf8');

describe('renderExportWorker', () => {
  let selfMock;
  let messages;
  let fetchMock;

  beforeEach(() => {
    messages = [];
    
    selfMock = {
      postMessage: (msg) => messages.push(msg),
      onmessage: null,
    };
    
    global.self = selfMock;
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    
    global.OffscreenCanvas = class MockOffscreenCanvas {
      constructor(width, height) {
        this.width = width;
        this.height = height;
      }
      getContext(type) {
        return {
          fillStyle: '',
          fillRect: vi.fn(),
          filter: 'none',
        };
      }
      captureStream(fps) {
        return {
          getTracks: () => [],
        };
      }
    };
    
    global.MediaRecorder = class MockMediaRecorder {
      constructor(stream, options) {
        this.stream = stream;
        this.options = options;
      }
      start(timeslice) {
        // no-op
      }
      stop() {
        if (this.ondataavailable) this.ondataavailable({ data: new Blob(['video']) });
        if (this.onstop) this.onstop();
      }
      static isTypeSupported(mimeType) {
        return mimeType.includes('webm');
      }
    };
    
    const urlFactory = {
      createObjectURL: vi.fn(() => 'blob:test-url'),
      revokeObjectURL: vi.fn(),
    };
    global.URL = { ...global.URL, ...urlFactory };
    
    const firstExportIndex = workerSource.split('\n').findIndex((line) => line.trimStart().startsWith('export'));
    const workerSourceForExecution = firstExportIndex >= 0
      ? workerSource.split('\n').slice(0, firstExportIndex).join('\n')
      : workerSource;
    const fn = new Function(
      'self',
      'OffscreenCanvas',
      'MediaRecorder',
      'fetch',
      'URL',
      workerSourceForExecution
    );
    fn(selfMock, global.OffscreenCanvas, global.MediaRecorder, global.fetch, global.URL);
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    vi.clearAllMocks();
  });
  
  async function runWorker(payload) {
    vi.useFakeTimers();
    const promise = selfMock.onmessage({ data: payload });
    await vi.advanceTimersByTimeAsync(1200);
    await promise;
    vi.useRealTimers();
    return messages;
  }
  
  it('responds to export-video message', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['video-content']),
    });
    
    const msgs = await runWorker({
      action: 'export-video',
      videoUrl: 'http://example.com/video.mp4',
      settings: { duration: 1000 },
    });
    
    expect(msgs.some((m) => m.type === 'complete')).toBe(true);
  });
  
  it('posts progress messages', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['video-content']),
    });
    
    const msgs = await runWorker({
      action: 'export-video',
      videoUrl: 'http://example.com/video.mp4',
      settings: { duration: 1000 },
    });
    
    const progressMsgs = msgs.filter((m) => m.type === 'progress');
    expect(progressMsgs.length).toBeGreaterThan(0);
    expect(progressMsgs.some((m) => m.percent === 100)).toBe(true);
  });
  
  it('completion message has blob and url', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['video-content']),
    });
    
    const msgs = await runWorker({
      action: 'export-video',
      videoUrl: 'http://example.com/video.mp4',
      settings: { duration: 1000 },
    });
    
    const completeMsg = msgs.find((m) => m.type === 'complete');
    expect(completeMsg).toBeDefined();
    expect(completeMsg.blob).toBeInstanceOf(ArrayBuffer);
    expect(completeMsg.url).toBe('blob:test-url');
  });
  
  it('handles invalid videoUrl', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
    });
    
    const msgs = await runWorker({
      action: 'export-video',
      videoUrl: 'http://example.com/missing.mp4',
    });
    
    const errorMsg = msgs.find((m) => m.type === 'error');
    expect(errorMsg).toBeDefined();
    expect(errorMsg.message).toContain('404');
  });
});
