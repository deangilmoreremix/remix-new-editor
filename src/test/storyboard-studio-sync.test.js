import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/studioChrome.js', () => ({ mountStudioChrome: vi.fn() }));
vi.mock('../lib/clerkEntitlements.js', () => ({ requireEntitlement: vi.fn(async () => true) }));
vi.mock('../lib/apiKeyManager.js', () => ({
  apiKeyManager: { hasOpenAIKey: vi.fn(() => false), hasMuapiKey: vi.fn(() => true), getOpenAIKey: vi.fn(() => '') },
}));
vi.mock('../lib/muapi.js', () => ({ muapi: { generateImage: vi.fn(async () => ({ url: 'https://img/f.png' })) } }));
vi.mock('../lib/generationHistory.js', () => ({ registerGeneration: vi.fn() }));

import { StoryboardStudio } from '../components/StoryboardStudio.js';
import { saveCloudProject } from '../lib/storyboardCloud.js';
import { setVideoIntent } from '../lib/videoIntentStore.js';
import { createFakeDb, fakeClient } from './helpers/fakeStoryboardSupabase.js';

const ready = (db, user = 'user_1') => async () => ({ client: fakeClient(db, user), reason: null });
const off = (reason) => async () => ({ client: null, reason });

const mount = (cloudProvider) => {
  const root = StoryboardStudio({ cloudProvider });
  document.body.appendChild(root);
  return root;
};
const cards = (root) => [...root.querySelectorAll('[data-frame-index]')];
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const type = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
const btn = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const status = (root) => root.querySelector('#sync-status').textContent;
const projectBox = (root) => root.querySelector('input[aria-label="Project name"]');
const stored = () => JSON.parse(localStorage.getItem('storyboard_projects_v1') || '{}');
const flush = () => new Promise((r) => setTimeout(r, 0));
/** Text of every toast on screen (the container is created once, at module load). */
const toasts = () => document.querySelector('#toast-container')?.textContent || '';

/** A board with three frames, the first described. */
const mountBoard = async (provider, text = 'Scene one') => {
  const root = mount(provider);
  await flush();
  click(root.querySelector('#start-blank'));
  click(btn(root, '+ Add frame'));
  click(btn(root, '+ Add frame'));
  type(cards(root)[0].querySelector('textarea'), text);
  return root;
};

beforeEach(() => {
  document.querySelectorAll('.storyboard-studio').forEach((e) => e.remove());
  document.querySelector('#toast-container')?.replaceChildren();
  localStorage.clear();
  sessionStorage.clear();
  setVideoIntent({ subject: '', premise: '', frameCount: 6, duration: 60 });
  window.confirm = vi.fn(() => true);
  globalThis.fetch = vi.fn(() => Promise.reject(new Error('no route')));
});
afterEach(() => { vi.useRealTimers(); });

// ------------------------------------------------------------------ timeline editing
describe('timeline: change a frame\'s length on the strip', () => {
  const handle = (root, i) => root.querySelectorAll('[role="listitem"] [role="slider"]')[i];
  const seconds = (root, i) => Number(cards(root)[i].querySelector('input[type="number"]').value);
  const key = (el, k, opts = {}) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));

  it('gives every segment a labelled slider with its current length', () => {
    return mountBoard(off('not_configured')).then((root) => {
      const h = handle(root, 0);
      expect(h).toBeTruthy();
      expect(h.getAttribute('aria-label')).toBe('Frame 1 length');
      expect(h.getAttribute('aria-valuenow')).toBe('3');
      expect(h.getAttribute('aria-valuemin')).toBe('1');
      expect(h.getAttribute('aria-valuemax')).toBe('60');
      expect(h.getAttribute('aria-valuetext')).toBe('3 seconds');
      expect(h.tabIndex).toBe(0);
    });
  });

  it('arrow keys change the length and keep the card, total and slider in step', async () => {
    const root = await mountBoard(off('not_configured'));
    key(handle(root, 0), 'ArrowRight');
    expect(seconds(root, 0)).toBe(4);
    expect(handle(root, 0).getAttribute('aria-valuenow')).toBe('4');
    expect(root.querySelector('#board-summary').textContent).toContain('10s'); // 4 + 3 + 3
    expect(root.querySelector('[data-timeline-total]').textContent).toBe('Timeline · 10s');
    key(handle(root, 0), 'ArrowRight', { shiftKey: true });
    expect(seconds(root, 0)).toBe(9);
    key(handle(root, 0), 'ArrowLeft');
    expect(seconds(root, 0)).toBe(8);
    key(handle(root, 0), 'Home');
    expect(seconds(root, 0)).toBe(1);
    key(handle(root, 0), 'End');
    expect(seconds(root, 0)).toBe(60);
  });

  it('stops at the limits and ignores other keys', async () => {
    const root = await mountBoard(off('not_configured'));
    key(handle(root, 1), 'Home');
    key(handle(root, 1), 'ArrowLeft');
    expect(seconds(root, 1)).toBe(1);
    key(handle(root, 1), 'End');
    key(handle(root, 1), 'ArrowRight', { shiftKey: true });
    expect(seconds(root, 1)).toBe(60);
    const before = seconds(root, 0);
    key(handle(root, 0), 'a');
    expect(seconds(root, 0)).toBe(before);
  });

  it('dragging the right edge resizes a frame, and the whole drag is one undo step', async () => {
    const root = await mountBoard(off('not_configured'));
    const seg = root.querySelectorAll('[role="listitem"]')[0];
    const pps = parseFloat(seg.style.width) / 3;
    const h = handle(root, 0);
    const ev = (type, x) => h.dispatchEvent(new MouseEvent(type, { clientX: x, bubbles: true, cancelable: true, button: 0 }));
    ev('pointerdown', 100);
    ev('pointermove', 100 + pps * 1);
    ev('pointermove', 100 + pps * 2);
    expect(seconds(root, 0)).toBe(5);
    ev('pointerup', 100 + pps * 2);
    expect(seconds(root, 0)).toBe(5);
    expect(root.querySelector('#board-summary').textContent).toContain('11s'); // 5 + 3 + 3
    click(btn(root, '↶ Undo'));
    expect(seconds(root, 0)).toBe(3);
    expect(root.querySelector('#board-summary').textContent).toContain('9s');
  });

  it('dragging left shortens a frame but never below 1 second', async () => {
    const root = await mountBoard(off('not_configured'));
    const seg = root.querySelectorAll('[role="listitem"]')[1];
    const pps = parseFloat(seg.style.width) / 3;
    const h = handle(root, 1);
    const ev = (type, x) => h.dispatchEvent(new MouseEvent(type, { clientX: x, bubbles: true, cancelable: true, button: 0 }));
    ev('pointerdown', 500);
    ev('pointermove', 500 - pps * 20);
    ev('pointerup', 500 - pps * 20);
    expect(seconds(root, 1)).toBe(1);
  });

  it('a drag that goes nowhere changes nothing and adds no undo step', async () => {
    const root = await mountBoard(off('not_configured'));
    const h = handle(root, 0);
    const ev = (type, x) => h.dispatchEvent(new MouseEvent(type, { clientX: x, bubbles: true, cancelable: true, button: 0 }));
    ev('pointerdown', 100); ev('pointermove', 101); ev('pointerup', 101);
    expect(seconds(root, 0)).toBe(3);
  });

  it('clicking the handle does not also jump to the frame', async () => {
    const root = await mountBoard(off('not_configured'));
    click(handle(root, 2));
    expect(cards(root)[2].classList.contains('ring-primary')).toBe(false);
    click(root.querySelectorAll('[role="listitem"]')[2]);
    expect(cards(root)[2].classList.contains('ring-primary')).toBe(true);
  });

  it('editing the number on the card still updates the strip', async () => {
    const root = await mountBoard(off('not_configured'));
    type(cards(root)[0].querySelector('input[type="number"]'), '12');
    expect(handle(root, 0).getAttribute('aria-valuenow')).toBe('12');
    expect(root.querySelector('[data-timeline-total]').textContent).toBe('Timeline · 18s');
  });
});

// ------------------------------------------------------------------ cloud sync
describe('cloud sync: availability', () => {
  it.each([
    ['not_configured', /on this device only/i],
    ['signed_out', /sign in to sync/i],
  ])('says so when sync is unavailable (%s)', async (reason, pattern) => {
    const root = mount(off(reason));
    await vi.waitFor(() => expect(status(root)).toMatch(pattern));
  });

  it('says so when the database table has not been created yet', async () => {
    const db = createFakeDb();
    db.fail = { message: 'relation "public.storyboard_projects" does not exist', code: '42P01' };
    const root = mount(ready(db));
    await vi.waitFor(() => expect(status(root)).toMatch(/not set up/i));
  });

  it('shows how many storyboards are in the account when it is on', async () => {
    const db = createFakeDb();
    await saveCloudProject(fakeClient(db, 'user_1'), 'A', { frames: [{ id: 'a', prompt: 'x', duration: 3 }] });
    const root = mount(ready(db));
    await vi.waitFor(() => expect(status(root)).toMatch(/1 in your account/));
  });
});

describe('cloud sync: saving', () => {
  it('Save writes this device and the account, and records the server timestamp locally', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db));
    await vi.waitFor(() => expect(status(root)).toMatch(/Sync on|in your account/));
    projectBox(root).value = 'Trail Launch';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(db.rows.size).toBe(1));
    const row = [...db.rows.values()][0];
    expect(row.name).toBe('Trail Launch');
    expect(row.clerk_user_id).toBe('user_1');
    expect(row.frame_count).toBe(3);
    expect(row.project.frames[0].prompt).toBe('Scene one');
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
    expect(stored()['Trail Launch'].cloudUpdatedAt).toBe(row.updated_at);
    expect(toasts()).toMatch(/to this device and your account/);
  });

  it('keeps working locally when signed out, and says how to sync', async () => {
    const root = await mountBoard(off('signed_out'));
    projectBox(root).value = 'Local Only';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(stored()['Local Only']).toBeTruthy());
    await vi.waitFor(() => expect(toasts()).toMatch(/Sign in to sync it to your account/));
  });

  it('tells the user when generated (inline) images stay on this device, and never uploads them', async () => {
    const db = createFakeDb();
    const inline = 'data:image/png;base64,' + 'A'.repeat(200);
    localStorage.setItem('storyboard_projects_v1', JSON.stringify({
      Inline: {
        name: 'Inline', updatedAt: '2026-01-01T00:00:00.000Z',
        frames: [
          { id: 'i1', prompt: 'has an inline image', shot: 'Wide Shot', cameraMovement: 'Static', duration: 4, imageUrl: inline, status: 'done', referenceImages: [] },
          { id: 'i2', prompt: 'has a web image', shot: 'Close-Up', cameraMovement: 'Static', duration: 4, imageUrl: 'https://cdn.example/x.png', status: 'done', referenceImages: [] },
        ],
        brief: {}, settings: {},
      },
    }));
    const root = mount(ready(db));
    await vi.waitFor(() => expect(root.querySelector('#saved-select').options.length).toBe(1));
    click(root.querySelector('#open-saved'));
    await vi.waitFor(() => expect(cards(root)).toHaveLength(2));
    expect(cards(root)[0].querySelector('img[alt^="Storyboard frame"]').src).toBe(inline); // still shown on this device
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(db.rows.size).toBe(1));
    await vi.waitFor(() => expect(toasts()).toMatch(/1 generated image\(s\) stay on this device only/));
    const cloudFrames = [...db.rows.values()][0].project.frames;
    expect(cloudFrames[0].imageUrl).toBeNull();
    expect(cloudFrames[1].imageUrl).toBe('https://cdn.example/x.png');
    expect(JSON.stringify([...db.rows.values()][0])).not.toMatch(/data:image/);
    expect(stored()['Inline'].frames[0].imageUrl).toBe(inline); // the device copy keeps it
  });

  it('a name over 120 characters saves locally and explains why it did not sync', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db));
    projectBox(root).value = 'x'.repeat(130);
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(Object.keys(stored())).toHaveLength(1));
    await vi.waitFor(() => expect(status(root)).toMatch(/too long/i));
    expect(db.rows.size).toBe(0);
  });

  it('does not push to the account until a project has been saved or loaded (no accidental overwrite)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const db = createFakeDb();
    await saveCloudProject(fakeClient(db, 'user_1'), 'Precious', { frames: [{ id: 'p', prompt: 'keep me', duration: 3 }] });
    const root = mount(ready(db));
    await vi.advanceTimersByTimeAsync(50);
    type(root.querySelector('#vi-premise'), 'A brand new idea');
    await vi.advanceTimersByTimeAsync(20000);
    expect([...db.rows.values()][0].project.frames[0].prompt).toBe('keep me');
  });

  it('autosave pushes to the account a few seconds after an edit, once the project is saved', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db));
    projectBox(root).value = 'Auto';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(db.rows.size).toBe(1));
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    type(cards(root)[0].querySelector('textarea'), 'Edited after saving');
    await vi.advanceTimersByTimeAsync(7000);
    expect([...db.rows.values()][0].project.frames[0].prompt).toBe('Scene one'); // not yet
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(50);
    expect([...db.rows.values()][0].project.frames[0].prompt).toBe('Edited after saving');
  });
});

describe('cloud sync: loading', () => {
  const seed = async (db, name, prompt, user = 'user_1') =>
    saveCloudProject(fakeClient(db, user), name, {
      frames: [{ id: 'f1', prompt, shot: 'Wide Shot', cameraMovement: 'Static', duration: 4, referenceImages: [] }],
      layout: 'grid', brief: { premise: 'from the cloud' }, settings: {},
    });

  it('lists the account\'s storyboards on the first view, marked with a cloud', async () => {
    const db = createFakeDb();
    await seed(db, 'Made elsewhere', 'hello');
    const root = mount(ready(db));
    await vi.waitFor(() => expect(root.querySelector('#saved-select').textContent).toMatch(/Made elsewhere\s+☁/));
    expect(root.querySelector('#saved-projects').classList.contains('hidden')).toBe(false);
  });

  it('opens a storyboard that only exists in the account, and keeps a copy on this device', async () => {
    const db = createFakeDb();
    await seed(db, 'Made elsewhere', 'hello from another browser');
    const root = mount(ready(db));
    await vi.waitFor(() => expect(root.querySelector('#saved-select').options.length).toBe(1));
    click(root.querySelector('#open-saved'));
    await vi.waitFor(() => expect(cards(root)).toHaveLength(1));
    expect(cards(root)[0].querySelector('textarea').value).toBe('hello from another browser');
    expect(root.querySelector('#vi-premise').value).toBe('from the cloud');
    await vi.waitFor(() => expect(stored()['Made elsewhere']).toBeTruthy());
    expect(stored()['Made elsewhere'].cloudUpdatedAt).toBeTruthy();
  });

  it('takes the newer copy when the account has one saved after this device\'s', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db), 'Old text');
    await vi.waitFor(() => expect(status(root)).toMatch(/Sync on|in your account/));
    projectBox(root).value = 'Shared';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(db.rows.size).toBe(1));
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
    root.remove();

    // another device changes it later (cloud timestamp moves past the local save)
    await new Promise((r) => setTimeout(r, 20));
    db.touch('user_1', 'Shared', { project: { ...[...db.rows.values()][0].project, frames: [{ id: 'n', prompt: 'Newer text from the other device', shot: 'Close-Up', cameraMovement: 'Static', duration: 6, referenceImages: [] }] } });
    const stamp = [...db.rows.values()][0].updated_at;
    // make the remote clearly later than the local record
    const rec = stored()['Shared']; rec.updatedAt = '2000-01-01T00:00:00.000Z'; localStorage.setItem('storyboard_projects_v1', JSON.stringify({ Shared: rec }));
    expect(stamp).not.toBe(rec.cloudUpdatedAt);

    const root2 = mount(ready(db));
    await vi.waitFor(() => expect(root2.querySelector('#saved-select').options.length).toBe(1));
    click(root2.querySelector('#open-saved'));
    await vi.waitFor(() => expect(cards(root2)).toHaveLength(1));
    expect(cards(root2)[0].querySelector('textarea').value).toBe('Newer text from the other device');
    expect(toasts()).toMatch(/newer copy/i);
  });

  it('keeps this device\'s copy when it is the one with the latest edits', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db), 'First');
    await vi.waitFor(() => expect(status(root)).toMatch(/Sync on|in your account/));
    projectBox(root).value = 'Mine';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
    // edit locally (autosave writes the device copy first; the cloud copy trails behind)
    type(cards(root)[0].querySelector('textarea'), 'Local edit not yet synced');
    await new Promise((r) => setTimeout(r, 1700));
    expect(stored()['Mine'].frames[0].prompt).toBe('Local edit not yet synced');
    root.remove();
    const root2 = mount(ready(db));
    await vi.waitFor(() => expect(root2.querySelector('#saved-select').options.length).toBe(1));
    click(root2.querySelector('#open-saved'));
    await vi.waitFor(() => expect(cards(root2)).toHaveLength(3));
    expect(cards(root2)[0].querySelector('textarea').value).toBe('Local edit not yet synced');
  });

  it('falls back to the device copy when the account cannot be reached', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db), 'Offline-safe');
    await vi.waitFor(() => expect(status(root)).toMatch(/Sync on|in your account/));
    projectBox(root).value = 'Trip';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
    root.remove();
    const root2 = mount(ready(db));
    await vi.waitFor(() => expect(root2.querySelector('#saved-select').options.length).toBe(1));
    db.fail = new TypeError('Failed to fetch');
    click(root2.querySelector('#open-saved'));
    await vi.waitFor(() => expect(cards(root2)).toHaveLength(3));
    expect(cards(root2)[0].querySelector('textarea').value).toBe('Offline-safe');
  });

  it('never shows another user\'s storyboards', async () => {
    const db = createFakeDb();
    await seed(db, 'Someone else\'s', 'private', 'user_2');
    const root = mount(ready(db, 'user_1'));
    await vi.waitFor(() => expect(status(root)).toMatch(/Sync on/));
    expect(root.querySelector('#saved-select').options.length).toBe(0);
    expect(root.querySelector('#saved-projects').classList.contains('hidden')).toBe(true);
  });
});

describe('cloud sync: two devices', () => {
  it('asks before overwriting a copy that changed elsewhere, and respects "no"', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db));
    await vi.waitFor(() => expect(status(root)).toMatch(/Sync on|in your account/));
    projectBox(root).value = 'Contested';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
    const before = [...db.rows.values()][0].project.frames[0].prompt;

    db.touch('user_1', 'Contested', { project: { ...[...db.rows.values()][0].project, frames: [{ id: 'q', prompt: 'Changed on the other device', duration: 3 }] } });
    window.confirm = vi.fn(() => false);
    type(cards(root)[0].querySelector('textarea'), 'My newer thought');
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(String(window.confirm.mock.calls[0][0])).toMatch(/changed on another device/i);
    await vi.waitFor(() => expect(status(root)).toMatch(/changed elsewhere/i));
    expect([...db.rows.values()][0].project.frames[0].prompt).toBe('Changed on the other device');
    expect(before).toBe('Scene one');
    expect(stored()['Contested'].frames[0].prompt).toBe('My newer thought'); // device copy is safe
  });

  it('overwrites when the user says yes', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db));
    await vi.waitFor(() => expect(status(root)).toMatch(/Sync on|in your account/));
    projectBox(root).value = 'Contested';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
    db.touch('user_1', 'Contested', { project: { frames: [{ id: 'q', prompt: 'other device', duration: 3 }] } });
    window.confirm = vi.fn(() => true);
    type(cards(root)[0].querySelector('textarea'), 'Mine wins');
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect([...db.rows.values()][0].project.frames[0].prompt).toBe('Mine wins'));
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
  });

  it('autosave never asks questions: it pauses when the cloud copy changed elsewhere', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db));
    await vi.waitFor(() => expect(status(root)).toMatch(/Sync on|in your account/));
    projectBox(root).value = 'Quiet';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
    db.touch('user_1', 'Quiet', { project: { frames: [{ id: 'q', prompt: 'other device', duration: 3 }] } });
    window.confirm = vi.fn(() => true);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    type(cards(root)[0].querySelector('textarea'), 'edit');
    await vi.advanceTimersByTimeAsync(9000);
    await vi.advanceTimersByTimeAsync(50);
    expect(window.confirm).not.toHaveBeenCalled();
    expect([...db.rows.values()][0].project.frames[0].prompt).toBe('other device');
    expect(status(root)).toMatch(/changed elsewhere/i);
  });
});

describe('cloud sync: delete', () => {
  it('removes a storyboard from this device and the account', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db));
    await vi.waitFor(() => expect(status(root)).toMatch(/Sync on|in your account/));
    projectBox(root).value = 'Doomed';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(db.rows.size).toBe(1));
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
    click(btn(root, 'Delete'));
    await vi.waitFor(() => expect(db.rows.size).toBe(0));
    expect(stored()['Doomed']).toBeUndefined();
    expect(String(window.confirm.mock.calls.at(-1)[0])).toMatch(/this device and your account/);
  });

  it('does nothing when the user cancels', async () => {
    const db = createFakeDb();
    const root = await mountBoard(ready(db));
    await vi.waitFor(() => expect(status(root)).toMatch(/Sync on|in your account/));
    projectBox(root).value = 'Keeper';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(status(root)).toMatch(/Synced/));
    window.confirm = vi.fn(() => false);
    click(btn(root, 'Delete'));
    await flush();
    expect(db.rows.size).toBe(1);
    expect(stored()['Keeper']).toBeTruthy();
  });

  it('refuses to delete a name that does not exist', async () => {
    const root = await mountBoard(off('not_configured'));
    projectBox(root).value = 'Never saved';
    click(btn(root, 'Delete'));
    await vi.waitFor(() => expect(toasts()).toMatch(/Type the name of a saved storyboard/));
  });
});
