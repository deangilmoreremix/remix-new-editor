// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createLayoutOverlays, personalizedLayouts } from '../lib/overlays/personalized-layouts';
import { overlayMediaServices } from '../lib/overlays/overlay-media-services';
import { PersonalizedLayoutsPanel } from '../components/edit/personalized-layouts-panel';

const img = (id: string) => ({ id, url: `https://img.test/${id}.png`, type: 'image', role: id.startsWith('l') ? 'logo' : 'identity', name: id });
const ada = { id: 'c-ada', name: 'Ada Lovelace', contact: { firstName: 'Ada', lastName: 'Lovelace', name: 'Ada Lovelace', company: 'Analytical Co' }, company: { name: 'Analytical Co' }, variables: {}, personalization: { business: { businessName: 'Analytical Co', callToAction: 'Book a call' }, assets: { logos: [img('l1')], identities: [img('i1')], primaryLogoId: 'l1', primaryIdentityId: 'i1' } } };
const bare = { id: 'c-bare', name: 'No Assets', contact: { firstName: 'Bo', name: 'No Assets' }, variables: {}, personalization: { assets: {} } };
const seed = (profiles: unknown[], selected: string | null) => { localStorage.setItem('remix_contact_profiles', JSON.stringify(profiles)); if (selected) localStorage.setItem('remix_selected_contact_id', selected); else localStorage.removeItem('remix_selected_contact_id'); };

beforeEach(() => localStorage.clear());

describe('personalized layouts', () => {
  it('lists the four classic layouts', () => {
    expect(personalizedLayouts().map((l) => l.id)).toEqual(['brand', 'presenterIntro', 'productSpotlight', 'openingFrame']);
  });
  it('asks for a contact first', () => {
    seed([ada], null);
    const r = createLayoutOverlays('presenterIntro', 0, 20);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Preview as/);
  });
  it('Presenter intro adds a photo circle and a greeting, from tokens, at the playhead', () => {
    seed([ada], 'c-ada');
    const r = createLayoutOverlays('presenterIntro', 4, 30);
    expect(r.ok).toBe(true);
    expect(r.overlays.map((o) => o.type)).toEqual(['overlay-personalized-image', 'overlay-text']);
    expect(r.overlays[0]).toMatchObject({ start: 4, end: 9 });
    expect((r.overlays[0].addon as Record<string, unknown>)).toMatchObject({ src: '{{avatarUrl}}', imageshape: 'circle' });
    expect((r.overlays[1].addon as { text: string }).text).toContain('{{d firstName "there"}}');
    expect(new Set(r.overlays.map((o) => o.id)).size).toBe(2);
  });
  it('Logo + CTA end card measures the logo; a contact with nothing to show gets a clear message', () => {
    seed([ada], 'c-ada');
    const r = createLayoutOverlays('brand', 0, 30);
    expect(r.ok).toBe(true);
    expect(r.measureLogo).toBe(true);
    expect(r.overlays.some((o) => (o.addon as { src?: string })?.src === '{{logoUrl}}')).toBe(true);
    seed([bare], 'c-bare');
    const none = createLayoutOverlays('brand', 0, 30);
    expect(none.ok).toBe(false);
    expect(none.message).toMatch(/no logo/);
  });
  it('says how many contacts have no image for the layout', () => {
    seed([ada, bare], 'c-ada');
    expect(createLayoutOverlays('presenterIntro', 0, 30).message).toMatch(/1 contact has no image/);
  });
  it('the tab lists layouts, names the contact, and shows why a layout could not be added', () => {
    seed([ada], 'c-ada');
    const onPick = vi.fn().mockReturnValueOnce({ ok: false, message: 'Nothing to add yet.' });
    render(<PersonalizedLayoutsPanel onPick={onPick} />);
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getAllByText('Add at playhead')).toHaveLength(4);
    act(() => { fireEvent.click(screen.getByTestId('layout-add-brand')); });
    expect(onPick).toHaveBeenCalledWith('brand');
    expect(screen.getByTestId('layout-note').textContent).toBe('Nothing to add yet.');
  });
});

describe('overlay media services (Image / Stickers settings)', () => {
  const host = (assets: unknown[] = []) => ({ notify: vi.fn(), assets: () => assets as never });
  it('offers the project\'s images once each, and the stock sources and sticker library', () => {
    const svc = overlayMediaServices(host([
      { id: '1', name: 'Logo', type: 'image', url: 'https://x/logo.png' },
      { id: '2', name: 'Logo again', type: 'image', url: 'https://x/logo.png' },
      { id: '3', name: 'Clip', type: 'video', url: 'https://x/clip.mp4' },
      { id: '4', name: 'Local', type: 'image', url: '', fileRef: '/media/local.jpg' },
    ]));
    expect(svc.mediaImages()).toEqual([{ name: 'Logo', src: 'https://x/logo.png', type: 'image' }, { name: 'Local', src: '/media/local.jpg', type: 'image' }]);
    expect(svc.stockSources.map(([id]: string[]) => id)).toEqual(['pixabay', 'pexels']);
    expect(Object.keys(svc.stickers).length).toBeGreaterThan(0);
  });
  it('Pexels images are used from their CDN, and a Pixabay copy falls back to its link when it cannot be saved', async () => {
    const h = host();
    const svc = overlayMediaServices(h);
    expect(await svc.importStockImage({ id: 'p1', src: 'https://cdn.pexels/p1.jpg' })).toBe('https://cdn.pexels/p1.jpg');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as never;
    expect(await svc.importStockImage({ id: 'x', src: 'https://pixabay/x.jpg', mustCopy: true })).toBe('https://pixabay/x.jpg');
    expect(h.notify).toHaveBeenCalledWith(expect.stringMatching(/Pixabay/), 'info');
  });
  it('reports an upload problem', () => {
    const h = host();
    overlayMediaServices(h).onError(new Error('Too big'));
    expect(h.notify).toHaveBeenCalledWith('Too big', 'error');
  });
});
