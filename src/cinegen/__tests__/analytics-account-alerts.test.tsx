// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const mounted = vi.fn();
vi.mock('@cinegen/components/workspace/workspace-shell', () => ({
  useWorkspace: () => ({ state: { timelines: [], activeTimelineId: null, assets: [], overlays: [] }, projectId: null, dispatch: () => {} }),
}));
vi.mock('@cinegen/components/leads/use-publish', () => ({
  usePublished: () => ({ signedIn: true, loaded: true, info: null, id: '', title: 'Untitled video' }),
  getClient: async () => ({}),
}));
vi.mock('@cinegen/components/overview/published-overview', () => ({ PublishedOverview: () => null }));
vi.mock('../../lib/editor/projectLibrary/projectTabs.js', () => ({
  audienceTab: () => () => {}, retargetTab: () => () => {},
  notificationsTab: () => (panel: HTMLElement, ctx: { project: unknown }) => { mounted(ctx.project); panel.textContent = 'prefs'; },
}));

import { AnalyticsTab } from '../components/analytics/analytics-tab';

afterEach(cleanup);

describe('Notification settings without a published video', () => {
  it('is reachable when signed in and mounts the preferences with no project', () => {
    render(<AnalyticsTab />);
    expect(screen.getByText(/Publish this video first/)).toBeTruthy();
    fireEvent.click(screen.getByText('Notification settings'));
    expect(mounted).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('account-alerts').textContent).toContain('prefs');
  });
});
