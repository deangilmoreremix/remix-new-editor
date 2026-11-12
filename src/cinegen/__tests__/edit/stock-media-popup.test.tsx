// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { StockMediaPopup, isAiAsset } from '@cinegen/components/edit/stock-media-popup';
import { MEDIA_CATEGORIES } from '@cinegen/components/edit/stock-categories';
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
  it('offers a broad set of categories', () => {
    expect(MEDIA_CATEGORIES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(MEDIA_CATEGORIES.map((c) => c.id)).size).toBe(MEDIA_CATEGORIES.length);
    MEDIA_CATEGORIES.forEach((c) => { expect(c.query).toBeTruthy(); expect(c.ai).toBeTruthy(); });
  });
});

describe('AI first', () => {
  it('opens on the AI tab, listed before the stock sources, without hitting any stock API', () => {
    setup();
    const order = ['source-ai', 'source-pixabay', 'source-pexels'].map((id) => screen.getByTestId(id));
    expect(order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('ai-prompt')).toBeTruthy();
    expect(px.searchPixabayVideos).not.toHaveBeenCalled();
    expect(px.searchPexelsVideos).not.toHaveBeenCalled();
  });

  it('a category fills the prompt, and Generate sends it with the chosen kind and aspect', async () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('cat-nature'));
    const prompt = (screen.getByTestId('ai-prompt') as HTMLTextAreaElement).value;
    expect(prompt).toBe(MEDIA_CATEGORIES.find((c) => c.id === 'nature')!.ai);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'images' } });
    fireEvent.change(screen.getByLabelText('Aspect ratio'), { target: { value: '9:16' } });
    fireEvent.click(screen.getByTestId('ai-generate'));
    await waitFor(() => expect(p.onGenerate).toHaveBeenCalledTimes(1));
    expect(p.onGenerate.mock.calls[0].slice(0, 3)).toEqual([prompt, 'images', '9:16']);
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

describe('stock sources', () => {
  it('a category on Pixabay runs that category search and adds the picked item', async () => {
    px.searchPixabayVideos.mockResolvedValue({ hits: [pixabayVideo] });
    const p = setup();
    fireEvent.click(screen.getByTestId('source-pixabay'));
    fireEvent.click(screen.getByTestId('cat-city'));
    fireEvent.click(await screen.findByTestId('stock-pixabay-1'));
    await waitFor(() => expect(p.onAdd).toHaveBeenCalledTimes(1));
    expect(px.searchPixabayVideos.mock.calls.at(-1)![0].query).toBe(MEDIA_CATEGORIES.find((c) => c.id === 'city')!.query);
    expect(p.onAdd.mock.calls[0][0]).toMatchObject({ id: 'pixabay-1', src: 'https://cdn.pixabay.com/v.mp4', source: 'pixabay' });
    expect(p.onAdd.mock.calls[0][1]).toBe('videos');
  });

  it('switches to Pexels and shows its videos', async () => {
    px.searchPixabayVideos.mockResolvedValue({ hits: [] });
    px.searchPexelsVideos.mockResolvedValue({ videos: [pexelsVideo] });
    setup();
    fireEvent.click(screen.getByTestId('source-pexels'));
    expect(await screen.findByTestId('stock-pexels-9')).toBeTruthy();
  });

  it('shows a clear message when the server key is missing (503)', async () => {
    px.searchPixabayVideos.mockRejectedValue(Object.assign(new Error('No Pixabay API key available'), { status: 503 }));
    setup();
    fireEvent.click(screen.getByTestId('source-pixabay'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Pixabay isn't connected on the server yet/);
  });
});
