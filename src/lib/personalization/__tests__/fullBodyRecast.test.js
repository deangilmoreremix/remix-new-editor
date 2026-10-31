import { beforeEach, describe, expect, it, vi } from 'vitest';

const muapiMock = vi.hoisted(() => ({ processV2V: vi.fn() }));
const ingestMock = vi.hoisted(() => vi.fn());
const persistMock = vi.hoisted(() => vi.fn());

vi.mock('../../muapi.js', () => ({ muapi: muapiMock }));
vi.mock('../../muapiStudioMedia.js', () => ({ ingestStudioUpload: ingestMock }));
vi.mock('../assetDiscoveryService.js', () => ({ persistPersonalizationAssetVersion: persistMock }));

import {
  clampRecastDuration,
  resolveRecastCharacterUrl,
  runFullBodyRecast,
  uploadRecastSource,
  validateRecastDuration,
  validateRecastSourceFile,
} from '../fullBodyRecast.js';
import {
  createPersonalizationImageEditorSession,
  renderPersonalizationImageEditorPanel,
} from '../imageEditorPanel.js';

const fakeFile = (type, size, name = 'clip.mp4') => ({ type, size, name });

beforeEach(() => {
  muapiMock.processV2V.mockReset();
  ingestMock.mockReset();
  persistMock.mockReset();
});

describe('full body recast source validation', () => {
  it('accepts MP4 and MOV clips up to 50 MB', () => {
    expect(validateRecastSourceFile(fakeFile('video/mp4', 1024))).toBe('');
    expect(validateRecastSourceFile(fakeFile('video/quicktime', 1024, 'a.mov'))).toBe('');
    expect(validateRecastSourceFile(fakeFile('', 1024, 'a.MOV'))).toBe('');
  });

  it('rejects other types, empty and oversized files', () => {
    expect(validateRecastSourceFile(null)).toMatch(/Choose/);
    expect(validateRecastSourceFile(fakeFile('video/webm', 1024, 'a.webm'))).toMatch(/MP4 or MOV/);
    expect(validateRecastSourceFile(fakeFile('video/mp4', 0))).toMatch(/empty/);
    expect(validateRecastSourceFile(fakeFile('video/mp4', 51 * 1024 * 1024))).toMatch(/50 MB/);
  });

  it('enforces the 4–30 second window', () => {
    expect(validateRecastDuration(3.2)).toMatch(/at least 4/);
    expect(validateRecastDuration(31)).toMatch(/30 seconds or shorter/);
    expect(validateRecastDuration(NaN)).toMatch(/Could not read/);
    expect(validateRecastDuration(12)).toBe('');
  });

  it('clamps the requested duration', () => {
    expect(clampRecastDuration(2)).toBe(4);
    expect(clampRecastDuration(12.6)).toBe(13);
    expect(clampRecastDuration(45)).toBe(30);
  });
});

describe('full body recast requests', () => {
  it('sends the open-genjutsu payload through processV2V', async () => {
    muapiMock.processV2V.mockResolvedValue({ url: 'https://cdn.muapi.ai/recast.mp4' });
    const controller = new AbortController();

    const result = await runFullBodyRecast({
      sourceUrl: 'https://cdn.muapi.ai/source.mp4',
      characterUrl: 'https://cdn.example.com/person.png',
      duration: 7.4,
      prompt: '  keep the wave  ',
      signal: controller.signal,
    });

    expect(result).toEqual({ url: 'https://cdn.muapi.ai/recast.mp4', model: 'seedance-2.5-motion-control' });
    const [params, signal] = muapiMock.processV2V.mock.calls[0];
    expect(signal).toBe(controller.signal);
    expect(params).toEqual({
      model: 'seedance-2.5-motion-control',
      video_url: 'https://cdn.muapi.ai/source.mp4',
      images_list: ['https://cdn.example.com/person.png'],
      aspect_ratio: 'adaptive',
      duration: 7,
      generate_audio: false,
      prompt: 'keep the wave',
      studioType: 'personalize-recast',
    });
  });

  it('fails clearly when the provider returns no video', async () => {
    muapiMock.processV2V.mockResolvedValue({ status: 'completed' });
    await expect(runFullBodyRecast({
      sourceUrl: 'https://cdn.muapi.ai/source.mp4',
      characterUrl: 'https://cdn.example.com/person.png',
      duration: 5,
    })).rejects.toThrow(/no video/);
  });

  it('stores data-URL characters durably before submitting', async () => {
    persistMock.mockResolvedValue({ url: 'https://storage.example.com/char.png' });
    const url = await resolveRecastCharacterUrl('data:image/png;base64,AAAA', { role: 'presenter_identity', name: 'Ana' });
    expect(url).toBe('https://storage.example.com/char.png');
    expect(persistMock).toHaveBeenCalledWith({
      sourceUrl: 'data:image/png;base64,AAAA',
      role: 'presenter_identity',
      name: 'Ana — Recast Character',
    });

    expect(await resolveRecastCharacterUrl('https://cdn.example.com/p.png')).toBe('https://cdn.example.com/p.png');
    expect(persistMock).toHaveBeenCalledTimes(1);
  });

  it('prefers the MuAPI URL from the studio upload', async () => {
    ingestMock.mockResolvedValue({ url: 'https://storage.example.com/a.mp4', muapiUrl: 'https://cdn.muapi.ai/a.mp4' });
    expect(await uploadRecastSource(fakeFile('video/mp4', 10))).toBe('https://cdn.muapi.ai/a.mp4');
  });
});

describe('advanced editor workspace rendering', () => {
  const person = {
    id: 'person-1',
    name: 'Ana',
    url: 'https://cdn.example.com/ana.png',
    role: 'presenter_identity',
    sourceCategory: 'person',
  };

  it('renders the tool rail, tabs and only the active tab body', () => {
    const session = createPersonalizationImageEditorSession(person);
    session.mode = 'advanced';
    session.activeGroup = 'people';
    let html = renderPersonalizationImageEditorPanel(session);
    expect(html).toContain('pm-editor-workspace');
    expect(html).toContain('data-editor-action="recast-open"');
    expect(html).toContain('data-editor-tab="adjust"');
    expect(html).toContain('data-editor-operation="full_body_recast"');
    expect(html).not.toContain('data-editor-local="zoom"');

    session.panelTab = 'adjust';
    html = renderPersonalizationImageEditorPanel(session);
    expect(html).toContain('data-editor-local="zoom"');
    expect(html).not.toContain('data-editor-segment="aspectRatio"');

    session.panelTab = 'output';
    html = renderPersonalizationImageEditorPanel(session);
    expect(html).toContain('data-editor-segment="aspectRatio"');
    expect(html).toContain('data-editor-protection="face"');
  });

  it('only offers Full Body Recast for people', () => {
    const logo = createPersonalizationImageEditorSession({ ...person, id: 'logo-1', role: 'logo', sourceCategory: 'logo' });
    logo.mode = 'advanced';
    expect(renderPersonalizationImageEditorPanel(logo)).not.toContain('recast-open');
  });

  it('renders the three recast panels and the result video when done', () => {
    const session = createPersonalizationImageEditorSession(person);
    session.mode = 'advanced';
    session.recast.open = true;
    let html = renderPersonalizationImageEditorPanel(session);
    expect(html).toContain('Source performance');
    expect(html).toContain('Character image');
    expect(html).toContain('Recast result');
    expect(html).toContain('data-recast-file');
    expect(html).toMatch(/data-editor-action="recast-run" disabled/);
    expect(html).not.toContain('pm-editor-panel');

    Object.assign(session.recast, {
      sourcePreviewUrl: 'blob:source',
      sourceUrl: 'https://cdn.muapi.ai/source.mp4',
      duration: 6,
      status: 'done',
      resultUrl: 'https://cdn.muapi.ai/recast.mp4',
    });
    html = renderPersonalizationImageEditorPanel(session);
    expect(html).toContain('data-recast-video="result"');
    expect(html).toContain('https://cdn.muapi.ai/recast.mp4');
    expect(html).not.toMatch(/data-editor-action="recast-save"\s+disabled/);
  });
});
