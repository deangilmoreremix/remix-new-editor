// Template videos library: a category-tabbed gallery of the reviewed clips. Browsing only (no personalization);
// picking a card hands the clip to the editor, which adds it to the timeline.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TemplateVideosModal, TemplateVideosPanel, aspectBucket, durationBucket, ratioNumber, searchTemplateVideos, type TemplateVideo } from '@cinegen/components/edit/template-videos-modal';
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
    expect(ALL.length).toBeGreaterThan(150);
    expect(tab(/^▦All/).textContent).toContain(String(ALL.length));
    const tabs = screen.getAllByRole('tab').filter((t) => !/^▦All/.test(t.textContent ?? ''));
    const sum = tabs.reduce((n, t) => n + Number((t.textContent ?? '').match(/(\d+)$/)?.[1] ?? 0), 0);
    expect(sum).toBe(ALL.length);
  });

  it('starts with a window of 24 cards and "Show more" reveals the next batch', () => {
    expect(cards()).toHaveLength(24);
    expect(screen.getByText(new RegExp(`Showing 24 of ${ALL.length} videos`))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Show more \\(${ALL.length - 24} left\\)`) }));
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

  it('shows a subcategory row for the chosen category and filters by it, with counts that add up', () => {
    expect(screen.queryByRole('tablist', { name: 'Template video subcategories' })).toBeNull();
    fireEvent.click(tab(/^◈Commercial/));
    const row = within(screen.getByRole('tablist', { name: 'Template video subcategories' }));
    const chips = row.getAllByRole('tab').filter((c) => !/^All/.test(c.textContent ?? ''));
    expect(chips.length).toBeGreaterThan(3);
    const sum = chips.reduce((n, c) => n + Number((c.textContent ?? '').match(/(\d+)$/)?.[1] ?? 0), 0);
    const total = ALL.filter((v) => v.category === 'Commercial').length;
    expect(sum).toBe(total);
    fireEvent.click(row.getByRole('tab', { name: /^Food & Beverage/ }));
    const expected = ALL.filter((v) => v.category === 'Commercial' && v.subcategory === 'Food & Beverage').length;
    expect(screen.getByText(new RegExp(`of ${expected} videos`))).toBeTruthy();
    // switching category resets the subcategory
    fireEvent.click(tab(/^⚡Action/));
    expect(screen.getByText(new RegExp(`of ${ALL.filter((v) => v.category === 'Action').length} videos`))).toBeTruthy();
  });

  it('filters by duration', () => {
    fireEvent.change(screen.getByLabelText('Clip length'), { target: { value: 'extra' } });
    const expected = ALL.filter((v) => durationBucket(v.duration) === 'extra').length;
    expect(expected).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`of ${expected} videos`))).toBeTruthy();
  });

  it('finds a clip by its commercial title, its subcategory or its original prompt title', () => {
    const v = ALL[2];
    expect(searchTemplateVideos(ALL, v.title).map((x) => x.id)).toContain(v.id);
    expect(searchTemplateVideos(ALL, v.sourceTitle).map((x) => x.id)).toContain(v.id);
    expect(searchTemplateVideos(ALL, 'food & beverage').length).toBeGreaterThan(3);
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
    expect(picked.videoSrc).toMatch(/^(https:\/\/bzxohkrxcwodllketcpz\.supabase\.co\/storage\/v1\/object\/public\/demo-template-videos\/|\/media\/|\/cdn\/beatapi\/)/);
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

describe('TemplateVideosPanel (reusable inside a bigger window, e.g. an Add-to-timeline tab)', () => {
  it('renders the browsing content without any dialog shell, and picks a clip', () => {
    const onPick = vi.fn();
    render(<TemplateVideosPanel onPick={onPick} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByLabelText('Close library')).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Template video categories' })).toBeTruthy();
    fireEvent.click(screen.queryAllByTestId(/^template-video-/)[0]);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect((onPick.mock.calls[0][0] as TemplateVideo).videoSrc).toMatch(/^https:\/\//);
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
  it('buckets durations', () => {
    expect(durationBucket(10.1)).toBe('short');
    expect(durationBucket(15.18)).toBe('medium');
    expect(durationBucket(30.15)).toBe('long');
    expect(durationBucket(61)).toBe('extra');
    expect(durationBucket(null)).toBe('short');
  });
});
