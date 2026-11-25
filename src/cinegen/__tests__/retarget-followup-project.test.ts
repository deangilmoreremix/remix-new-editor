import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const projects = vi.hoisted(() => ({
  loadAvailableProject: vi.fn(),
  createAvailableProject: vi.fn(),
  saveAvailableProject: vi.fn(),
}));
const store = vi.hoisted(() => ({ createFollowupProject: vi.fn() }));
vi.mock('@cinegen/lib/cloud/projects', () => projects);
vi.mock('../../lib/editor/projectLibrary/projectStore.js', () => store);
vi.mock('@cinegen/lib/leads/overview-deps', () => ({ OPEN_PROJECT_EVENT: 'remix:cinegen-open-project' })); // the real module drags in the whole app

import { cinegenSource, openCinegenFollowup } from '@cinegen/lib/leads/followup-project';
import { OPEN_PROJECT_EVENT } from '@cinegen/lib/leads/overview-deps';
import { linkedProjectId } from '@cinegen/lib/leads/project-link';
import { buildPublishState } from '@cinegen/lib/leads/publish-state';

const original = { id: 'row-orig', name: 'Roof promo — Timeline 1', settings: { source: 'cinegen', cinegenProjectId: 'cloud_orig', timelineId: 'tl-1', interestMap: [{ id: 's1' }] } };
const saved = {
  project: { id: 'cloud_orig', name: 'Roof promo', created_at: 'old', updated_at: 'old' },
  assets: [{ id: 'a1' }],
  timelines: [{ id: 'tl-1', project_id: 'cloud_orig', name: 'Timeline 1', clips: [{ id: 'c1' }] }],
  exports: [{ id: 'old-export' }],
  overlays: [{ id: 'o1', type: 'overlay-text' }],
};

describe('Create follow-up in CineGen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projects.loadAvailableProject.mockResolvedValue(saved);
    projects.createAvailableProject.mockResolvedValue({ project: { id: 'cloud_new' } });
    projects.saveAvailableProject.mockResolvedValue(undefined);
    store.createFollowupProject.mockResolvedValue({ id: 'row-new' });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('knows which CineGen project and timeline a published row came from', () => {
    expect(cinegenSource(original)).toEqual({ cinegenProjectId: 'cloud_orig', timelineId: 'tl-1' });
    expect(cinegenSource({ id: 'x', settings: {} })).toBeNull();
    expect(cinegenSource({ id: 'x', settings: null })).toBeNull();
  });

  it('copies the project under a new id, links the follow-up row to it, and opens it', async () => {
    const opened = vi.fn();
    window.addEventListener(OPEN_PROJECT_EVENT, opened as EventListener);
    const out = await openCinegenFollowup({ client: {}, original, followup: { interest: 'Pricing' } });
    window.removeEventListener(OPEN_PROJECT_EVENT, opened as EventListener);

    expect(out).toEqual({ id: 'cloud_new' });
    expect(projects.createAvailableProject).toHaveBeenCalledWith('Roof promo: Pricing follow-up');

    const [savedId, copy] = projects.saveAvailableProject.mock.calls[0];
    expect(savedId).toBe('cloud_new');
    expect(copy.project).toMatchObject({ id: 'cloud_new', name: 'Roof promo: Pricing follow-up' });
    expect(copy.timelines[0]).toMatchObject({ id: 'tl-1', project_id: 'cloud_new', clips: [{ id: 'c1' }] }); // same timeline and clips, new owner
    expect(copy.assets).toEqual([{ id: 'a1' }]);
    expect(copy.overlays).toEqual([{ id: 'o1', type: 'overlay-text' }]);
    expect(copy.exports).toEqual([]);                                  // nothing rendered or published yet
    expect(saved.timelines[0].project_id).toBe('cloud_orig');          // the original is never modified
    expect(saved.exports).toHaveLength(1);

    const rowId = await linkedProjectId('cloud_new', 'tl-1');
    expect(store.createFollowupProject).toHaveBeenCalledWith({}, 'row-orig', { interest: 'Pricing' }, {
      id: rowId,
      settings: expect.objectContaining({ source: 'cinegen', cinegenProjectId: 'cloud_new', timelineId: 'tl-1' }),
    });
    expect(opened).toHaveBeenCalledTimes(1);
    expect((opened.mock.calls[0][0] as CustomEvent).detail).toEqual({ id: 'cloud_new' });
  });

  it('refuses a video that was not made in CineGen, and creates nothing', async () => {
    await expect(openCinegenFollowup({ client: {}, original: { id: 'x', settings: {} }, followup: { interest: 'Pricing' } })).rejects.toThrow(/not made in the CineGen editor/);
    expect(projects.createAvailableProject).not.toHaveBeenCalled();
    expect(store.createFollowupProject).not.toHaveBeenCalled();
  });

  it('does not open anything when saving the copy fails', async () => {
    projects.saveAvailableProject.mockRejectedValueOnce(new Error('disk full'));
    const opened = vi.fn();
    window.addEventListener(OPEN_PROJECT_EVENT, opened as EventListener);
    await expect(openCinegenFollowup({ client: {}, original, followup: { interest: 'Pricing' } })).rejects.toThrow('disk full');
    window.removeEventListener(OPEN_PROJECT_EVENT, opened as EventListener);
    expect(store.createFollowupProject).not.toHaveBeenCalled();
    expect(opened).not.toHaveBeenCalled();
  });
});

describe('Create follow-up for a video made elsewhere', () => {
  const external = { id: 'row-ext', name: 'Webinar', settings: { source: 'external' }, data: { timelineSeconds: 90, tracks: [{ id: 'v', items: [{ src: 'https://cdn/webinar.mp4' }] }] } };
  const fresh = () => ({ project: { id: 'cloud_new' }, assets: [], timelines: [{ id: 'tl-new', project_id: 'cloud_new', clips: [], duration: 0, tracks: [{ id: 'trk-a', kind: 'audio' }, { id: 'trk-v', kind: 'video' }] }] });
  beforeEach(() => {
    vi.clearAllMocks();
    projects.createAvailableProject.mockResolvedValue({ project: { id: 'cloud_new' } });
    projects.loadAvailableProject.mockResolvedValue(fresh());
    projects.saveAvailableProject.mockResolvedValue(undefined);
    store.createFollowupProject.mockResolvedValue({ id: 'row-new' });
  });

  it('starts a new project with the original video as one clip, and links the follow-up to it as a normal CineGen video', async () => {
    const opened = vi.fn();
    window.addEventListener(OPEN_PROJECT_EVENT, opened as EventListener);
    const out = await openCinegenFollowup({ client: {}, original: external, followup: { interest: 'Pricing' } });
    window.removeEventListener(OPEN_PROJECT_EVENT, opened as EventListener);
    expect(out).toEqual({ id: 'cloud_new' });
    const [, state] = projects.saveAvailableProject.mock.calls[0];
    expect(state.assets[0]).toMatchObject({ type: 'video', url: 'https://cdn/webinar.mp4', duration: 90 });
    expect(state.timelines[0].duration).toBe(90);
    expect(state.timelines[0].clips[0]).toMatchObject({ assetId: state.assets[0].id, trackId: 'trk-v', startTime: 0, duration: 90, trimStart: 0, trimEnd: 0, speed: 1 });
    expect(store.createFollowupProject).toHaveBeenCalledWith({}, 'row-ext', { interest: 'Pricing' }, {
      id: await linkedProjectId('cloud_new', 'tl-new'),
      settings: { source: 'cinegen', cinegenProjectId: 'cloud_new', timelineId: 'tl-new' },
    });
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('says so when the stored video has no media, and creates nothing', async () => {
    await expect(openCinegenFollowup({ client: {}, original: { ...external, data: { timelineSeconds: 0, tracks: [] } }, followup: { interest: 'Pricing' } })).rejects.toThrow(/no media/);
    expect(projects.createAvailableProject).not.toHaveBeenCalled();
  });
});

describe('interest-map sections for a CineGen video', () => {
  it('carry the clip names, so the mapping reads "Opening" and "Offer" instead of Scene 1 and Scene 2', () => {
    const clip = (id: string, name: string, startTime: number) => ({ id, assetId: 'a', trackId: 'tv', name, startTime, duration: 5, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [] });
    const tl = { id: 't', tracks: [{ id: 'tv', kind: 'video' }], clips: [clip('c1', 'Opening', 0), clip('c2', 'Offer', 5)], duration: 10 } as never;
    const built = buildPublishState(tl, [{ id: 'a', type: 'video', url: 'https://cdn/v.mp4' }] as never, [], 'Roof promo');
    const items = built.tracks[0].items as Array<{ name?: string; start: number }>;
    expect(items.map((i) => i.name)).toEqual(['Opening', 'Offer']);
    expect(items.map((i) => i.start)).toEqual([0, 5]);
  });
});
