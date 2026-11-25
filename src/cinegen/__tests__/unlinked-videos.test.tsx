// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { list, enable } = vi.hoisted(() => ({ list: vi.fn(), enable: vi.fn() }));
vi.mock('@cinegen/components/leads/use-publish', () => ({ getClient: async () => ({}) }));
vi.mock('@cinegen/lib/leads/project-link', () => ({ listUnlinkedVideos: list, enableRetargetForVideo: enable }));

import { UnlinkedVideos } from '@cinegen/components/overview/unlinked-videos';

beforeEach(() => { (window as unknown as { Clerk: unknown }).Clerk = { user: { id: 'u1' } }; list.mockReset(); enable.mockReset(); });
afterEach(() => { cleanup(); delete (window as unknown as { Clerk?: unknown }).Clerk; });

describe('Videos without Retarget', () => {
  it('draws nothing when every video is already connected', async () => {
    list.mockResolvedValue([]);
    const { container } = render(<UnlinkedVideos />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
  it('turns Retarget on for one video, removes it from the list and tells the overview to refresh', async () => {
    list.mockResolvedValue([{ id: 'a1', title: 'Promo', published: true }, { id: 'b2', title: 'Old', published: false }]);
    enable.mockResolvedValue('row');
    const onEnabled = vi.fn();
    render(<UnlinkedVideos onEnabled={onEnabled} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Turn on Retarget' }))[0]);
    await waitFor(() => expect(enable).toHaveBeenCalledWith(expect.anything(), 'a1'));
    await waitFor(() => expect(screen.queryByText('Promo')).not.toBeInTheDocument());
    expect(screen.getByText(/Old/)).toBeInTheDocument();
    expect(onEnabled).toHaveBeenCalledTimes(1);
  });
  it('shows the error and keeps the video when it fails', async () => {
    list.mockResolvedValue([{ id: 'a1', title: 'Promo', published: true }]);
    enable.mockRejectedValue(new Error('Could not read the video'));
    render(<UnlinkedVideos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on Retarget' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read the video');
    expect(screen.getByText('Promo')).toBeInTheDocument();
  });
});
