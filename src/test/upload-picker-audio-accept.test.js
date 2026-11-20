import { describe, it, expect } from 'vitest';
import { createUploadPicker, withInferredMime, isAcceptedUrlFile } from '../components/UploadPicker.js';

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
    for (const token of ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-m4a', '.mp3', '.wav', '.m4a', '.oga']) {
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

// fetchUrlAsFile() returns Files with an empty `type`, so the URL flow must
// recover the type from the extension before applying the accepted-type check.
describe('UploadPicker load-from-URL type check', () => {
  const untyped = (name) => new File(['x'], name, { type: '' });

  it('infers the MIME type from the extension when the download has none', () => {
    expect(withInferredMime(untyped('take.mp3')).type).toBe('audio/mpeg');
    expect(withInferredMime(untyped('clip.MP4')).type).toBe('video/mp4');
    expect(withInferredMime(untyped('pic.png?x=1')).type).toBe('image/png');
    expect(withInferredMime(untyped('mystery.xyz')).type).toBe('');
  });

  it('keeps the file as is when its type already matches the extension', () => {
    const f = new File(['x'], 'a.mp3', { type: 'audio/mpeg' });
    expect(withInferredMime(f)).toBe(f);
  });

  it('lets a known media extension win over a conflicting declared type', () => {
    const f = new File(['x'], 'voice.m4a', { type: 'video/mp4' });
    expect(withInferredMime(f).type).toBe('audio/mp4');
  });

  it('keeps the declared type when the extension is unknown or missing', () => {
    const noExt = new File(['x'], 'voice', { type: 'audio/mpeg' });
    const odd = new File(['x'], 'voice.bin', { type: 'audio/mpeg' });
    expect(withInferredMime(noExt)).toBe(noExt);
    expect(withInferredMime(odd)).toBe(odd);
  });

  it('accepts an extension-named audio file labelled video/mp4 in an audio-only picker', () => {
    const f = withInferredMime(new File(['x'], 'voice.m4a', { type: 'video/mp4' }));
    expect(isAcceptedUrlFile(f, { acceptVideo: false, acceptAudio: true })).toBe(true);
  });

  it('accepts an audio URL file when acceptAudio is on, with or without video', () => {
    const audio = withInferredMime(untyped('voice.mp3'));
    expect(isAcceptedUrlFile(audio, { acceptVideo: true, acceptAudio: true })).toBe(true);
    expect(isAcceptedUrlFile(audio, { acceptVideo: false, acceptAudio: true })).toBe(true);
  });

  it('rejects audio unless acceptAudio is on', () => {
    const audio = withInferredMime(untyped('voice.mp3'));
    expect(isAcceptedUrlFile(audio, { acceptVideo: true })).toBe(false);
    expect(isAcceptedUrlFile(audio, {})).toBe(false);
  });

  it('still rejects video when acceptVideo is off, and always allows images', () => {
    const video = withInferredMime(untyped('clip.mp4'));
    const image = withInferredMime(untyped('pic.jpg'));
    expect(isAcceptedUrlFile(video, { acceptVideo: false, acceptAudio: true })).toBe(false);
    expect(isAcceptedUrlFile(image, {})).toBe(true);
  });
});
