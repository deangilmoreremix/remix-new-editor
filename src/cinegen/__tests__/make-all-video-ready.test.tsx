// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const readyCalls: string[] = [];
vi.mock('../../lib/personalization/videoReady.js', () => ({
  makePersonalizationAssetVideoReady: vi.fn(async (asset: { id: string }) => {
    readyCalls.push(asset.id);
    if (asset.id === 'bad-logo') throw Object.assign(new Error('no key'), { code: 'NO_KEY' });
    return { url: `https://ready.test/${asset.id}.png`, videoReady: true };
  }),
}));
vi.mock('../../lib/personalization/assetDiscoveryService.js', () => ({
  persistPersonalizationAssetVersion: vi.fn(async ({ sourceUrl }: { sourceUrl: string }) => ({ url: sourceUrl })),
  importDiscoveredAsset: vi.fn(),
}));

import { makeAllVideoReady, personalizedImageKeys } from '../lib/personalize/contact-image-services';
import { PersonalizedLayoutsPanel } from '../components/edit/personalized-layouts-panel';

const asset = (id: string, role: string, extra = {}) => ({ id, url: `https://img.test/${id}.png`, type: 'image', role, name: id, ...extra });
const profile = (id: string, first: string, assets: Record<string, unknown>) => ({ id, name: first, contact: { firstName: first, name: first }, variables: {}, personalization: { assets } });
const seed = (list: unknown[]) => localStorage.setItem('remix_contact_profiles', JSON.stringify(list));
const overlays = (...srcs: string[]) => srcs.map((src, i) => ({ id: `o${i}`, type: 'overlay-personalized-image', addon: { src } }));

beforeEach(() => { localStorage.clear(); readyCalls.length = 0; });

describe('Make all Video Ready', () => {
  it('works on the image tokens the timeline uses', () => {
    expect(personalizedImageKeys([...overlays('{{logoUrl}}', '{{image}}', '{{logoUrl}}'), { id: 't', type: 'overlay-text', addon: { src: '{{logoUrl}}' } }])).toEqual(['logoUrl', 'avatarUrl']);
  });
  it('asks for a Personalized Image first', async () => {
    seed([profile('a', 'Ada', {})]);
    const r = await makeAllVideoReady([{ id: 't', type: 'overlay-text' }], { notify: vi.fn() });
    expect(r).toMatchObject({ total: 0, done: 0 });
    expect(r.message).toMatch(/Add a Personalized Image/);
  });
  it('skips pictures that are ready or missing, runs the rest one at a time, and counts failures', async () => {
    seed([
      profile('a', 'Ada', { logos: [asset('l-ada', 'logo')], primaryLogoId: 'l-ada' }),
      profile('b', 'Bo', { logos: [asset('l-bo', 'logo', { videoReady: true })], primaryLogoId: 'l-bo' }), // already ready
      profile('c', 'Cy', {}),                                                                              // no logo
      profile('d', 'Di', { logos: [asset('bad-logo', 'logo')], primaryLogoId: 'bad-logo' }),               // fails
    ]);
    const progress: string[] = [];
    const notes: Array<[string, string | undefined]> = [];
    const r = await makeAllVideoReady(overlays('{{logoUrl}}'), { notify: (m, k) => notes.push([m, k]), onProgress: (d, t, who) => progress.push(`${d}/${t}:${who}`) });
    expect(readyCalls).toEqual(['l-ada', 'bad-logo']); // in order, only the two that needed it
    expect(r).toMatchObject({ total: 2, done: 1 });
    expect(r.message).toMatch(/1 of 2 images are now Video Ready/);
    expect(progress).toEqual(['0/2:Ada', '1/2:Di', '1/2:']);
    expect(notes.some(([m, k]) => k === 'error' && /Video Ready failed for Di/.test(m))).toBe(true);
    // the saved picture is now ready, so a second run has nothing left for Ada
    readyCalls.length = 0;
    const again = await makeAllVideoReady(overlays('{{logoUrl}}'), { notify: vi.fn() });
    expect(readyCalls).toEqual(['bad-logo']);
    expect(again.total).toBe(1);
  });
  it('says so when everything is already ready', async () => {
    seed([profile('b', 'Bo', { logos: [asset('l-bo', 'logo', { videoReady: true })], primaryLogoId: 'l-bo' })]);
    expect((await makeAllVideoReady(overlays('{{logoUrl}}'), { notify: vi.fn() })).message).toMatch(/already Video Ready/);
  });
  it('the layouts tab runs it with live progress and shows the result', async () => {
    let finish: (v: { total: number; done: number; message: string }) => void = () => undefined;
    const run = vi.fn((h: { onProgress: (d: number, t: number, w: string) => void }) => { h.onProgress(0, 2, 'Ada'); return new Promise<{ total: number; done: number; message: string }>((res) => { finish = res; }); });
    render(<PersonalizedLayoutsPanel onPick={() => ({ ok: true, message: '' })} onMakeAllVideoReady={run as never} />);
    fireEvent.click(screen.getByTestId('make-all-ready-btn'));
    await waitFor(() => expect(screen.getByTestId('make-all-ready-status').textContent).toBe('Making images Video Ready: 1 of 2 (Ada)…'));
    expect((screen.getByTestId('make-all-ready-btn') as HTMLButtonElement).disabled).toBe(true);
    finish({ total: 2, done: 2, message: '2 of 2 images are now Video Ready.' });
    await waitFor(() => expect(screen.getByTestId('make-all-ready-status').textContent).toBe('2 of 2 images are now Video Ready.'));
    expect((screen.getByTestId('make-all-ready-btn') as HTMLButtonElement).disabled).toBe(false);
  });
});
