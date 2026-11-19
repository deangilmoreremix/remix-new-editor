// @vitest-environment jsdom
// The Leads table: cells line up with their headers, and Refresh reloads the insights too.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@cinegen/components/workspace/workspace-shell', () => ({ useWorkspace: () => ({ state: { overlays: [] } }) }));
import { LeadsCard } from '@cinegen/components/leads/leads-card';
import type { LeadRow } from '@cinegen/lib/leads/leads';

const S1 = 'a'.repeat(20);
const rows: LeadRow[] = [{ id: '1', kind: 'list-builder', clipId: 'list-builder', createdAt: '2026-11-10T10:00:00Z', data: { EMAIL: 'a@x.co' }, source: { session: S1, utm: { source: 'newsletter' } }, status: 'new', notes: '', tags: [] } as LeadRow];
const data = (reload = vi.fn(async () => {})) => ({ rows, loading: false, error: '', reload, remove: vi.fn(async () => {}), update: vi.fn(async () => {}) });
const insights = (reload = vi.fn(async () => {})) => ({ formStats: null, watch: { [S1]: { progress: 0.8, completed: false } }, reload });

describe('LeadsCard', () => {
  it('draws Source, Watched and Follow-up cells in the same order as their headers', () => {
    render(<LeadsCard data={data()} insights={insights()} published views={10} />);
    const heads = Array.from(document.querySelectorAll('thead th')).map((t) => t.textContent);
    const cells = Array.from(document.querySelectorAll('tbody tr:first-child td'));
    const at = (testId: string) => cells.findIndex((c) => c.getAttribute('data-testid') === testId);
    expect(heads.indexOf('Source')).toBeGreaterThan(-1);
    expect(at('lead-source')).toBe(heads.indexOf('Source'));
    expect(at('lead-watched')).toBe(heads.indexOf('Watched'));
    expect(at('lead-followup')).toBe(heads.indexOf('Follow-up'));
  });
  it('Refresh reloads both the leads and the insights', () => {
    const d = data(); const i = insights();
    render(<LeadsCard data={d} insights={i} published views={10} />);
    fireEvent.click(screen.getByText('Refresh'));
    expect(d.reload).toHaveBeenCalledTimes(1);
    expect(i.reload).toHaveBeenCalledTimes(1);
  });
});
