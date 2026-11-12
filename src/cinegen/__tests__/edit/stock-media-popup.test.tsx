// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { StockMediaPopup, isAiAsset } from '@cinegen/components/edit/stock-media-popup';
import { MEDIA_CATEGORIES, MEDIA_GROUPS, FLUX_SIZE, aiPrompt } from '@cinegen/components/edit/stock-categories';
import type { Asset } from '@cinegen/types/project';

const px = vi.hoisted(() => ({
  searchPixabayVideos: vi.fn(), searchPixabayImages: vi.fn(), searchPexelsVideos: vi.fn(), searchPexelsPhotos: vi.fn(),
}));
vi.mock('../../../lib/pixabayApi.js', () => ({ searchPixabayVideos: px.searchPixabayVideos, searchPixabayImages: px.searchPixabayImages }));
vi.mock('../../../lib/pexelsApi.js', () => ({ searchVideos: px.searchPexelsVideos, searchPhotos: px.searchPexelsPhotos }));

const pixabayVideo = { id: 1, tags: 'city, night', duration: 12, user: 'ann', pageURL: 'https://pixabay.com/videos/id-1/', videos: { small: { url: 'https://cdn.pixabay.com/v.mp4', thumbnail: 'https://cdn.pixabay.com/t.jpg' } } };
const pexelsVideo = { id: 9, url: 'https://www.pexels.com/video/sunset-beach-9/', duration: 8, image: 'https://img/t.jpg', user: { name: 'Bo' }, video_files: [{ link: 'https://cdn.pexels/v.mp4', file_type: 'video/mp4', width: 1280 }] };
const asset = (o: Partial<Asset> & { id: string }): Asset => ({ name: o.id, type: 'video', url: `https://x/${o.id}.mp4`, createdAt: '2026-01-01T00:00:00Z', ...o });

const setup = (over: Partial<Parameters<typeof StockMediaPopup>[0]> = {}) => {
  const props = { onClose: vi.fn(), onAdd: vi.fn().mockResolvedValue(undefined), onGenerate: vi.fn().mockResolvedValue(undefined), assets: [] as Asset[], onAddAsset: vi.fn(), ...over };
  render(<StockMediaPopup {...props} />);
  return props;
};

beforeEach(() => {
  cleanup();
  localStorage.clear();
  Object.values(px).forEach((f) => f.mockReset());
});

describe('categories', () => {
  it('has many categories in groups, each with topics', () => {
    expect(MEDIA_GROUPS.length).toBeGreaterThanOrEqual(10);
    expect(MEDIA_CATEGORIES.length).toBeGreaterThanOrEqual(90);
    expect(new Set(MEDIA_CATEGORIES.map((c) => c.id)).size).toBe(MEDIA_CATEGORIES.length);
    MEDIA_CATEGORIES.forEach((c) => { expect(c.topics.length).toBeGreaterThanOrEqual(3); expect(c.glyph).toBeTruthy(); });
  });

  it('shows every category under All and narrows to a group, with count badges', () => {
    setup();
    expect(screen.getAllByTestId(/^cat-/).length).toBe(MEDIA_CATEGORIES.length);
    const g = MEDIA_GROUPS[1];
    fireEvent.click(screen.getByTestId(`group-${g.id}`));
    expect(screen.getAllByTestId(/^cat-/).length).toBe(g.categories.length);
    expect(screen.getByTestId(`group-${g.id}`).textContent).toContain(String(g.categories.length));
    expect(screen.getByTestId(`cat-${g.categories[0].id}`).textContent).toContain(String(g.categories[0].topics.length));
  });
});

describe('AI first', () => {
  it('opens on AI videos (the first pill) without hitting any stock API', () => {
    setup();
    expect(screen.getByTestId('pill-ai-videos').getAttribute('aria-selected')).toBe('true');
    ['tab-pexels-videos', 'tab-pexels-images', 'tab-pixabay-videos', 'tab-pixabay-images'].forEach((id) => expect(screen.getByTestId(id).getAttribute('aria-selected')).toBe('false'));
    expect(screen.getByTestId('ai-prompt')).toBeTruthy();
    expect(px.searchPixabayVideos).not.toHaveBeenCalled();
    expect(px.searchPexelsVideos).not.toHaveBeenCalled();
  });

  it('a category fills the prompt, and Generate sends it with the chosen kind and aspect', async () => {
    const p = setup();
    const cat = MEDIA_CATEGORIES[0];
    fireEvent.click(screen.getByTestId(`cat-${cat.id}`));
    const prompt = (screen.getByTestId('ai-prompt') as HTMLTextAreaElement).value;
    expect(prompt).toBe(aiPrompt(cat.topics[0], 'videos'));
    fireEvent.click(screen.getByTestId('pill-ai-images'));
    expect((screen.getByTestId('ai-prompt') as HTMLTextAreaElement).value).toBe(aiPrompt(cat.topics[0], 'images')); // switching type rewrites the idea
    const imagePrompt = (screen.getByTestId('ai-prompt') as HTMLTextAreaElement).value;
    fireEvent.change(screen.getByLabelText('Aspect ratio'), { target: { value: '9:16' } });
    fireEvent.click(screen.getByTestId('ai-generate'));
    await waitFor(() => expect(p.onGenerate).toHaveBeenCalledTimes(1));
    expect(p.onGenerate.mock.calls[0].slice(0, 3)).toEqual([imagePrompt, 'images', '9:16']);
    expect(await screen.findByText(/Added to the timeline/)).toBeTruthy();
  });

  it('shows the generator error (e.g. not signed in) instead of failing silently', async () => {
    setup({ onGenerate: vi.fn().mockRejectedValue(new Error('Sign in, and add your MuAPI key in Settings → API keys.')) });
    fireEvent.change(screen.getByTestId('ai-prompt'), { target: { value: 'a red fox' } });
    fireEvent.click(screen.getByTestId('ai-generate'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Sign in/);
  });

  it('lists only AI-generated assets of the chosen kind and adds one on click', () => {
    const ai = asset({ id: 'v1', type: 'video', metadata: { generatedVia: 'studio-generation' } });
    const assets = [ai, asset({ id: 'up', type: 'video' }), asset({ id: 'att', type: 'video', metadata: { generatedVia: 'studio-attachment' } }), asset({ id: 'img', type: 'image', metadata: { generatedVia: 'director' } })];
    expect(assets.filter(isAiAsset).map((a) => a.id)).toEqual(['v1', 'img']);
    const p = setup({ assets });
    expect(screen.queryByTestId('ai-up')).toBeNull();
    expect(screen.queryByTestId('ai-att')).toBeNull();
    expect(screen.queryByTestId('ai-img')).toBeNull(); // image, but the Videos tab is active
    fireEvent.click(screen.getByTestId('ai-v1'));
    expect(p.onAddAsset).toHaveBeenCalledWith(ai);
  });
});

describe('main tabs', () => {
  it('header tabs are Pexels and Pixabay videos/images; AI videos/images are pills in the panel', () => {
    setup();
    const header = screen.getByRole('tablist', { name: 'Media' });
    const ids = [...header.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(['tab-pexels-videos', 'tab-pexels-images', 'tab-pixabay-videos', 'tab-pixabay-images']);
    expect(header.textContent).not.toMatch(/AI/);
    const groups = screen.getByRole('tablist', { name: 'Groups' });
    const first = [...groups.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')).slice(0, 3);
    expect(first).toEqual(['pill-ai-videos', 'pill-ai-images', 'group-all']);
    expect(screen.queryByLabelText('Type')).toBeNull();
  });

  it('Pexels images tab searches photos and Pexels videos tab searches videos', async () => {
    px.searchPexelsVideos.mockResolvedValue({ videos: [pexelsVideo] });
    px.searchPexelsPhotos.mockResolvedValue({ photos: [] });
    const p = setup();
    fireEvent.click(screen.getByTestId('tab-pexels-images'));
    await waitFor(() => expect(px.searchPexelsPhotos).toHaveBeenCalled());
    expect(px.searchPexelsVideos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('tab-pexels-videos'));
    expect(await screen.findByTestId('stock-pexels-9')).toBeTruthy();
    fireEvent.click(screen.getByTestId('stock-pexels-9'));
    await waitFor(() => expect(p.onAdd).toHaveBeenCalled());
    expect(p.onAdd.mock.calls[0][1]).toBe('videos');
  });
});

describe('FLUX sizes', () => {
  it('are valid flux-dev dimensions (multiples of 64, 128-2048) at the requested ratio', () => {
    for (const [ratio, { width, height }] of Object.entries(FLUX_SIZE)) {
      const [w, h] = ratio.split(':').map(Number);
      expect(width % 64).toBe(0); expect(height % 64).toBe(0);
      expect(Math.min(width, height)).toBeGreaterThanOrEqual(128); expect(Math.max(width, height)).toBeLessThanOrEqual(2048);
      expect(width / height).toBeCloseTo(w / h, 2);
    }
  });
});

describe('modal behaviour', () => {
  it('is a modal dialog, closes on Escape, and keeps key presses from reaching window shortcuts (e.g. Delete)', () => {
    const p = setup();
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    const seen = vi.fn();
    window.addEventListener('keydown', seen);
    fireEvent.keyDown(screen.getByTestId('pill-ai-images'), { key: 'Delete' });
    expect(seen).not.toHaveBeenCalled();
    window.removeEventListener('keydown', seen);
    fireEvent.keyDown(screen.getByTestId('pill-ai-images'), { key: 'Escape' });
    expect(p.onClose).toHaveBeenCalled();
  });

  it('keeps a prompt the user edited when switching between AI videos and images', () => {
    setup();
    fireEvent.click(screen.getByTestId(`cat-${MEDIA_CATEGORIES[0].id}`));
    fireEvent.change(screen.getByTestId('ai-prompt'), { target: { value: 'my own idea' } });
    fireEvent.click(screen.getByTestId('pill-ai-images'));
    expect((screen.getByTestId('ai-prompt') as HTMLTextAreaElement).value).toBe('my own idea');
  });
});

describe('generation warning', () => {
  it('shows the warning returned by onGenerate instead of the plain success message', async () => {
    setup({ onGenerate: vi.fn().mockResolvedValue("Added, but a copy couldn't be saved") });
    fireEvent.change(screen.getByTestId('ai-prompt'), { target: { value: 'a red fox' } });
    fireEvent.click(screen.getByTestId('ai-generate'));
    expect(await screen.findByText(/a copy couldn't be saved/)).toBeTruthy();
    expect(screen.queryByText(/Added to the timeline and your media pool/)).toBeNull();
  });
});

describe('adding fails', () => {
  it('shows an error instead of an unhandled rejection when onAdd rejects', async () => {
    px.searchPexelsVideos.mockResolvedValue({ videos: [pexelsVideo] });
    const p = setup({ onAdd: vi.fn().mockRejectedValue(new Error('Could not save this clip')) });
    fireEvent.click(screen.getByTestId('tab-pexels-videos'));
    fireEvent.click(await screen.findByTestId('stock-pexels-9'));
    expect((await screen.findByTestId('add-error')).textContent).toMatch(/Could not save this clip/);
    expect(p.onAdd).toHaveBeenCalledTimes(1);
    // and the card is usable again
    expect((screen.getByTestId('stock-pexels-9') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('switching media type', () => {
  it('never shows (or imports) the previous tab\'s results under the new media type', async () => {
    px.searchPexelsVideos.mockResolvedValue({ videos: [pexelsVideo] });
    px.searchPexelsPhotos.mockReturnValue(new Promise(() => {})); // the photo request stays pending
    const p = setup();
    fireEvent.click(screen.getByTestId('tab-pexels-videos'));
    expect(await screen.findByTestId('stock-pexels-9')).toBeTruthy();
    fireEvent.click(screen.getByTestId('tab-pexels-images'));
    await waitFor(() => expect(px.searchPexelsPhotos).toHaveBeenCalled());
    expect(screen.queryByTestId('stock-pexels-9')).toBeNull(); // the old video card is gone while photos load
    expect(p.onAdd).not.toHaveBeenCalled();
  });
});

describe('stock sources', () => {
  it('a category on Pixabay runs that category search and adds the picked item', async () => {
    px.searchPixabayVideos.mockResolvedValue({ hits: [pixabayVideo] });
    const p = setup();
    fireEvent.click(screen.getByTestId('tab-pixabay-videos'));
    const cat = MEDIA_CATEGORIES.find((c) => c.id === 'city-skylines')!;
    fireEvent.click(screen.getByTestId(`cat-${cat.id}`));
    fireEvent.click(await screen.findByTestId('stock-pixabay-1'));
    await waitFor(() => expect(p.onAdd).toHaveBeenCalledTimes(1));
    expect(px.searchPixabayVideos.mock.calls.at(-1)![0].query).toBe(cat.topics[0]);
    fireEvent.click(screen.getByTestId(`topic-${cat.topics[2].replace(/\s+/g, '-')}`));
    await waitFor(() => expect(px.searchPixabayVideos.mock.calls.at(-1)![0].query).toBe(cat.topics[2])); // a topic refines the search
    expect(p.onAdd.mock.calls[0][0]).toMatchObject({ id: 'pixabay-1', src: 'https://cdn.pixabay.com/v.mp4', source: 'pixabay' });
    expect(p.onAdd.mock.calls[0][1]).toBe('videos');
  });

  it('switches to Pexels and shows its videos', async () => {
    px.searchPixabayVideos.mockResolvedValue({ hits: [] });
    px.searchPexelsVideos.mockResolvedValue({ videos: [pexelsVideo] });
    setup();
    fireEvent.click(screen.getByTestId('tab-pexels-videos'));
    expect(await screen.findByTestId('stock-pexels-9')).toBeTruthy();
  });

  it('shows a clear message when the server key is missing (503)', async () => {
    px.searchPixabayVideos.mockRejectedValue(Object.assign(new Error('No Pixabay API key available'), { status: 503 }));
    setup();
    fireEvent.click(screen.getByTestId('tab-pixabay-videos'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Pixabay isn't connected on the server yet/);
  });
});
