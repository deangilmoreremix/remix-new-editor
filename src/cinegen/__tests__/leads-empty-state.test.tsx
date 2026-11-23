// [remix] Before a video is published the Leads and Analytics tabs preview their layout with labelled sample data.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@cinegen/components/workspace/workspace-shell', () => ({ useWorkspace: () => ({ state: { overlays: [] } }) }));

import { LeadsCard } from '@cinegen/components/leads/leads-card';
import { SampleAnalytics } from '@cinegen/components/analytics/sample-analytics';

const empty = { rows: [], loading: false, error: '', reload: async () => {}, remove: async () => {} } as never;

describe('empty states', () => {
  it('unpublished Leads card shows labelled, read-only sample rows and the publish note', () => {
    render(<LeadsCard data={empty} published={false} views={0} />);
    expect(screen.getByTestId('leads-sample-badge').textContent).toBe('Sample data');
    expect(screen.getByTestId('leads-unpublished').textContent).toMatch(/Publish this video to start collecting leads/);
    expect(screen.getByTestId('leads-table')).toBeTruthy();
    expect(screen.getByTestId('leads-table').closest('.leads-preview')?.getAttribute('aria-hidden')).toBe('true');
  });
  it('published Leads card shows real (empty) data with no sample content', () => {
    render(<LeadsCard data={empty} published views={10} />);
    expect(screen.queryByTestId('leads-sample-badge')).toBeNull();
    expect(screen.queryByText('maya@example.com')).toBeNull();
    expect(screen.getByTestId('leads-empty')).toBeTruthy();
  });
  it('analytics preview is labelled as sample data', () => {
    render(<SampleAnalytics />);
    expect(screen.getByText('Sample data')).toBeTruthy();
    expect(screen.getByText('Completion rate')).toBeTruthy();
  });
});
