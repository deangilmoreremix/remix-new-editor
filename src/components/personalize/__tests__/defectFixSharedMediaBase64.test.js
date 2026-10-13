/**
 * defectFixSharedMediaBase64.test.js
 *
 * Regression: sharedMediaStore.addEntry() dropped `outputIsBase64`
 * (plus role / sourceAssetId / openAIResponseId / originStudio) while
 * normalizing the record, so every AI Assist output was persisted as a
 * raw base64 payload with no decoding flag — the hub then rendered a
 * broken <img src="QUJD...">. The store must round-trip every field a
 * writer sets, through memory AND localStorage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { sharedMediaStore } from '../sharedMediaStore.js';

const STORAGE_KEY = 'remix_personalization_shared_media_v1';

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
  sharedMediaStore.setState({ entries: [], hydrated: false });
  sharedMediaStore.hydrate();
});

describe('defect: addEntry preserves AI Assist output fields', () => {
  it('keeps outputIsBase64 (and the mime/format/response provenance) on a base64 entry', () => {
    const entry = sharedMediaStore.addEntry({
      originStudio: 'personalize-ai-assist',
      sourceType: 'ai_assist_image',
      role: 'logo',
      sourceAssetId: 'asset-logo-1',
      outputUrls: ['QUJD'],
      outputType: 'image',
      outputIsBase64: true,
      outputMime: 'image/png',
      outputFormat: 'png',
      openAIResponseId: 'resp_123',
    });

    expect(entry.outputIsBase64).toBe(true);
    expect(entry.outputMime).toBe('image/png');
    expect(entry.outputFormat).toBe('png');
    expect(entry.openAIResponseId).toBe('resp_123');
    expect(entry.role).toBe('logo');
    expect(entry.sourceAssetId).toBe('asset-logo-1');
    expect(entry.originStudio).toBe('personalize-ai-assist');

    // The stored copy (not just the return value) carries the fields.
    const stored = sharedMediaStore.getEntryById(entry.id);
    expect(stored.outputIsBase64).toBe(true);
    expect(stored.outputMime).toBe('image/png');
    expect(stored.role).toBe('logo');
    expect(stored.outputUrls).toEqual(['QUJD']);
  });

  it('survives a localStorage persistence + hydration round-trip', () => {
    sharedMediaStore.addEntry({
      id: 'sm-b64-fixed',
      outputUrls: ['QUJD'],
      outputIsBase64: true,
      outputMime: 'image/png',
    });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed[0].outputIsBase64).toBe(true);

    // Re-hydrate from storage as a fresh session would.
    sharedMediaStore.setState({ entries: [], hydrated: false });
    sharedMediaStore.hydrate();
    const reloaded = sharedMediaStore.getEntryById('sm-b64-fixed');
    expect(reloaded).toBeTruthy();
    expect(reloaded.outputIsBase64).toBe(true);
    expect(reloaded.outputUrls).toEqual(['QUJD']);
  });

  it('leaves a normal-URL entry unflagged (renders as a plain URL)', () => {
    const entry = sharedMediaStore.addEntry({
      originStudio: 'personalize-ai-assist',
      sourceType: 'ai_assist_video',
      outputUrls: ['https://muapi.test/out.mp4'],
      outputType: 'video',
    });
    expect(entry.outputIsBase64).toBe(false);
    expect(entry.outputUrls).toEqual(['https://muapi.test/out.mp4']);
    expect(sharedMediaStore.getEntryById(entry.id).outputIsBase64).toBe(false);
  });

  it('still fills the SQL-row defaults for a bare entry', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'image-demo' });
    expect(entry.originStudio).toBe('demo-personalization');
    expect(entry.outputIsBase64).toBe(false);
    expect(entry.outputMime).toBeNull();
    expect(entry.role).toBeNull();
    expect(entry.sourceAssetId).toBeNull();
    expect(entry.openAIResponseId).toBeNull();
    expect(entry.outputUrls).toEqual([]);
  });
});
