// Template videos library: a category-tabbed gallery of the 201 reviewed clips. Browsing only (no personalization);
// picking a card hands the clip to the editor, which adds it to the timeline.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TemplateVideosModal, aspectBucket, ratioNumber, searchTemplateVideos, type TemplateVideo } from '@cinegen/components/edit/template-videos-modal';
// @ts-expect-error plain JS data module
import { templateVideos } from '../../data/templateVideoLibrary.js';

const ALL = templateVideos as TemplateVideo[];
const cards = () => screen.queryAllByTestId(/^template-video-/);
const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('TemplateVideosModal', () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onPick: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    onClose = vi.fn();
    onPick = vi.fn();
    render(<TemplateVideosModal onClose={onClose} onPick={onPick} />);
  });

  it('shows every clip under All, with per-category counts that add up to the total', () => {
    expect(ALL).toHaveLength(201);
    expect(tab(/^▦All/).textContent).toContain('201');
    const tabs = screen.getAllByRole('tab').filter((t) => !/^▦All/.test(t.textContent ?? ''));
    const sum = tabs.reduce((n, t) => n + Number((t.textContent ?? '').match(/(\d+)$/)?.[1] ?? 0), 0);
    expect(sum).toBe(201);
  });

  it('starts with a window of 24 cards and "Show more" reveals the next batch', () => {
    expect(cards()).toHaveLength(24);
    expect(screen.getByText(/Showing 24 of 201 videos/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Show more \(177 left\)/ }));
    expect(cards()).toHaveLength(48);
  });

  it('filters by category tab', () => {
    fireEvent.click(tab(/Fashion/));
    const expected = ALL.filter((v) => v.category === 'Fashion').length;
    expect(cards()).toHaveLength(expected);
    expect(screen.getByText(new RegExp(`Showing ${expected} of ${expected} videos`))).toBeTruthy();
  });

  it('searches titles, and shows an empty state when nothing matches', () => {
    const word = ALL[0].title.split(/\s+/)[0];
    fireEvent.change(screen.getByLabelText('Search template videos'), { target: { value: word } });
    expect(cards().length).toBe(Math.min(24, searchTemplateVideos(ALL, word).length));
    fireEvent.change(screen.getByLabelText('Search template videos'), { target: { value: 'zzzz-no-such-clip' } });
    expect(cards()).toHaveLength(0);
    expect(screen.getByText(/No template videos match your search/)).toBeTruthy();
  });

  it('filters by aspect ratio', () => {
    fireEvent.change(screen.getByLabelText('Aspect ratio'), { target: { value: '9:16' } });
    const expected = ALL.filter((v) => aspectBucket(v.aspectRatio) === '9:16').length;
    expect(expected).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`of ${expected} videos`))).toBeTruthy();
  });

  it('hands the clicked clip to onPick', () => {
    const first = cards()[0];
    fireEvent.click(first);
    expect(onPick).toHaveBeenCalledTimes(1);
    const picked = onPick.mock.calls[0][0] as TemplateVideo;
    expect(first.getAttribute('data-testid')).toBe(`template-video-${picked.id}`);
    expect(picked.videoSrc).toMatch(/^\/(media|cdn\/beatapi)\//);
  });

  it('closes from the × button, the backdrop and Escape (but not from clicks inside the panel)', () => {
    fireEvent.click(within(screen.getByRole('dialog')).getByLabelText('Close library'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('Template videos'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('aspect helpers', () => {
  it('buckets ratios and tolerates odd values', () => {
    expect(aspectBucket('16:9')).toBe('16:9');
    expect(aspectBucket('9:16')).toBe('9:16');
    expect(aspectBucket('1:1')).toBe('1:1');
    expect(aspectBucket('637:270')).toBe('16:9');
    expect(aspectBucket('3:4')).toBe('9:16');
    expect(ratioNumber('bogus')).toBeCloseTo(16 / 9);
  });
});
