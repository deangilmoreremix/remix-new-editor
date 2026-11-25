// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const gen = vi.fn();
vi.mock('../../lib/editor/aiImageService.js', () => ({ generateImage: (...a: unknown[]) => gen(...a) }));
vi.mock('../../lib/personalization/assetDiscoveryService.js', () => ({
  persistPersonalizationAssetVersion: vi.fn(async ({ sourceUrl, role }: { sourceUrl: string; role: string }) => ({ url: `https://stored.test/${role}.jpg`, mimeType: 'image/jpeg', sourceUrl })),
  importDiscoveredAsset: vi.fn(),
}));

import { buildContactCheck, approveAiImage, removeContactImage, fillMissingWithAi, unreviewedFor } from '../lib/personalize/contact-check';
import { ContactCheckPanel } from '../components/edit/contact-check-panel';
import { PersonalizedLayoutsPanel } from '../components/edit/personalized-layouts-panel';

const img = (id: string, role: string, extra = {}) => ({ id, url: `https://img.test/${id}.png`, type: 'image', role, name: id, ...extra });
const biz = { businessName: 'Acme Roofing', industry: 'roofing', productService: 'roof repair' };
const ada = { id: 'c-ada', name: 'Ada', contact: { firstName: 'Ada', name: 'Ada' }, variables: {}, personalization: { business: biz, assets: { logos: [img('l1', 'logo', { videoReady: true })], primaryLogoId: 'l1', products: [] } } };
const bo = { id: 'c-bo', name: 'Bo', contact: { firstName: 'Bo', name: 'Bo' }, variables: {}, personalization: { business: {}, assets: { logos: [], products: [] } } };
const cy = { id: 'c-cy', name: 'Cy', contact: { firstName: 'Cy', name: 'Cy' }, variables: {}, personalization: { business: biz, assets: { logos: [], products: [img('p1', 'product_reference', { aiGenerated: true, needsReview: true, aiPrompt: 'a roof' })] } } };
const seed = (list: unknown[], selected: string | null = null) => { localStorage.setItem('remix_contact_profiles', JSON.stringify(list)); selected ? localStorage.setItem('remix_selected_contact_id', selected) : localStorage.removeItem('remix_selected_contact_id'); };
const slots = (...srcs: string[]) => srcs.map((src, i) => ({ id: `o${i}`, type: 'overlay-personalized-image', addon: { src } }));
const stored = () => JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]');

beforeEach(() => { localStorage.clear(); gen.mockReset(); });

describe('contact check table', () => {
  it('uses the timeline\'s image slots, or the four main pictures when there are none', () => {
    seed([ada]);
    expect(buildContactCheck(slots('{{logoUrl}}', '{{productImageUrl}}')).columns.map((c) => c.key)).toEqual(['logoUrl', 'productImageUrl']);
    const none = buildContactCheck([]);
    expect(none.fromTimeline).toBe(false);
    expect(none.columns.map((c) => c.key)).toEqual(['logoUrl', 'avatarUrl', 'productImageUrl', 'ctaImageUrl']);
  });
  it('flags missing, ready and AI-awaiting-review pictures, and plans AI jobs only where it can', () => {
    seed([ada, bo, cy]);
    const c = buildContactCheck(slots('{{logoUrl}}', '{{productImageUrl}}'));
    const byId = Object.fromEntries(c.rows.map((r) => [r.id, r.cells]));
    expect(byId['c-ada'][0]).toMatchObject({ url: 'https://img.test/l1.png', videoReady: true, needsReview: false });
    expect(byId['c-ada'][1].url).toBeNull();
    expect(byId['c-cy'][1]).toMatchObject({ aiGenerated: true, needsReview: true, aiPrompt: 'a roof' });
    // product image can be made for Ada (business details) but not for Bo (none); Cy already has one; logos are never made
    expect(c.jobs.map((j) => `${j.contactId}:${j.key}`)).toEqual(['c-ada:productImageUrl']);
    expect(c.skipped.map((s) => s.contactName)).toEqual(['Bo']);
  });
  it('approving clears the review flag; removing empties the slot; the export issue follows', () => {
    seed([cy], 'c-cy');
    expect(unreviewedFor(stored()[0], ['productImageUrl'])).toEqual(['productImageUrl']);
    const changed = vi.fn(); window.addEventListener('remix:contact-changed', changed);
    expect(approveAiImage('c-cy', 'p1')).toBe(true);
    expect(unreviewedFor(stored()[0], ['productImageUrl'])).toEqual([]);
    expect(stored()[0].personalization.assets.products[0].aiGenerated).toBe(true); // still marked AI, just approved
    expect(changed).toHaveBeenCalled();
    expect(removeContactImage('c-cy', 'p1')).toBe(true);
    expect(buildContactCheck(slots('{{productImageUrl}}')).rows[0].cells[0].url).toBeNull();
    expect(approveAiImage('nobody', 'x')).toBe(false);
  });
});

describe('Fill with AI', () => {
  const jobs = () => buildContactCheck(slots('{{productImageUrl}}')).jobs;
  it('makes each picture, stores it on the contact marked for review, and reports progress', async () => {
    seed([ada]);
    gen.mockResolvedValue({ ok: true, assets: [{ url: 'https://ai.test/roof.png' }] });
    const progress: string[] = []; const notify = vi.fn();
    const r = await fillMissingWithAi(jobs(), { notify, onProgress: (t) => progress.push(t) });
    expect(r).toMatchObject({ made: 1, total: 1 });
    expect(gen).toHaveBeenCalledWith(expect.objectContaining({ aspectRatio: '1:1', n: 1 }));
    expect(progress[0]).toBe('Making product image for Ada (1 of 1)…');
    const product = stored()[0].personalization.assets.products[0];
    expect(product).toMatchObject({ aiGenerated: true, needsReview: true, url: 'https://stored.test/product_reference.jpg' });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Made 1 of 1'), 'success');
  });
  it('stops at once when signed out or without a key, and carries on after another kind of error', async () => {
    seed([ada, { ...ada, id: 'c-ada2', name: 'Ada2', contact: { name: 'Ada2' } }]);
    gen.mockResolvedValue({ ok: false, error: 'Sign in to use SmartVideo AI' });
    const n1 = vi.fn();
    expect((await fillMissingWithAi(jobs(), { notify: n1 })).made).toBe(0);
    expect(gen).toHaveBeenCalledTimes(1); // the second job was not tried
    expect(n1).toHaveBeenCalledWith(expect.stringContaining('Sign in to save AI images'), 'error');
    gen.mockReset();
    gen.mockResolvedValueOnce({ ok: false, error: 'content blocked' }).mockResolvedValueOnce({ ok: true, assets: [{ url: 'https://ai.test/x.png' }] });
    const r = await fillMissingWithAi(jobs(), { notify: vi.fn() });
    expect(gen).toHaveBeenCalledTimes(2);
    expect(r.made).toBe(1);
    expect(r.message).toMatch(/content blocked/);
  });
});

describe('Check contacts panel', () => {
  it('shows the table with chips, approves and removes, and previews as a contact', async () => {
    seed([ada, bo, cy]);
    render(<ContactCheckPanel getOverlays={() => slots('{{logoUrl}}', '{{productImageUrl}}')} onBack={() => undefined} />);
    expect(screen.getByTestId('row-c-ada')).toBeTruthy();
    expect(screen.getByTestId('cell-c-bo-logoUrl').textContent).toContain('Missing');
    expect(screen.getByTestId('cell-c-ada-logoUrl').textContent).toContain('Ready');
    expect(screen.getByTestId('cell-c-cy-productImageUrl').textContent).toContain('AI · review');
    expect(screen.getByTestId('ai-fill-btn').textContent).toContain('Fill 1 with AI');
    expect(screen.getByTestId('ai-skipped').textContent).toContain('1 missing picture');
    fireEvent.click(screen.getByTestId('approve-c-cy-productImageUrl'));
    await waitFor(() => expect(screen.getByTestId('cell-c-cy-productImageUrl').textContent).not.toContain('review'));
    expect(screen.getByTestId('cell-c-cy-productImageUrl').textContent).toContain('AI');
    fireEvent.click(screen.getByTestId('preview-c-bo'));
    expect(localStorage.getItem('remix_selected_contact_id')).toBe('c-bo');
  });
  it('fills with AI from the button and shows the result', async () => {
    seed([ada]);
    gen.mockResolvedValue({ ok: true, assets: [{ url: 'https://ai.test/roof.png' }] });
    render(<ContactCheckPanel getOverlays={() => slots('{{productImageUrl}}')} onBack={() => undefined} />);
    await act(async () => { fireEvent.click(screen.getByTestId('ai-fill-btn')); });
    await waitFor(() => expect(screen.getByTestId('ai-fill-status').textContent).toContain('Made 1 of 1'));
    await waitFor(() => expect(screen.getByTestId('cell-c-ada-productImageUrl').textContent).toContain('AI · review'));
    expect(screen.queryByTestId('ai-fill')).toBeNull(); // nothing left to fill
  });
  it('says so with no contacts, and opens from the layouts tab with a way back', () => {
    seed([]);
    const { unmount } = render(<ContactCheckPanel getOverlays={() => []} onBack={() => undefined} />);
    expect(screen.getByTestId('contact-check-empty')).toBeTruthy();
    unmount();
    seed([ada]);
    render(<PersonalizedLayoutsPanel onPick={() => ({ ok: true, message: '' })} getOverlays={() => []} />);
    fireEvent.click(screen.getByTestId('check-contacts-btn'));
    expect(screen.getByTestId('contact-check')).toBeTruthy();
    fireEvent.click(screen.getByTestId('contact-check-back'));
    expect(screen.getByTestId('personalized-layouts')).toBeTruthy();
  });
});
