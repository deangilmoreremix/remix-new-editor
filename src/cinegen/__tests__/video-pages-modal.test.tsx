// "Add to Video Pages": the Template Generator's rendered video becomes a draft Video Pages page. The window is built like "Add to timeline".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { VideoPagesModal, openVideoPagesModal, GROUPS, defaultDeps, offered, previewUrl, type VideoPagesDeps } from '@cinegen/components/edit/video-pages-modal';
// @ts-expect-error plain JS data module
import { TEMPLATES } from '../../lib/landingPages/templates.js';

const OFFERED = offered(TEMPLATES as never[]) as Array<Record<string, unknown>>;
const video = { url: 'blob:http://x/abc', title: 'Harbor Dental', fileSize: 12 * 1048576, duration: 31 };
const deps = (over: Partial<VideoPagesDeps> = {}): VideoPagesDeps => ({
  auth: async () => ({ ok: true }),
  create: vi.fn(async (_v, o) => { o.onStep('Saving video'); return { id: 'abc123', title: o.title }; }),
  studioUrl: () => 'https://app.test/#/video-pages',
  edit: vi.fn(() => true),
  ...over,
});

describe('Add to Video Pages window', () => {
  beforeEach(() => { cleanup(); document.body.innerHTML = ''; });

  it('has the Add to timeline look: titled dialog, pills with counts, a "Choose a design" card with search, and "Showing N of M"', async () => {
    render(<VideoPagesModal video={video} onClose={() => {}} deps={deps()} />);
    expect(screen.getByRole('dialog', { name: 'Add to Video Pages' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].textContent).toContain('All');
    expect(tabs[0].textContent).toContain(String(OFFERED.length));
    // every studio group that has designs is a pill with its own count, and the counts add up to all of them
    const counted = GROUPS.map((g) => ({ g, n: OFFERED.filter((t) => g.test(t as never)).length })).filter((x) => x.n > 0);
    expect(tabs).toHaveLength(counted.length + 1);
    expect(counted.reduce((a, x) => a + x.n, 0)).toBe(OFFERED.length);
    expect(OFFERED.some((t) => t.site)).toBe(false);                    // the older fixed-layout designs are not offered (the studio's picker dropped them too)
    expect(screen.getByText('▣ Choose a design')).toBeTruthy();
    expect(screen.getByText(`${OFFERED.length} designs`)).toBeTruthy();
    expect(screen.getByText(`Showing ${OFFERED.length} of ${OFFERED.length} designs`)).toBeTruthy();
    expect(screen.getByLabelText('Search designs')).toBeTruthy();
    expect(screen.getAllByTestId(/^design-/)).toHaveLength(OFFERED.length);
  });

  it('every card shows the real preview of its design, and a card whose picture fails shows the page shape instead', () => {
    render(<VideoPagesModal video={video} onClose={() => {}} deps={deps()} />);
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[data-design-preview]'));
    expect(imgs).toHaveLength(OFFERED.length);
    expect(imgs.every((i) => i.getAttribute('src') === previewUrl(i.dataset.designPreview as string))).toBe(true);
    expect(previewUrl('puck-leadiq')).toBe('/landing-previews/puck-leadiq.jpg');
    const card = screen.getByTestId('design-puck-leadiq');
    expect(card.querySelector('svg')).toBeNull();
    fireEvent.error(card.querySelector('img') as HTMLImageElement);
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('svg')).toBeTruthy();
  });

  it('the editable designs pill shows the 34-style editable pages, and a pill, the search and the look filter narrow the cards', () => {
    render(<VideoPagesModal video={video} onClose={() => {}} deps={deps()} />);
    const editable = (TEMPLATES as Array<{ puck?: boolean }>).filter((t) => t.puck).length;
    expect(editable).toBeGreaterThan(20);
    fireEvent.click(screen.getByRole('tab', { name: /Editable landing pages/ }));
    expect(screen.getAllByTestId(/^design-/)).toHaveLength(editable);
    fireEvent.change(screen.getByLabelText('Search designs'), { target: { value: 'neon' } });
    const some = screen.getAllByTestId(/^design-/);
    expect(some.length).toBeGreaterThan(0); expect(some.length).toBeLessThan(editable);
    fireEvent.change(screen.getByLabelText('Search designs'), { target: { value: 'zzzz-no-such-design' } });
    expect(screen.getByText('No designs match your search.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search designs'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Look'), { target: { value: 'dark' } });
    const dark = (TEMPLATES as Array<{ puck?: boolean; theme: { mode?: string } }>).filter((t) => t.puck && (t.theme.mode ?? 'light') === 'dark').length;
    expect(screen.getAllByTestId(/^design-/)).toHaveLength(dark);
  });

  it('creating needs a chosen design; the draft is made with that design and the (editable) title, and "Open in Video Pages" opens the studio', async () => {
    const d = deps();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<VideoPagesModal video={video} onClose={() => {}} deps={d} />);
    const btn = () => screen.getByTestId('create-draft') as HTMLButtonElement;
    expect(btn().disabled).toBe(true);                                   // no design yet
    fireEvent.click(screen.getByTestId('design-puck-leadiq'));
    expect(screen.getByTestId('design-puck-leadiq').getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Spring offer' } });
    await waitFor(() => expect(btn().disabled).toBe(false));
    fireEvent.click(btn());
    await waitFor(() => expect(screen.getByText(/Draft page “Spring offer” created/)).toBeTruthy());
    expect(d.create).toHaveBeenCalledWith(video, expect.objectContaining({ template: 'puck-leadiq', title: 'Spring offer' }));
    fireEvent.click(screen.getByText('Open in Video Pages'));
    expect(open).toHaveBeenCalledWith('https://app.test/#/video-pages', '_blank', 'noopener');
    fireEvent.click(screen.getByTestId('open-in-editor'));              // the page opens in the editor
    expect(d.edit).toHaveBeenCalledWith('abc123');
    open.mockRestore();
  });

  it('signed out: says so and cannot create; too large: says the limit; a failed upload shows the reason and can be retried', async () => {
    const { unmount } = render(<VideoPagesModal video={video} onClose={() => {}} deps={deps({ auth: async () => ({ ok: false, reason: 'Sign in to add this video to Video Pages.' }) })} />);
    await waitFor(() => expect(screen.getByText('Sign in to add this video to Video Pages.')).toBeTruthy());
    fireEvent.click(screen.getByTestId('design-clean'));
    expect((screen.getByTestId('create-draft') as HTMLButtonElement).disabled).toBe(true);
    unmount();

    const big = render(<VideoPagesModal video={{ ...video, fileSize: 150 * 1048576 }} onClose={() => {}} deps={deps()} />);
    await waitFor(() => expect(screen.getByText(/the limit is 100 MB/)).toBeTruthy());
    fireEvent.click(screen.getByTestId('design-clean'));
    expect((screen.getByTestId('create-draft') as HTMLButtonElement).disabled).toBe(true);
    big.unmount();

    const create = vi.fn().mockRejectedValueOnce(new Error('Upload failed. Sign in and try again.')).mockResolvedValueOnce({ id: 'p1', title: 'Harbor Dental' });
    render(<VideoPagesModal video={video} onClose={() => {}} deps={deps({ create })} />);
    await waitFor(() => expect(screen.getByTestId('create-draft')).toBeTruthy());
    fireEvent.click(screen.getByTestId('design-clean'));
    await waitFor(() => expect((screen.getByTestId('create-draft') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('create-draft'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Upload failed'));
    fireEvent.click(screen.getByTestId('create-draft'));
    await waitFor(() => expect(screen.getByText(/created/)).toBeTruthy());
  });

  it('Open in Editor says so when the editor cannot be opened, and the page is still named so nothing is lost', async () => {
    render(<VideoPagesModal video={video} onClose={() => {}} deps={deps({ edit: () => false })} />);
    await waitFor(() => expect(screen.getByTestId('create-draft')).toBeTruthy());
    fireEvent.click(screen.getByTestId('design-clean'));
    await waitFor(() => expect((screen.getByTestId('create-draft') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('create-draft'));
    await waitFor(() => expect(screen.getByTestId('open-in-editor')).toBeTruthy());
    fireEvent.click(screen.getByTestId('open-in-editor'));
    expect(screen.getByRole('alert').textContent).toContain('Could not open the editor');
    expect(screen.getByRole('alert').textContent).toContain('Harbor Dental');
  });

  it('Esc and × close it; while uploading it cannot be closed', async () => {
    let finish: (p: { id: string; title: string }) => void = () => {};
    const create = vi.fn(() => new Promise<{ id: string; title: string }>((r) => { finish = r; }));
    const onClose = vi.fn();
    render(<VideoPagesModal video={video} onClose={onClose} deps={deps({ create })} />);
    await waitFor(() => expect(screen.getByTestId('create-draft')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('design-clean'));
    await waitFor(() => expect((screen.getByTestId('create-draft') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('create-draft'));
    await waitFor(() => expect(screen.getByLabelText('Close')).toHaveProperty('disabled', true));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);   // not closed mid-upload
    finish({ id: 'x', title: 'Harbor Dental' });
    await waitFor(() => expect(screen.getByText('Open in Video Pages')).toBeTruthy());
  });

  it('openVideoPagesModal mounts its own window on the page and the returned function removes it', async () => {
    const close = openVideoPagesModal(video, deps());
    await waitFor(() => expect(document.querySelector('[data-testid="video-pages-modal"]')).toBeTruthy());
    close();
    expect(document.querySelector('[data-testid="video-pages-modal"]')).toBeNull();
  });

  it('the real wiring explains why when Supabase is not set up or nobody is signed in', async () => {
    const a = await defaultDeps.auth();
    expect(a.ok).toBe(false);
    expect(a.reason).toMatch(/Supabase|Sign in/);
  });

  it('the real "Open in Editor" hands the page to the studio and opens it in a new tab', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(defaultDeps.edit('abc12345xy')).toBe(true);
    expect(JSON.parse(store.get('video_pages_open_page') as string).id).toBe('abc12345xy');
    expect(open).toHaveBeenCalledWith(expect.stringContaining('#/video-pages'), '_blank', 'noopener');
    expect(defaultDeps.edit('../bad')).toBe(false);                      // only a real page id is handed over
    open.mockRestore(); vi.unstubAllGlobals();
  });
});
