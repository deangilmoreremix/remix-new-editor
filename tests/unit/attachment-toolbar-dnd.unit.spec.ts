import { describe, expect, it, vi } from 'vitest';
import { createAttachmentToolbar } from '../../src/lib/attachmentToolbar.js';

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

function makeTransfer(files: File[]) {
  return {
    files,
    items: files.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })),
    dropEffect: 'none',
  } as unknown as DataTransfer;
}

describe('createAttachmentToolbar drag and drop', () => {
  it('renders only media roles supported by the selected model', () => {
    const container = document.createElement('div');
    const textarea = document.createElement('textarea');
    container.appendChild(textarea);

    const toolbar = createAttachmentToolbar({
      container,
      getTextarea: () => textarea,
      onUpload: vi.fn(),
      model: {
        id: 'video-model',
        inputs: {
          first_frame_url: { type: 'string' },
          last_frame_url: { type: 'string' },
          reference_images: { type: 'array' },
        },
      },
    });

    expect(container.querySelector('[data-attachment-role="startFrame"]')).toBeTruthy();
    expect(container.querySelector('[data-attachment-role="endFrame"]')).toBeTruthy();
    expect(container.querySelector('[data-attachment-role="image"]')).toBeTruthy();
    expect(container.querySelector('[data-attachment-role="video"]')).toBeFalsy();
    expect(container.querySelector('[data-attachment-role="audio"]')).toBeFalsy();

    toolbar.destroy();
  });

  it('uploads a dropped compatible file with role metadata', async () => {
    const container = document.createElement('div');
    const textarea = document.createElement('textarea');
    container.appendChild(textarea);
    const onUpload = vi.fn(async () => {});

    const toolbar = createAttachmentToolbar({
      container,
      getTextarea: () => textarea,
      onUpload,
      model: { id: 'image-model', inputs: { reference_images: { type: 'array' } } },
    });

    const button = container.querySelector('[data-attachment-role="image"]') as HTMLButtonElement;
    const file = makeFile('reference.png', 'image/png');
    const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: makeTransfer([file]) });
    button.dispatchEvent(event);

    await Promise.resolve();
    await Promise.resolve();

    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith(
      'image',
      file,
      expect.objectContaining({ role: 'image', accept: 'image/*', source: 'attachment-toolbar' }),
    );

    toolbar.destroy();
  });

  it('rejects an incompatible dropped file and enforces single-file frame slots', async () => {
    const container = document.createElement('div');
    const textarea = document.createElement('textarea');
    container.appendChild(textarea);
    const onUpload = vi.fn(async () => {});

    const toolbar = createAttachmentToolbar({
      container,
      getTextarea: () => textarea,
      onUpload,
      model: { id: 'video-model', inputs: { first_frame_url: { type: 'string' } } },
    });

    const button = container.querySelector('[data-attachment-role="startFrame"]') as HTMLButtonElement;

    const badEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(badEvent, 'dataTransfer', { value: makeTransfer([makeFile('clip.mp4', 'video/mp4')]) });
    button.dispatchEvent(badEvent);
    await Promise.resolve();
    expect(onUpload).not.toHaveBeenCalled();

    const first = makeFile('first.png', 'image/png');
    const second = makeFile('second.jpg', 'image/jpeg');
    const goodEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(goodEvent, 'dataTransfer', { value: makeTransfer([first, second]) });
    button.dispatchEvent(goodEvent);
    await Promise.resolve();
    await Promise.resolve();

    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload.mock.calls[0][1]).toBe(first);

    toolbar.destroy();
  });

  it('re-renders attachment roles when the model changes', () => {
    const container = document.createElement('div');
    const textarea = document.createElement('textarea');
    container.appendChild(textarea);

    const toolbar = createAttachmentToolbar({
      container,
      getTextarea: () => textarea,
      onUpload: vi.fn(),
      model: { id: 't2v', inputs: {} },
    });

    expect(container.querySelector('[data-attachment-role="startFrame"]')).toBeFalsy();

    toolbar.updateModel({
      id: 'i2v',
      inputs: {
        first_frame_url: { type: 'string' },
        reference_videos: { type: 'array' },
      },
    });

    expect(container.querySelector('[data-attachment-role="startFrame"]')).toBeTruthy();
    expect(container.querySelector('[data-attachment-role="video"]')).toBeTruthy();

    toolbar.destroy();
  });
});
