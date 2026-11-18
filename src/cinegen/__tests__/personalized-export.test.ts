// [remix] Export tab, Personalized output: one MP4 per chosen contact, filled in with that contact's details.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const downloads: Array<{ name: string; size: number }> = [];
const rendered: Array<{ layers: unknown[] }> = [];
let failFor = '';

vi.mock('../../lib/editor/remotion/exportClient.js', () => ({
  exportModel: vi.fn(async (model: { layers: unknown[] }) => {
    if (failFor && JSON.stringify(model.layers).includes(failFor)) throw new Error('encoder stopped');
    rendered.push(model);
    return new Blob(['x'.repeat(1000)], { type: 'video/mp4' });
  }),
  downloadBlob: vi.fn((blob: Blob, name: string) => { downloads.push({ name, size: blob.size }); }),
}));
vi.mock('../../lib/contactStore.js', () => ({
  listProfiles: () => [
    { id: 'c-ann', name: 'Ann Lee', variables: { firstName: 'Ann' }, contact: { firstName: 'Ann', lastName: 'Lee' } },
    { id: 'c-raj', name: 'Raj Patel', variables: { firstName: 'Raj' }, contact: { firstName: 'Raj', lastName: 'Patel' } },
    { id: 'c-ann2', name: 'Ann Lee', variables: { firstName: 'Ann' }, contact: { firstName: 'Ann', lastName: 'Lee' } },
  ],
}));
vi.mock('../../lib/editor/remotion/TimelineComposition.jsx', () => ({ TimelineComposition: () => null })); // the renderer itself is not under test
vi.mock('../../lib/supabase.js', () => ({ uploadFileToStorage: vi.fn(), getSupabaseUrl: () => '', getSupabaseAnonKey: () => '' }));

// @ts-expect-error plain JS
import '../../lib/editor/addons/overlayAddons.js';
// @ts-expect-error plain JS
import { createAddonClip } from '../../lib/editor/addons/registry.js';
import { installElectronShim } from '../adapters/electron-shim';
import { registerWebApi } from '../adapters/web-api';

type Api = { export: { start: (p: unknown) => Promise<{ id: string }>; poll: (id: string) => Promise<Record<string, unknown>> } };
const api = () => (window as unknown as { electronAPI: Api }).electronAPI;

const text = createAddonClip('overlay-text', { startSec: 0, timelineSeconds: 3 }) as Record<string, unknown>;
text.addon = { ...(text.addon as object), text: 'Hello {{firstName}}' };
const base = {
  preset: 'draft', fps: 30, totalDuration: 3, title: 'Spring promo',
  clips: [{ id: 'c1', inputPath: 'https://x.test/a.mp4', startTime: 0, duration: 3, trimStart: 0, speed: 1, volume: 1, type: 'video' }],
  overlays: [{ ...text, id: 'ov1', type: 'overlay-text', start: 0, end: 3 }],
};
async function run(extra: Record<string, unknown>) {
  const { id } = await api().export.start({ ...base, ...extra });
  let job: Record<string, unknown> = {};
  await vi.waitFor(async () => { job = await api().export.poll(id); expect(['complete', 'failed']).toContain(job.status); }, { timeout: 5000 });
  return job;
}

beforeEach(() => { (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:test'; downloads.length = 0; rendered.length = 0; failFor = ''; installElectronShim(); registerWebApi(); });

describe('Export tab: one video per contact', () => {
  it('renders and downloads one named MP4 per chosen contact, each filled with that person\'s details', async () => {
    const job = await run({ contactIds: ['c-ann', 'c-raj'] });
    expect(job).toMatchObject({ status: 'complete', done: 2, total: 2 });
    expect(downloads.map((d) => d.name)).toEqual(['Spring promo - Ann Lee.mp4', 'Spring promo - Raj Patel.mp4']);
    expect(JSON.stringify(rendered[0].layers)).toContain('Hello Ann');
    expect(JSON.stringify(rendered[1].layers)).toContain('Hello Raj');
    expect(JSON.stringify(rendered[0].layers)).not.toContain('Hello Raj');
  });

  it('never overwrites a file when two contacts share a name', async () => {
    await run({ contactIds: ['c-ann', 'c-ann2'] });
    expect(new Set(downloads.map((d) => d.name)).size).toBe(2);
  });

  it('keeps going when one contact\'s video fails, and says which', async () => {
    failFor = 'Hello Raj';
    const job = await run({ contactIds: ['c-ann', 'c-raj'] });
    expect(job).toMatchObject({ status: 'complete', done: 1, total: 2 });
    expect(String((job.failures as string[])[0])).toMatch(/Raj Patel.*encoder stopped/);
    expect(downloads).toHaveLength(1);
  });

  it('fails plainly when none of the chosen contacts exist or every video fails', async () => {
    expect((await run({ contactIds: ['nobody'] })).status).toBe('failed');
    failFor = 'Hello';
    const job = await run({ contactIds: ['c-ann', 'c-raj'] });
    expect(job.status).toBe('failed');
    expect(String(job.error)).toMatch(/encoder stopped/);
  });

  it('a normal export is still one generic video with no contact', async () => {
    const job = await run({ qa: false });
    expect(job.status).toBe('complete');
    expect(downloads.map((d) => d.name)).toEqual(['cinegen-export.mp4']);
    expect(JSON.stringify(rendered[0].layers)).not.toContain('{{firstName}}'); // unfilled tokens are removed
  });
});
