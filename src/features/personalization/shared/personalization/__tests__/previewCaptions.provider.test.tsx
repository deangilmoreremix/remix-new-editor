// @vitest-environment jsdom
/**
 * `updatePreviewCaptions` on the real provider: burned-in captions are part of the preview settings, so they merge,
 * can be removed, count for undo, and are cleaned before they are stored.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { cancelActiveExport, configureCapableBrowser, getCtx, openSource, renderProvider, resetRendererMocks, type HarnessRef } from './_createFinalVideoHarness';

const CUES = [{ startMs: 0, endMs: 1200, text: 'Call us today' }, { startMs: 1500, endMs: 2600, text: 'Free quote' }];
const CAPTIONS = { enabled: true, forUrl: 'https://x/clip.mp4', style: 'bold' as const, position: 'bottom' as const, cues: CUES };

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:x') as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
  resetRendererMocks();
  configureCapableBrowser();
});
afterEach(() => { cancelActiveExport(); document.body.innerHTML = ''; });

async function setup() {
  const ref: HarnessRef = { current: null };
  await renderProvider(ref);
  await openSource(ref);
  return ref;
}
const caps = (ref: HarnessRef) => getCtx(ref).previewSettings.captions;
const update = (ref: HarnessRef, patch: unknown) => act(async () => { getCtx(ref).updatePreviewCaptions(patch); });

describe('updatePreviewCaptions', () => {
  it('has no captions to begin with, and stores the ones it is given', async () => {
    const ref = await setup();
    expect(caps(ref)).toBeUndefined();
    await update(ref, CAPTIONS);
    expect(caps(ref)).toMatchObject({ enabled: true, forUrl: 'https://x/clip.mp4', style: 'bold' });
    expect(caps(ref).cues).toHaveLength(2);
  });
  it('merges a patch over the stored captions', async () => {
    const ref = await setup();
    await update(ref, CAPTIONS);
    await update(ref, { style: 'bar', enabled: false });
    expect(caps(ref)).toMatchObject({ style: 'bar', enabled: false, position: 'bottom', forUrl: 'https://x/clip.mp4' });
    expect(caps(ref).cues).toHaveLength(2);
  });
  it('removes them with null, and treats an emptied list as none', async () => {
    const ref = await setup();
    await update(ref, CAPTIONS);
    await update(ref, null);
    expect(caps(ref)).toBeUndefined();
    await update(ref, CAPTIONS);
    await update(ref, { cues: [] });
    expect(caps(ref)).toBeUndefined();
  });
  it('cleans an edit before storing it', async () => {
    const ref = await setup();
    await update(ref, CAPTIONS);
    await update(ref, { cues: [{ startMs: 0, endMs: 900, text: '  Fixed  ' }, { startMs: 1000, endMs: 1900, text: '   ' }] });
    expect(caps(ref).cues.map((c: { text: string }) => c.text)).toEqual(['Fixed']);
  });
  it('counts for undo', async () => {
    const ref = await setup();
    await update(ref, CAPTIONS);
    expect(getCtx(ref).canUndoPreview).toBe(true);
    await act(async () => { getCtx(ref).undoPreview(); });
    expect(caps(ref)).toBeUndefined();
  });
});
