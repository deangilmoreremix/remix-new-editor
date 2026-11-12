// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { StockMediaPopup } from '@cinegen/components/edit/stock-media-popup';

const px = vi.hoisted(() => ({
  searchPixabayVideos: vi.fn(), searchPixabayImages: vi.fn(), searchPexelsVideos: vi.fn(), searchPexelsPhotos: vi.fn(),
}));
vi.mock('../../../lib/pixabayApi.js', () => ({ searchPixabayVideos: px.searchPixabayVideos, searchPixabayImages: px.searchPixabayImages }));
vi.mock('../../../lib/pexelsApi.js', () => ({ searchVideos: px.searchPexelsVideos, searchPhotos: px.searchPexelsPhotos }));

const pixabayVideo = { id: 1, tags: 'city, night', duration: 12, user: 'ann', pageURL: 'https://pixabay.com/videos/id-1/', videos: { small: { url: 'https://cdn.pixabay.com/v.mp4', thumbnail: 'https://cdn.pixabay.com/t.jpg' } } };
const pexelsVideo = { id: 9, url: 'https://www.pexels.com/video/sunset-beach-9/', duration: 8, image: 'https://img/t.jpg', user: { name: 'Bo' }, video_files: [{ link: 'https://cdn.pexels/v.mp4', file_type: 'video/mp4', width: 1280 }] };

beforeEach(() => {
  cleanup();
  localStorage.clear();
  Object.values(px).forEach((f) => f.mockReset());
});

describe('StockMediaPopup', () => {
  it('searches Pixabay videos first and adds the picked item', async () => {
    px.searchPixabayVideos.mockResolvedValue({ hits: [pixabayVideo] });
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<StockMediaPopup onClose={() => {}} onAdd={onAdd} />);
    const tile = await screen.findByTestId('stock-pixabay-1');
    fireEvent.click(tile);
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0][0]).toMatchObject({ id: 'pixabay-1', src: 'https://cdn.pixabay.com/v.mp4', source: 'pixabay' });
    expect(onAdd.mock.calls[0][1]).toBe('videos');
  });

  it('switches to Pexels and shows its videos', async () => {
    px.searchPixabayVideos.mockResolvedValue({ hits: [] });
    px.searchPexelsVideos.mockResolvedValue({ videos: [pexelsVideo] });
    render(<StockMediaPopup onClose={() => {}} onAdd={vi.fn()} />);
    fireEvent.click(await screen.findByText('Pexels'));
    expect(await screen.findByTestId('stock-pexels-9')).toBeTruthy();
    expect(px.searchPexelsVideos).toHaveBeenCalled();
  });

  it('shows a clear message when the server key is missing (503)', async () => {
    px.searchPixabayVideos.mockRejectedValue(Object.assign(new Error('No Pixabay API key available'), { status: 503 }));
    render(<StockMediaPopup onClose={() => {}} onAdd={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Pixabay isn't connected on the server yet/);
  });
});
