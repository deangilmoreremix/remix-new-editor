import { describe, it, expect } from 'vitest';
import {
  prepareCloudProject, classifyCloudError, toCloudError, CloudSyncError,
  saveCloudProject, loadCloudProject, listCloudProjects, deleteCloudProject, isNewer, MAX_CLOUD_BYTES,
} from '../lib/storyboardCloud.js';
import { createFakeDb, fakeClient } from './helpers/fakeStoryboardSupabase.js';

const state = (extra = {}) => ({
  frames: [
    { id: 'a', prompt: 'one', shot: 'Wide Shot', duration: 5, imageUrl: 'https://cdn/x.png', status: 'done', referenceImages: [{ url: 'https://cdn/r.png', thumbnail: 'https://cdn/rt.png' }] },
    { id: 'b', prompt: 'two', shot: 'Close-Up', duration: 7, imageUrl: 'data:image/png;base64,AAAA', status: 'done', referenceImages: [{ url: 'data:image/png;base64,BBBB' }] },
    { id: 'c', prompt: 'three', duration: 3, imageUrl: null, status: 'failed' },
  ],
  layout: 'grid', selectedModel: 'nano-banana', selectedAr: '16:9', settings: { negativePrompt: 'blurry' }, brief: { premise: 'p' },
  ...extra,
});

describe('prepareCloudProject', () => {
  it('keeps web images, drops inline (data:) ones, and counts what it dropped', () => {
    const { project, strippedImages, frameCount, totalSeconds } = prepareCloudProject(state());
    expect(strippedImages).toBe(1);
    expect(project.frames[0].imageUrl).toBe('https://cdn/x.png');
    expect(project.frames[1].imageUrl).toBeNull();
    expect(frameCount).toBe(3);
    expect(totalSeconds).toBe(15);
  });

  it('drops runtime-only fields and unusable reference images', () => {
    const { project } = prepareCloudProject(state());
    expect(project.frames.every((f) => !('status' in f))).toBe(true);
    expect(project.frames[0].referenceImages).toEqual([{ url: 'https://cdn/r.png', thumbnail: 'https://cdn/rt.png' }]);
    expect(project.frames[1].referenceImages).toEqual([]);
  });

  it('carries the brief, settings and look', () => {
    const { project } = prepareCloudProject(state());
    expect(project.brief.premise).toBe('p');
    expect(project.settings.negativePrompt).toBe('blurry');
    expect(project.selectedAr).toBe('16:9');
    expect(project.version).toBe(1);
  });

  it('refuses a project too large for a row, with a clear code', () => {
    const big = state({ frames: [{ id: 'x', prompt: 'a'.repeat(MAX_CLOUD_BYTES + 10), duration: 1 }] });
    expect(() => prepareCloudProject(big)).toThrowError(CloudSyncError);
    try { prepareCloudProject(big); } catch (e) { expect(e.code).toBe('too_large'); }
  });
});

describe('classifyCloudError', () => {
  it.each([
    [{ message: 'JWT expired' }, 'signed_out'],
    [{ message: 'new row violates row-level security policy for table "storyboard_projects"', code: '42501' }, 'signed_out'],
    [{ message: 'permission denied for table storyboard_projects' }, 'signed_out'],
    [{ message: 'relation "public.storyboard_projects" does not exist', code: '42P01' }, 'not_set_up'],
    [{ message: "Could not find the table 'public.storyboard_projects' in the schema cache", code: 'PGRST205' }, 'not_set_up'],
    [{ message: 'storyboard limit reached (100 per account)' }, 'limit'],
    [new TypeError('Failed to fetch'), 'offline'],
    [{ message: 'Offline', details: '', hint: '', code: '' }, 'offline'],
    [{ message: 'TypeError: Failed to fetch', details: 'stack…', code: '' }, 'offline'],
    [{ message: 'something odd' }, 'error'],
  ])('%j -> %s', (err, code) => {
    expect(classifyCloudError(err)).toBe(code);
  });

  it('turns any failure into a CloudSyncError carrying a user-facing message', () => {
    const e = toCloudError({ message: 'JWT expired' });
    expect(e).toBeInstanceOf(CloudSyncError);
    expect(e.code).toBe('signed_out');
    expect(e.message).toMatch(/sign in/i);
  });
});

describe('saving, loading, listing and deleting', () => {
  it('round-trips a project and returns the server timestamp', async () => {
    const db = createFakeDb();
    const c = fakeClient(db, 'user_1');
    const saved = await saveCloudProject(c, 'Launch', state());
    expect(saved.updatedAt).toBeTruthy();
    expect(saved.strippedImages).toBe(1);
    const loaded = await loadCloudProject(c, 'Launch');
    expect(loaded.state.frames).toHaveLength(3);
    expect(loaded.updatedAt).toBe(saved.updatedAt);
    expect(await loadCloudProject(c, 'Nope')).toBeNull();
  });

  it('saving the same name again replaces it (one row)', async () => {
    const db = createFakeDb();
    const c = fakeClient(db, 'user_1');
    await saveCloudProject(c, 'Launch', state());
    await saveCloudProject(c, 'Launch', state({ frames: [{ id: 'z', prompt: 'only', duration: 2 }] }));
    expect(db.rows.size).toBe(1);
    expect((await loadCloudProject(c, 'Launch')).state.frames).toHaveLength(1);
  });

  it('lists only the signed-in user\'s projects, newest first', async () => {
    const db = createFakeDb();
    await saveCloudProject(fakeClient(db, 'user_1'), 'Old', state());
    await saveCloudProject(fakeClient(db, 'user_2'), 'Theirs', state());
    await saveCloudProject(fakeClient(db, 'user_1'), 'New', state());
    const list = await listCloudProjects(fakeClient(db, 'user_1'));
    expect(list.map((r) => r.name)).toEqual(['New', 'Old']);
    expect(list[0]).toHaveProperty('updated_at');
    expect(list[0].frame_count).toBe(3);
  });

  it('never returns another user\'s project by name', async () => {
    const db = createFakeDb();
    await saveCloudProject(fakeClient(db, 'user_2'), 'Secret', state());
    expect(await loadCloudProject(fakeClient(db, 'user_1'), 'Secret')).toBeNull();
  });

  it('deletes by name', async () => {
    const db = createFakeDb();
    const c = fakeClient(db, 'user_1');
    await saveCloudProject(c, 'Launch', state());
    await deleteCloudProject(c, 'Launch');
    expect(await listCloudProjects(c)).toEqual([]);
  });

  it('rejects an empty or over-long name before touching the network', async () => {
    const c = fakeClient(createFakeDb(), 'user_1');
    await expect(saveCloudProject(c, '  ', state())).rejects.toThrow(/name/i);
    await expect(saveCloudProject(c, 'x'.repeat(121), state())).rejects.toThrow(/120/);
  });
});

describe('conflicts between devices', () => {
  it('refuses to overwrite a copy that changed since this device last saw it', async () => {
    const db = createFakeDb();
    const c = fakeClient(db, 'user_1');
    const first = await saveCloudProject(c, 'Launch', state());
    db.touch('user_1', 'Launch'); // another browser saves
    await expect(saveCloudProject(c, 'Launch', state(), { expectedUpdatedAt: first.updatedAt }))
      .rejects.toMatchObject({ code: 'conflict' });
  });

  it('overwrites when told to', async () => {
    const db = createFakeDb();
    const c = fakeClient(db, 'user_1');
    const first = await saveCloudProject(c, 'Launch', state());
    db.touch('user_1', 'Launch');
    const forced = await saveCloudProject(c, 'Launch', state({ layout: 'story' }), { expectedUpdatedAt: first.updatedAt, force: true });
    expect(forced.updatedAt).not.toBe(first.updatedAt);
    expect((await loadCloudProject(c, 'Launch')).state.layout).toBe('story');
  });

  it('saves normally when the cloud copy is the one this device last saw', async () => {
    const db = createFakeDb();
    const c = fakeClient(db, 'user_1');
    const first = await saveCloudProject(c, 'Launch', state());
    await expect(saveCloudProject(c, 'Launch', state(), { expectedUpdatedAt: first.updatedAt })).resolves.toBeTruthy();
  });

  it('a first save with a known stamp but no cloud row just creates it', async () => {
    const c = fakeClient(createFakeDb(), 'user_1');
    await expect(saveCloudProject(c, 'Fresh', state(), { expectedUpdatedAt: '2020-01-01T00:00:00Z' })).resolves.toBeTruthy();
  });
});

describe('failures surface as typed errors', () => {
  it('maps a missing table, a signed-out caller and an offline network', async () => {
    const db = createFakeDb();
    const c = fakeClient(db, 'user_1');
    db.fail = { message: 'relation "public.storyboard_projects" does not exist', code: '42P01' };
    await expect(listCloudProjects(c)).rejects.toMatchObject({ code: 'not_set_up' });
    db.fail = { message: 'JWT expired' };
    await expect(saveCloudProject(c, 'x', state())).rejects.toMatchObject({ code: 'signed_out' });
    db.fail = new TypeError('Failed to fetch');
    await expect(deleteCloudProject(c, 'x')).rejects.toMatchObject({ code: 'offline' });
  });
});

describe('isNewer', () => {
  it('compares instants, treating a missing value as oldest', () => {
    expect(isNewer('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(true);
    expect(isNewer('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')).toBe(false);
    expect(isNewer('2026-01-01T00:00:00Z', undefined)).toBe(true);
    expect(isNewer(undefined, '2026-01-01T00:00:00Z')).toBe(false);
  });
});
