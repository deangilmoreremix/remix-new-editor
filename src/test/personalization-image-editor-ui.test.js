import { describe, expect, it } from 'vitest';
import { apiMaskAlphaForSelectionAlpha } from '../lib/personalization/maskEditor.js';
import {
  DEFAULT_LOCAL_IMAGE_CONTROLS,
  normalizeLocalImageControls,
} from '../lib/personalization/localImageEditor.js';
import {
  appendEditorVersion,
  createPersonalizationImageEditorSession,
  currentEditorVersion,
  editorPreserveList,
  setEditorVersionIndex,
} from '../lib/personalization/imageEditorPanel.js';

describe('personalization mask semantics', () => {
  it('exports selected cyan pixels as transparent API-mask pixels', () => {
    expect(apiMaskAlphaForSelectionAlpha(255)).toBe(0);
    expect(apiMaskAlphaForSelectionAlpha(128)).toBe(0);
    expect(apiMaskAlphaForSelectionAlpha(1)).toBe(0);
  });

  it('exports unselected pixels as opaque protected API-mask pixels', () => {
    expect(apiMaskAlphaForSelectionAlpha(0)).toBe(255);
  });
});

describe('local image controls', () => {
  it('normalizes and clamps local controls without AI', () => {
    const controls = normalizeLocalImageControls({
      aspectRatio: '9:16',
      outputFormat: 'webp',
      rotation: 999,
      zoom: 0,
      brightness: 999,
      fitMode: 'cover',
      overlayText: 'x'.repeat(500),
    });

    expect(controls.aspectRatio).toBe('9:16');
    expect(controls.outputFormat).toBe('webp');
    expect(controls.rotation).toBe(359);
    expect(controls.zoom).toBe(10);
    expect(controls.brightness).toBe(250);
    expect(controls.fitMode).toBe('cover');
    expect(controls.overlayText.length).toBe(300);
  });

  it('uses safe defaults', () => {
    const controls = normalizeLocalImageControls({});
    expect(controls.zoom).toBe(DEFAULT_LOCAL_IMAGE_CONTROLS.zoom);
    expect(controls.backgroundColor).toBe('transparent');
  });
});

describe('personalization image editor session', () => {
  const asset = {
    id: 'asset-1',
    name: 'Primary Logo',
    url: 'https://cdn.example.com/logo.png',
    originalUrl: 'https://cdn.example.com/logo.png',
    role: 'logo',
    sourceCategory: 'logo',
  };

  it('opens on the original version with logo protections', () => {
    const session = createPersonalizationImageEditorSession(asset);
    expect(session.versionIndex).toBe(0);
    expect(currentEditorVersion(session).dataUrl).toBe(asset.url);
    expect(editorPreserveList(session)).toContain('logo geometry');
    expect(session.protections.logo).toBe(true);
    expect(session.protections.text).toBe(true);
  });

  it('adds versions and supports undo/redo selection', () => {
    const session = createPersonalizationImageEditorSession(asset);
    appendEditorVersion(session, {
      label: 'Transparent Logo',
      dataUrl: 'data:image/png;base64,AAAA',
      operation: 'logo_transparent',
      model: 'openai-image',
      transparent: true,
    });
    expect(session.versions).toHaveLength(2);
    expect(session.versionIndex).toBe(1);

    setEditorVersionIndex(session, 0);
    expect(currentEditorVersion(session).label).toBe('Original');

    setEditorVersionIndex(session, 1);
    expect(currentEditorVersion(session).transparent).toBe(true);
  });

  it('truncates redo history when editing after undo', () => {
    const session = createPersonalizationImageEditorSession(asset);
    appendEditorVersion(session, { label: 'A', dataUrl: 'data:image/png;base64,AAAA' });
    appendEditorVersion(session, { label: 'B', dataUrl: 'data:image/png;base64,BBBB' });
    setEditorVersionIndex(session, 1);
    appendEditorVersion(session, { label: 'C', dataUrl: 'data:image/png;base64,CCCC' });
    expect(session.versions.map((v) => v.label)).toEqual(['Original', 'A', 'C']);
  });
});
