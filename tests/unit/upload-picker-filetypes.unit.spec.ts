import { describe, it, expect, beforeEach, vi } from 'vitest';

// Polyfill DataTransfer for jsdom
class MockDataTransfer {
  items: any[] = [];
  add(file: File) { this.items.push({ kind: 'file', getAsFile: () => file }); }
  get files() {
    return {
      length: this.items.length,
      item: (i: number) => this.items[i]?.getAsFile() || null,
      [Symbol.iterator]: function* (this: MockDataTransfer) {
        for (const item of this.items) yield item.getAsFile();
      }.bind(this)
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

// Mock the upload pipeline so we can control processFileUpload results
let uploadMock: any;
vi.mock('../../src/lib/editor/uploadPipeline.js', () => ({
  processFileUpload: (file: any, opts: any) => uploadMock(file, opts),
  fetchUrlAsFile: vi.fn(async () => new File([new Uint8Array(10)], 'remote.png', { type: 'image/png' }))
}));

import { createUploadPicker } from '../../src/components/UploadPicker.js';
import { showToast } from '../../src/lib/loading.js';

function makeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

function setFiles(input: HTMLInputElement, file: File) {
  const dt = new MockDataTransfer();
  dt.add(file);
  Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
}

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('UploadPicker — MuAPI file-type coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock = vi.fn(async (file: any) => ({
      success: true,
      asset: { url: `https://u/${file.name}`, thumbnail: 't', type: file.type.startsWith('image/') ? 'image' : 'video' }
    }));
  });

  it('accepts images, videos, and documents by default (MuAPI /upload_file types)', () => {
    const picker = createUploadPicker({ anchorContainer: document.createElement('div') });
    const input = picker.trigger.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toContain('image/png');
    expect(input.accept).toContain('video/mp4');
    expect(input.accept).toContain('application/pdf');
    expect(input.accept).toContain('application/zip');
  });

  it('still restricts to images only when acceptVideo/acceptDocuments are false', () => {
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), acceptVideo: false, acceptDocuments: false });
    const input = picker.trigger.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).not.toContain('video/');
    expect(input.accept).not.toContain('zip');
    expect(input.accept).toContain('image/png');
  });

  it('enforces the MuAPI image size cap (10MB) and refuses oversized uploads', async () => {
    const onSelect = vi.fn();
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), onSelect });
    const input = picker.trigger.querySelector('input[type="file"]') as HTMLInputElement;
    setFiles(input, makeFile('big.png', 'image/png', 20 * 1024 * 1024));
    input.onchange({ target: input } as any);
    await flush();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('uploads a video (50MB cap) without hitting the image cap', async () => {
    const onSelect = vi.fn();
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), onSelect });
    const input = picker.trigger.querySelector('input[type="file"]') as HTMLInputElement;
    setFiles(input, makeFile('clip.mp4', 'video/mp4', 40 * 1024 * 1024));
    input.onchange({ target: input } as any);
    await flush();
    expect(uploadMock).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalled();
  });
});

describe('UploadPicker — frameMode (start / end image)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock = vi.fn(async (file: any) => ({
      success: true,
      asset: { url: `https://u/${file.name}`, thumbnail: 't', type: 'image' }
    }));
  });

  it('returns startUrl/endUrl from onSelect when both frames are set', async () => {
    const onSelect = vi.fn();
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), frameMode: true, onSelect });
    const input = picker.trigger.querySelector('input[type="file"]') as HTMLInputElement;

    // Start frame
    setFiles(input, makeFile('start.png', 'image/png', 1024));
    input.onchange({ target: input } as any);
    await flush();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].startUrl).toBe('https://u/start.png');
    expect(onSelect.mock.calls[0][0].endUrl).toBeNull();

    // End frame
    setFiles(input, makeFile('end.png', 'image/png', 1024));
    input.onchange({ target: input } as any);
    await flush();
    expect(onSelect).toHaveBeenCalledTimes(2);
    const last = onSelect.mock.calls[1][0];
    expect(last.startUrl).toBe('https://u/start.png');
    expect(last.endUrl).toBe('https://u/end.png');
    expect(last.urls).toEqual(['https://u/start.png', 'https://u/end.png']);
  });

  it('getSelectedUrls returns both frame urls', async () => {
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), frameMode: true });
    const input = picker.trigger.querySelector('input[type="file"]') as HTMLInputElement;
    setFiles(input, makeFile('s.png', 'image/png', 1024));
    input.onchange({ target: input } as any);
    await flush();
    expect(picker.getSelectedUrls()).toEqual(['https://u/s.png']);
  });
});

describe('UploadPicker — public API (multi, reset, setImage, history)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock = vi.fn(async (file: any) => ({
      success: true,
      asset: { url: `https://u/${file.name}`, thumbnail: 't', type: file.type.startsWith('image/') ? 'image' : 'video' }
    }));
  });

  it('uploads multiple images when maxImages > 1', async () => {
    const onSelect = vi.fn();
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), maxImages: 3, onSelect });
    const input = picker.trigger.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new MockDataTransfer();
    dt.add(makeFile('a.png', 'image/png', 1024));
    dt.add(makeFile('b.png', 'image/png', 1024));
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
    input.onchange({ target: input } as any);
    await flush();
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(picker.getSelectedUrls().length).toBe(2);
  });

  it('reset() clears selected entries and frame entries', async () => {
    const picker = createUploadPicker({ anchorContainer: document.createElement('div') });
    const input = picker.trigger.querySelector('input[type="file"]') as HTMLInputElement;
    setFiles(input, makeFile('a.png', 'image/png', 1024));
    input.onchange({ target: input } as any);
    await flush();
    expect(picker.getSelectedUrls().length).toBe(1);
    picker.reset();
    expect(picker.getSelectedUrls().length).toBe(0);
  });

  it('setImage() selects a URL and fires onSelect with type', () => {
    const onSelect = vi.fn();
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), onSelect });
    picker.setImage('https://x/demo.png', 'https://x/demo.png');
    expect(onSelect).toHaveBeenCalled();
    const arg = onSelect.mock.calls[0][0];
    expect(arg.url).toBe('https://x/demo.png');
    expect(arg.type).toBe('image');
    expect(picker.getSelectedUrls()).toEqual(['https://x/demo.png']);
  });

  it('clicking a history grid cell selects the entry in single mode', async () => {
    const { getUploadHistory } = await import('../../src/lib/uploadHistory.js');
    (getUploadHistory as any).mockReturnValue([{ id: 'h1', name: 'hist.png', uploadedUrl: 'https://h/hist.png', thumbnail: 'th', type: 'image' }]);
    const onSelect = vi.fn();
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), onSelect });
    picker.trigger.click(); // open panel
    await flush();
    const cell = picker.panel.querySelector('[class*="cursor-pointer"]') as HTMLElement;
    expect(cell).toBeTruthy();
    cell.click();
    await flush();
    expect(onSelect).toHaveBeenCalled();
    expect(picker.getSelectedUrls()).toContain('https://h/hist.png');
  });

  it('paste of an image file uploads it', async () => {
    const onSelect = vi.fn();
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), onSelect });
    document.body.appendChild(picker.panel);
    picker.trigger.click(); // open panel so the delegated paste handler is active
    await flush();
    const file = makeFile('pasted.png', 'image/png', 1024);
    const pasteEvent = new Event('paste', { bubbles: true }) as any;
    pasteEvent.clipboardData = { items: [{ kind: 'file', getAsFile: () => file }] };
    picker.panel.dispatchEvent(pasteEvent); // bubbles up to the document-level listener
    await flush();
    expect(uploadMock).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalled();
    picker.panel.remove();
  });
});

describe('UploadPicker — no API key (graceful, must not crash)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock = vi.fn(async (file: any) => ({
      success: true,
      asset: { url: `https://u/${file.name}`, thumbnail: 't', type: 'image' }
    }));
  });

  it('does not upload and prompts for a key when no muapi key is set', async () => {
    const { apiKeyManager } = await import('../../src/lib/apiKeyManager.js');
    (apiKeyManager.getMuapiKey as any).mockReturnValue(null);
    const onFilePreview = vi.fn();
    const onSelect = vi.fn();
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), onSelect, onFilePreview });
    const input = picker.trigger.querySelector('input[type="file"]') as HTMLInputElement;
    setFiles(input, makeFile('a.png', 'image/png', 1024));
    input.onchange({ target: input } as any);
    await flush();
    // No upload attempt, no selection fired, no crash
    expect(uploadMock).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    // Local preview still works; user is prompted for their key
    expect(onFilePreview).toHaveBeenCalled();
    const { AuthModal } = await import('../../src/components/AuthModal.js');
    expect(AuthModal).toHaveBeenCalled();
  });

  it('paste is a no-op (safe) when no key is present', async () => {
    const { apiKeyManager } = await import('../../src/lib/apiKeyManager.js');
    (apiKeyManager.getMuapiKey as any).mockReturnValue(null);
    const onSelect = vi.fn();
    const picker = createUploadPicker({ anchorContainer: document.createElement('div'), onSelect });
    document.body.appendChild(picker.panel);
    picker.trigger.click();
    await flush();
    const file = makeFile('pasted.png', 'image/png', 1024);
    const pasteEvent = new Event('paste', { bubbles: true }) as any;
    pasteEvent.clipboardData = { items: [{ kind: 'file', getAsFile: () => file }] };
    expect(() => picker.panel.dispatchEvent(pasteEvent)).not.toThrow();
    await flush();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    picker.panel.remove();
  });
});
