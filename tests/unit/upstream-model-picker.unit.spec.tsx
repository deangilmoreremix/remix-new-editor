import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

import ImageModelDropdown from '../../src/components/upstream-picker/ImageModelDropdown.jsx';
import VideoModelDropdown from '../../src/components/upstream-picker/VideoModelDropdown.jsx';
import { imageCopy, videoCopy } from '../../src/components/upstream-picker/copy.js';
import { mountUpstreamModelPicker } from '../../src/components/upstream-picker/mountUpstreamModelPicker.jsx';
import {
  imageModelPickerEntries,
  videoModelPickerEntries,
} from '../../src/lib/modelFamilies.js';

// jsdom has no layout; the copied components call scrollIntoView on mount.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('upstream Image ModelDropdown (copied verbatim)', () => {
  it('shows upstream tabs, the provider rail and every image entry', () => {
    render(<ImageModelDropdown selectedModel={null} onSelect={() => {}} onClose={() => {}} copy={imageCopy} />);
    for (const label of ['All', 'Text to Image', 'Image to Image']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.getByTitle('All Providers')).toBeTruthy();
    expect(screen.getByText('All models')).toBeTruthy();
    expect(screen.getAllByText(imageModelPickerEntries[0].name).length).toBeGreaterThan(0);
  });

  it('calls onSelect(entry, category) and onClose when a row is clicked', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<ImageModelDropdown selectedModel={null} onSelect={onSelect} onClose={onClose} copy={imageCopy} />);
    fireEvent.click(screen.getByRole('button', { name: 'Image to Image' }));
    const entry = imageModelPickerEntries.find((e) => e.variantsByMode.i2i);
    fireEvent.click(screen.getAllByText(entry.name)[0]);
    expect(onSelect).toHaveBeenCalledWith(entry, 'i2i');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('upstream Video ModelDropdown (copied verbatim)', () => {
  it('shows upstream tabs including Video Tools', () => {
    render(<VideoModelDropdown selectedModel={null} onSelect={() => {}} onClose={() => {}} copy={videoCopy} />);
    for (const label of ['All', 'Text to Video', 'Image to Video', 'Video Tools']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('calls onSelect(entry, category) for a text-to-video row', () => {
    const onSelect = vi.fn();
    render(<VideoModelDropdown selectedModel={null} onSelect={onSelect} onClose={() => {}} copy={videoCopy} />);
    fireEvent.click(screen.getByRole('button', { name: 'Text to Video' }));
    const entry = videoModelPickerEntries.find((e) => e.variantsByMode.t2v && e.name === 'FLUX 3');
    expect(entry).toBeTruthy();
    fireEvent.click(screen.getByText('FLUX 3'));
    expect(onSelect).toHaveBeenCalledWith(entry, 't2v');
  });
});

describe('mountUpstreamModelPicker', () => {
  it('opens a popover with the MODEL header and closes on Escape', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const onClose = vi.fn();
    const picker = mountUpstreamModelPicker({
      kind: 'image', anchor, selectedModelId: null, onSelect: () => {}, onClose,
    });
    picker.open();
    const host = document.querySelector('.upstream-model-picker');
    expect(host).toBeTruthy();
    expect(host.textContent).toContain('Model');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
