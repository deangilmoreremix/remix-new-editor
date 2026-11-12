import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { EditPersonalizationCard } from '@cinegen/components/leads/edit-personalization-card';
import { buildBulkRows, summarize } from '@cinegen/lib/leads/bulk-rows';

const T = 20; const clip = (s: number, e: number, x: object) => ({ left: (s / T) * 100, width: ((e - s) / T) * 100, ...x });
const draftProject = (text: string) => ({ version: 1, title: 'Draft', timelineSeconds: T, tracks: [
  { id: 'v', type: 'video', items: [clip(0, 20, { id: 'vid', type: 'video', src: 'https://cdn/x.mp4' })] },
  { id: 't', type: 'text', items: [clip(1, 15, { id: 'txt', type: 'overlay-text', addon: { text, geometry: { left: 10, top: 10, width: 30, height: 10 } } })] }] });

const contacts = [
  { id: 'a', name: 'Ann', variables: { FIRSTNAME: 'Ann', COMPANY: 'Smith Roofing' }, personalization: { business: { businessName: 'Smith Roofing', website: 'smith.com' } } },
  { id: 'b', name: 'Bob', variables: { FIRSTNAME: 'Bob', COMPANY: 'Wilson Plumbing' }, personalization: { business: { businessName: 'Wilson Plumbing', website: 'wilson.com' } } },
];
const businesses = [{ id: 'bs', business_key: 'smith.com', name: 'Smith Roofing' }, { id: 'bw', business_key: 'wilson.com', name: 'Wilson Plumbing' }];
const rows = buildBulkRows({ contacts, businesses, assets: [], assignments: [], recipients: [], requiredSlots: [] });

function fakeEngine() { const e: any = { model: null }; const create = (_h: any, o: any) => { e.model = o.model; return { play() {}, pause() {}, seekToFrame() {}, update: (m: any) => { e.model = m; }, destroy: vi.fn() }; }; return { e, create }; }

function setup(over: any = {}) {
  const pub: any = {
    id: 'vidAAAA1111', title: 'Spring', busy: false, info: { id: 'vidAAAA1111', title: 'Spring', published: true, view_count: 0, live_revision: 1 },
    revisions: [{ revision: 2, kind: 'draft', created_at: '2026-11-12T10:00:00Z' }, { revision: 1, kind: 'live', created_at: '2026-11-10T10:00:00Z' }],
    draftsUnavailable: false, saveDraft: vi.fn(async () => 3), promote: vi.fn(async () => {}), draftProject: vi.fn(async (rev: number) => draftProject(rev === 2 ? 'Hello {{FIRSTNAME}} at {{COMPANY}} - NEW OFFER' : 'old')), ...over.pub,
  };
  const rec: any = { rows, summary: { ...summarize(rows), linked: 2, stale: 0 }, ...over.rec };
  const lib: any = { business: { id: 'bs', name: 'Smith Roofing' }, profile: { id: 'a' }, findMore: vi.fn(async () => {}) };
  const f = fakeEngine();
  const playerDeps = { createEngine: f.create };
  return { pub, rec, lib, f, ui: <EditPersonalizationCard pub={pub} rec={rec} lib={lib} playerDeps={playerDeps} /> };
}

beforeEach(() => { document.documentElement.className = ''; document.title = 'Studio'; });

describe('EditPersonalizationCard', () => {
  it('opens the existing personalization modal for the chosen business', () => {
    const { ui, lib } = setup(); render(ui);
    fireEvent.click(screen.getByTestId('edit-open'));
    expect(lib.findMore).toHaveBeenCalled();
  });

  it('saves a draft without touching the live version', async () => {
    const { ui, pub } = setup(); render(ui);
    fireEvent.click(screen.getByTestId('draft-save'));
    await waitFor(() => expect(pub.saveDraft).toHaveBeenCalledWith('Spring'));
    expect(pub.promote).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('edit-notice').textContent).toMatch(/draft 3.*live link is unchanged/i));
  });

  it('lists live and draft versions; only drafts can be previewed or published', () => {
    const { ui } = setup(); render(ui);
    expect(screen.getByTestId('rev-1').getAttribute('data-kind')).toBe('live');
    expect(screen.queryByTestId('rev-preview-1')).toBeNull();
    expect(screen.getByTestId('rev-preview-2')).toBeTruthy();
  });

  it('publishing a draft needs a second confirmation, then promotes that revision', async () => {
    const { ui, pub } = setup(); render(ui);
    fireEvent.click(screen.getByTestId('rev-publish-2'));
    expect(pub.promote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('rev-publish-yes-2'));
    await waitFor(() => expect(pub.promote).toHaveBeenCalledWith(2));
    await waitFor(() => expect(screen.getByTestId('edit-notice').textContent).toMatch(/same link.*keep working/i));
  });

  it('previews the draft as Business A and Business B without leaking between them and without side effects', async () => {
    const { ui, pub, f } = setup(); const recordEvent = vi.fn(); const countView = vi.fn();
    const withSpies = (<EditPersonalizationCard pub={pub} rec={{ rows, summary: { ...summarize(rows), linked: 0, stale: 0 } } as any} lib={{ business: { id: 'bs', name: 'S' }, profile: { id: 'a' }, findMore: vi.fn() } as any} playerDeps={{ createEngine: f.create, recordEvent, countView }} />);
    void ui; render(withSpies);
    await act(async () => { fireEvent.click(screen.getByTestId('rev-preview-2')); });
    await waitFor(() => expect(pub.draftProject).toHaveBeenCalledWith(2));
    await waitFor(() => expect(JSON.stringify(f.e.model)).toContain('NEW OFFER'));
    const as = screen.getByTestId('draft-as');
    await act(async () => { fireEvent.change(as, { target: { value: 'a' } }); });
    await waitFor(() => expect(JSON.stringify(f.e.model)).toContain('Hello Ann at Smith Roofing'));
    expect(JSON.stringify(f.e.model)).not.toContain('Bob'); expect(JSON.stringify(f.e.model)).not.toContain('Wilson');
    await act(async () => { fireEvent.change(as, { target: { value: 'b' } }); });
    await waitFor(() => expect(JSON.stringify(f.e.model)).toContain('Hello Bob at Wilson Plumbing'));
    expect(JSON.stringify(f.e.model)).not.toContain('Smith');
    // generic viewer: no raw tokens
    await act(async () => { fireEvent.change(as, { target: { value: '' } }); });
    await waitFor(() => expect(JSON.stringify(f.e.model)).not.toContain('{{'));
    // owner preview never counts views or records events, and leaves the host page alone
    expect(countView).not.toHaveBeenCalled();
    expect(document.documentElement.classList.contains('watch-root')).toBe(false);
    expect(document.title).toBe('Studio');
  });

  it('shows an error if the draft cannot be loaded', async () => {
    const { pub, rec, lib } = setup({ pub: { draftProject: vi.fn(async () => null) } });
    render(<EditPersonalizationCard pub={pub} rec={rec} lib={lib} />);
    await act(async () => { fireEvent.click(screen.getByTestId('rev-preview-2')); });
    await waitFor(() => expect(screen.getByTestId('draft-error')).toBeTruthy());
  });

  it('hints when links have older images, renders nothing unpublished, and degrades without the drafts table', () => {
    const a = setup({ rec: { summary: { ...summarize(rows), linked: 2, stale: 2 } } }); const r1 = render(a.ui);
    expect(screen.getByTestId('stale-hint').textContent).toMatch(/2 personalized links have older images/); r1.unmount();
    const b = setup({ pub: { info: null } }); const r2 = render(b.ui); expect(r2.container.innerHTML).toBe(''); r2.unmount();
    render(setup({ pub: { draftsUnavailable: true } }).ui);
    expect(screen.getByTestId('drafts-unavailable')).toBeTruthy();
  });
});
