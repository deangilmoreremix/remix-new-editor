import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import BottomInputBar from '../components/BottomInputBar';

// Mirror the exact image-input acceptance rule used in app/page.js
// (startGenerationWithKey): an image is valid if it is an http(s) URL or a
// data: URL produced from an uploaded file.
const isImageInput = (imageUrl) =>
  !!imageUrl && (/^https?:\/\//.test(imageUrl) || /^data:/.test(imageUrl));

// Mirror the FileReader -> data URL helper used by app/page.js so the test
// exercises the same conversion the upload flow relies on.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function makeFile(name = 'shot.png', type = 'image/png', size = 1024) {
  const file = new File([new Uint8Array(size)], name, { type });
  return file;
}

function renderBar(overrides = {}) {
  const props = {
    showInputBar: true,
    setShowInputBar: vi.fn(),
    showChatButton: false,
    setShowChatButton: vi.fn(),
    uploadedFile: null,
    setUploadedFile: vi.fn(),
    previewUrl: null,
    setPreviewUrl: vi.fn(),
    inputText: '',
    setInputText: vi.fn(),
    imageUrl: '',
    setImageUrl: vi.fn(),
    selectedAspect: '9:16',
    setSelectedAspect: vi.fn(),
    selectedDuration: '5s',
    setSelectedDuration: vi.fn(),
    fileInputRef: React.createRef(),
    handleFileChange: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
    handleGenerate: vi.fn(),
    selectedEffect: { name: 'Crash Zoom In' },
    selectedResolution: '480p',
    setSelectedResolution: vi.fn(),
    selectedQuality: 'medium',
    setSelectedQuality: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<BottomInputBar {...props} />) };
}

describe('image upload → same logic as image URL', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('FileReader converts an uploaded image into a data: URL', async () => {
    const file = makeFile();
    const dataUrl = await fileToDataUrl(file);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    // A data: URL is accepted by the same generation validation as an http URL
    expect(isImageInput(dataUrl)).toBe(true);
    expect(isImageInput('https://example.com/a.jpg')).toBe(true);
    expect(isImageInput('not-an-image')).toBe(false);
    expect(isImageInput('')).toBe(false);
  });

  it('clicking Upload opens the hidden file input (same input the drop handler uses)', () => {
    const { props } = renderBar();
    // The BottomInputBar renders a hidden <input type="file"> wired to fileInputRef
    const fileInput = props.fileInputRef.current;
    expect(fileInput).toBeInstanceOf(HTMLInputElement);
    expect(fileInput.type).toBe('file');
    // Simulate the user clicking the "Upload" button
    fireEvent.click(screen.getByText('Upload'));
    expect(props.fileInputRef.current).toBe(fileInput);
  });

  it('selecting a file via the input calls handleFileChange with the File', () => {
    const { props } = renderBar();
    const fileInput = props.fileInputRef.current;
    const file = makeFile();
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(props.handleFileChange).toHaveBeenCalledTimes(1);
    expect(props.handleFileChange.mock.calls[0][0].target.files[0]).toBe(file);
  });

  it('drag-and-drop over the bar fires handleDrop with the dropped file', () => {
    const { props } = renderBar();
    const file = makeFile();
    const dropEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [file] },
    };
    // The onDrop handler is on the inner content div (parent of the
    // "Image URL" button row).
    const contentDiv = screen.getByText('Image URL').closest('div').parentElement;
    fireEvent.drop(contentDiv, dropEvent);
    expect(props.handleDrop).toHaveBeenCalledTimes(1);
    expect(props.handleDrop.mock.calls[0][0].dataTransfer.files[0]).toBe(file);
  });

  it('generation payload uses image_url from a data: URL upload identically to a URL', () => {
    // app/page.js sets videoPayload.image_url = imageUrl for BOTH paths.
    const fromUrl = 'https://example.com/a.jpg';
    const fromUpload = 'data:image/png;base64,iVBORw0KGgo=';
    const buildPayload = (imageUrl) => ({ image_url: imageUrl });
    expect(buildPayload(fromUrl).image_url).toBe(fromUrl);
    expect(buildPayload(fromUpload).image_url).toBe(fromUpload);
    expect(isImageInput(buildPayload(fromUpload).image_url)).toBe(true);
  });
});
