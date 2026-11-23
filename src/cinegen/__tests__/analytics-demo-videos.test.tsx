// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import { DemoVideos, DemoRestore, useDemosHidden } from '../components/analytics/demo-videos';

// The same wiring the Analytics tab uses: the strip while the demos are shown, a quiet restore line once they are removed.
function Harness() {
  const [hidden] = useDemosHidden();
  const [openId, setOpenId] = useState<string | null>(null);
  return <div data-testid="harness">{hidden ? <DemoRestore /> : <DemoVideos openId={openId} onOpen={setOpenId} />}</div>;
}

const tab = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
/** the demo's real Analytics screen has loaded (its tab bar is there) */
const loaded = () => waitFor(() => expect(screen.getByRole('navigation', { name: 'Analytics views' })).toBeTruthy(), { timeout: 4000 });

beforeEach(() => { try { window.localStorage.clear(); } catch { /* ignore */ } });
afterEach(cleanup);

describe('Analytics demo videos (strip)', () => {
  it('offers three demo videos, labelled as sample data, with a remove button', () => {
    render(<Harness />);
    const strip = screen.getByTestId('demo-videos');
    expect(within(strip).getAllByRole('button', { pressed: false }).filter((b) => b.getAttribute('data-testid')?.startsWith('demo-card-'))).toHaveLength(3);
    expect(within(strip).getByText('Sample data')).toBeTruthy();
    expect(screen.getByTestId('demo-remove').textContent).toBe('Remove demo videos');
    expect(screen.queryByTestId('demo-open')).toBeNull();
  });

  it('opens the REAL Analytics screen on a demo video, with its conversions and heatmaps', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('demo-card-demo-roofing-quote'));
    expect(screen.getByTestId('demo-card-demo-roofing-quote').getAttribute('aria-pressed')).toBe('true');
    // the banner says it is made up and what to look for
    expect(screen.getByTestId('demo-open').textContent).toMatch(/Nothing here is real/);
    expect(screen.getByTestId('demo-open').textContent).toMatch(/quote button/);
    // the real screen, filled from the demo client
    await loaded();
    expect(screen.getByTestId('demo-analytics-host').textContent).toContain('Roofing quote ad');
    tab('Conversions');
    expect(screen.getAllByText('Get my free quote').length).toBeGreaterThan(0);
    // the heatmaps, whose video picker lists the three demos (and nothing else)
    tab('Heatmaps');
    expect(screen.getByRole('heading', { name: 'Heatmaps' })).toBeTruthy();
    const picker = await screen.findByLabelText('Video');
    await waitFor(() => expect(within(picker).getAllByRole('option').map((o) => o.textContent).sort()).toEqual(['Personal outreach video', 'Roofing quote ad', 'Vertical product teaser']));
  });

  it('switches to another demo, and a second click on the open card closes it', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('demo-card-demo-roofing-quote'));
    await loaded();
    tab('Conversions');
    expect(screen.getAllByText('Get my free quote').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('demo-card-demo-vertical-teaser'));
    expect(screen.getByTestId('demo-card-demo-roofing-quote').getAttribute('aria-pressed')).toBe('false');
    await waitFor(() => expect(screen.getByTestId('demo-analytics-host').textContent).toContain('Vertical product teaser'), { timeout: 4000 });
    tab('Conversions');
    expect(screen.getAllByText('Shop now').length).toBeGreaterThan(0);
    expect(screen.queryByText('Get my free quote')).toBeNull();
    fireEvent.click(screen.getByTestId('demo-card-demo-vertical-teaser'));
    expect(screen.queryByTestId('demo-open')).toBeNull();
    expect(screen.queryByTestId('demo-analytics-host')).toBeNull();
  });

  it('"Remove demo videos" removes the strip and any open demo, remembers it, and can be undone', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('demo-card-demo-personal-outreach'));
    await loaded();
    fireEvent.click(screen.getByTestId('demo-remove'));
    expect(screen.queryByTestId('demo-videos')).toBeNull();
    expect(screen.queryByTestId('demo-analytics-host')).toBeNull();
    expect(screen.getByTestId('demo-restore').textContent).toMatch(/Demo videos removed/);
    expect(window.localStorage.getItem('remix_analytics_demos_hidden')).toBe('1');
    // a fresh render (a reload) still has them removed
    cleanup();
    render(<Harness />);
    expect(screen.queryByTestId('demo-videos')).toBeNull();
    fireEvent.click(screen.getByText('Show demo videos'));
    expect(screen.getByTestId('demo-videos')).toBeTruthy();
    expect(window.localStorage.getItem('remix_analytics_demos_hidden')).toBeNull();
  });
});
