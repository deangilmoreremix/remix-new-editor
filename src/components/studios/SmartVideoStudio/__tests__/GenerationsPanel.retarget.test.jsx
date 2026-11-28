// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const retargetFor = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('../../../studio/retargetAction.js', () => ({ retargetFor }));
vi.mock('../../../studio/landingPageAction.js', () => ({ openLandingPageFor: vi.fn() }));

import GenerationsPanel from '../GenerationsPanel';

const job = (over) => ({ id: 'j1', modelId: 'm', modelName: 'Model', status: 'completed', input: { prompt: 'A dog' }, output: 'https://cdn.example.com/a.mp4', outputType: 'video', createdAt: '2026-11-28T00:00:00Z', updatedAt: '2026-11-28T00:00:00Z', ...over });

afterEach(cleanup);

describe('SmartVideo Studio generations: Retarget button', () => {
  it('a finished video gets a Retarget button that turns Retarget on for it', async () => {
    render(<GenerationsPanel jobs={[job()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retarget' }));
    await waitFor(() => expect(retargetFor).toHaveBeenCalledWith({ url: 'https://cdn.example.com/a.mp4', prompt: 'A dog', type: 'video', studio: 'smartvideo' }));
  });
  it('pictures, unfinished jobs and non-https outputs get none', () => {
    render(<GenerationsPanel jobs={[
      job({ id: 'i', output: 'https://cdn.example.com/a.png', outputType: 'image' }),
      job({ id: 'p', status: 'processing', output: undefined }),
      job({ id: 'h', output: 'http://cdn.example.com/b.mp4' }),
    ]} />);
    expect(screen.queryByRole('button', { name: 'Retarget' })).toBeNull();
  });
});
