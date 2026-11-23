// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@cinegen/components/workspace/workspace-shell', () => ({
  useWorkspace: () => ({ state: { timelines: [], activeTimelineId: null, assets: [], overlays: [] }, projectId: null, dispatch: () => {} }),
}));
vi.mock('@cinegen/components/leads/use-publish', () => ({
  usePublished: () => ({ signedIn: false, loaded: true, info: null, id: '', title: 'Untitled video' }),
  getClient: async () => ({}),
}));
vi.mock('@cinegen/components/overview/published-overview', () => ({ PublishedOverview: () => null }));

import { AnalyticsTab } from '../components/analytics/analytics-tab';

afterEach(cleanup);

describe('Analytics tab while signed out', () => {
  it('still shows the demo videos and a sample of Analytics, with the sign-in prompt', () => {
    render(<AnalyticsTab />);
    expect(screen.getByTestId('demo-videos')).toBeTruthy();
    expect(screen.getByTestId('analytics-sample')).toBeTruthy();
    expect(screen.getByText(/Sign in to see analytics/)).toBeTruthy();
  });
});
