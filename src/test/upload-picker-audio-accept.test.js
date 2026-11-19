import { describe, it, expect } from 'vitest';
import { createUploadPicker } from '../components/UploadPicker.js';

function fileInputFor(options) {
  const picker = createUploadPicker({
    anchorContainer: document.createElement('div'),
    onSelect: () => {},
    ...options,
  });
  return picker.trigger.querySelector('input[type="file"]');
}

describe('UploadPicker acceptAudio', () => {
  it('does not offer audio by default, so other studios are unchanged', () => {
    const accept = fileInputFor({ acceptVideo: true }).accept;
    expect(accept).not.toMatch(/audio\//);
    expect(accept).not.toMatch(/\.mp3/);
  });

  it('offers audio types in the file dialog when acceptAudio is true', () => {
    const accept = fileInputFor({ acceptVideo: true, acceptAudio: true }).accept;
    for (const token of ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-m4a', '.mp3', '.wav', '.m4a']) {
      expect(accept).toContain(token);
    }
  });

  it('keeps image, video and document types alongside audio', () => {
    const accept = fileInputFor({ acceptVideo: true, acceptAudio: true }).accept;
    expect(accept).toContain('image/png');
    expect(accept).toContain('video/mp4');
    expect(accept).toContain('application/pdf');
  });

  it('does not add video types when only audio is opted in on an image picker', () => {
    const accept = fileInputFor({ acceptVideo: false, acceptAudio: true }).accept;
    expect(accept).toContain('audio/mpeg');
    expect(accept).not.toContain('video/mp4');
  });
});
