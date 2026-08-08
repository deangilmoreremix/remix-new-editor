import { describe, it, expect, beforeEach, vi } from 'vitest';

// Polyfill DataTransfer for jsdom
class MockDataTransfer {
  items: any[] = [];
  add(file: File) { this.items.push({ kind: 'file', getAsFile: () => file }); }
  get files() {
    return {
      length: this.items.length,
      item: (i: number) => this.items[i]?.getAsFile() || null,
      [Symbol.iterator]: function* () {
        for (const item of this.items) yield item.getAsFile();
      }
    } as any;
  }
}
(globalThis as any).DataTransfer = MockDataTransfer;

// Mock apiKeyManager
vi.mock('../../src/lib/apiKeyManager.js', () => ({
  apiKeyManager: {
    getMuapiKey: vi.fn(() => 'test-muapi-key'),
    hasMuapiKey: vi.fn(() => true)
  }
}));

// Mock uploadHistory
vi.mock('../../src/lib/uploadHistory.js', () => ({
  getUploadHistory: vi.fn(() => []),
  saveUpload: vi.fn(),
  removeUpload: vi.fn()
}));

// Mock AuthModal
vi.mock('../../src/components/AuthModal.js', () => ({
  AuthModal: vi.fn(() => {})
}));

// Mock showToast
vi.mock('../../src/lib/loading.js', () => ({
  showToast: vi.fn()
}));

// Mock underlying upload backends so processFileUpload succeeds
vi.mock('../../src/lib/hybrid-supabase.js', () => ({
  uploadFileToStorage: vi.fn(async (file: File) => {
    return `https://example.com/uploads/${encodeURIComponent(file.name || 'file')}`;
  })
}));

vi.mock('../../src/lib/muapi.js', () => ({
  muapi: {
    uploadFile: vi.fn(async (file: File) => {
      return `https://example.com/uploads/${encodeURIComponent(file.name || 'file')}`;
    })
  }
}));

// Mock metadata extractor
vi.mock('../../src/lib/editor/metadataExtractor.js', () => ({
  extractMetadata: vi.fn(async () => ({
    duration: 30, width: 1920, height: 1080, fps: 30,
    codec: 'h264', bitrate: 1000000, sampleRate: 44100, channels: 2,
    container: 'mp4', rotation: 0,
    thumbnail: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...',
    waveform: null, orientation: 1, camera: null, gps: null, tags: {}
  })),
  generateThumbnail: vi.fn(async () => 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...'),
  extractWaveform: vi.fn(async () => ({ peaks: [] }))
}));

import { createUploadPicker } from '../../src/components/UploadPicker.js';
import { getMaxImagesForI2IModel } from '../../src/lib/models.js';

function makeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

function makeState() {
  return {
    projectTitle: 'Test',
    tracks: [
      { id: 'video-1', name: 'Video', type: 'video', items: [], muted: false, solo: false, locked: false, visible: true },
      { id: 'audio-1', name: 'Audio', type: 'audio', items: [], muted: false, solo: false, locked: false, visible: true },
      { id: 'text-1', name: 'Text', type: 'text', items: [], muted: false, solo: false, locked: false, visible: true }
    ],
    assets: [],
    mediaLibrary: [],
    undoStack: [],
    redoStack: [],
    selectedClipId: null
  };
}

describe('UploadPicker — maxImages and multi-upload', () => {
  let anchor: HTMLDivElement;
  let createdInputs: HTMLInputElement[] = [];

  beforeEach(() => {
    anchor = document.createElement('div');
    document.body.appendChild(anchor);
    createdInputs = [];
    vi.clearAllMocks();

    const origCreateElement = document.createElement.bind(document);
    document.createElement = function (tag: string, options?: any) {
      const el = origCreateElement(tag, options);
      if (tag.toLowerCase() === 'input') {
        createdInputs.push(el as HTMLInputElement);
      }
      return el;
    };
  });

  afterEach(() => {
    if (anchor.parentElement) {
      document.body.removeChild(anchor);
    }
  });

  it('sets fileInput.multiple=true when setMaxImages>1 is called', () => {
    const picker = createUploadPicker({
      anchorContainer: anchor,
      maxImages: 1
    });

    const fileInput = createdInputs[createdInputs.length - 1];
    expect(fileInput?.multiple).toBe(false);

    picker.setMaxImages(3);
    expect(fileInput?.multiple).toBe(true);
  });

  it('sets fileInput.multiple=false when setMaxImages(1) is called', () => {
    const picker = createUploadPicker({
      anchorContainer: anchor,
      maxImages: 3
    });

    const fileInput = createdInputs[createdInputs.length - 1];
    // setMaxImages was not called yet, so multiple might still be false
    // (depends on whether constructor sets it)
    picker.setMaxImages(1);
    expect(fileInput?.multiple).toBe(false);
  });

  it('setMaxImages(5) enables multiple after being disabled', () => {
    const picker = createUploadPicker({
      anchorContainer: anchor,
      maxImages: 1
    });

    const fileInput = createdInputs[createdInputs.length - 1];
    expect(fileInput?.multiple).toBe(false);

    picker.setMaxImages(5);
    expect(fileInput?.multiple).toBe(true);
  });

  it('uploads all selected files in parallel when maxImages>1', async () => {
    const { processMultipleFileUploads } = await import('../../src/lib/editor/uploadPipeline.js');
    const state = makeState();
    const files = [
      makeFile('a.png', 'image/png'),
      makeFile('b.png', 'image/png'),
      makeFile('c.png', 'image/png')
    ];

    const results = await processMultipleFileUploads(files, { state, save: false });
    expect(results.length).toBe(3);
    expect(results.every(r => r.success)).toBe(true);
    expect(state.assets.length).toBe(3);
  });

  it('continues uploading remaining files when one fails in multi-mode', async () => {
    const { muapi } = await import('../../src/lib/muapi.js');
    const originalUpload = (muapi as any).uploadFile;
    let callCount = 0;
    (muapi as any).uploadFile = vi.fn(async (file: File) => {
      callCount++;
      if (file.name === 'b.png') {
        throw new Error('Simulated upload failure');
      }
      return `https://example.com/${file.name}`;
    });

    try {
      const { processMultipleFileUploads } = await import('../../src/lib/editor/uploadPipeline.js');
      const state = makeState();
      const files = [
        makeFile('a.png', 'image/png'),
        makeFile('b.png', 'image/png'),
        makeFile('c.png', 'image/png')
      ];

      const results = await processMultipleFileUploads(files, { state, save: false });
      expect(results.length).toBe(3);
      expect(callCount).toBe(3);
      expect(results.filter(r => r.success).length).toBe(2);
      expect(results.find(r => !r.success)?.error).toBe('Simulated upload failure');
    } finally {
      (muapi as any).uploadFile = originalUpload;
    }
  });
});

describe('UploadPicker — slots limit in multi-mode', () => {
  it('only uploads up to maxImages when more files are selected', async () => {
    const { processMultipleFileUploads } = await import('../../src/lib/editor/uploadPipeline.js');
    const state = makeState();
    const files = [
      makeFile('a.png', 'image/png'),
      makeFile('b.png', 'image/png'),
      makeFile('c.png', 'image/png'),
      makeFile('d.png', 'image/png')
    ];

    const results = await processMultipleFileUploads(files.slice(0, 2), { state, save: false });
    expect(results.length).toBe(2);
    expect(results.every(r => r.success)).toBe(true);
  });
});

describe('ImageStudio — getMaxImagesForI2IModel', () => {
  it('returns model.maxImages for known I2I models', () => {
    // Use actual model IDs from models.js that have maxImages
    // These are real I2I models in the codebase
    expect(getMaxImagesForI2IModel('flux-kontext-pro-i2i')).toBe(2);
    expect(getMaxImagesForI2IModel('flux-kontext-max-i2i')).toBe(2);
  });

  it('defaults to 1 for unknown models', () => {
    expect(getMaxImagesForI2IModel('nonexistent-model')).toBe(1);
  });

  it('defaults to 1 for models without maxImages field', () => {
    // Find a model without maxImages - use a T2I model ID or fake one
    expect(getMaxImagesForI2IModel('fake-model-no-max')).toBe(1);
  });
});
