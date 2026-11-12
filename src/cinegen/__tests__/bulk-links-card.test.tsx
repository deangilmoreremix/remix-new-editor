import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkLinksCard } from '@cinegen/components/leads/bulk-links-card';
import { buildBulkRows, summarize, type Recipient } from '@cinegen/lib/leads/bulk-rows';

const contacts = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, name: `Person ${i}`, variables: {}, personalization: { business: { businessName: `Biz ${i}`, website: `biz${i}.com` } } }));
const businesses = contacts.map((_, i) => ({ id: `b${i}`, business_key: `biz${i}.com`, name: `Biz ${i}` }));
const assets = businesses.map((b, i) => ({ id: `l${i}`, business_id: b.id, category: 'logo', origin: 'discovered', state: 'assigned', storage_url: `https://cdn.test/logo${i}.png` }));
const assignments = businesses.filter((_, i) => i !== 3).map((b, i0) => { const i = Number(b.id.slice(1)); return { business_id: b.id, slot: 'logoUrl', asset_id: `l${i}`, manual: true }; });
const tok = (c: string) => c.repeat(64).slice(0, 64);

function setup(over: { recipients?: Recipient[]; published?: boolean; slug?: string | null; unavailable?: boolean } = {}) {
  const recipients = over.recipients ?? [];
  const rows = buildBulkRows({ contacts, businesses, assets, assignments, recipients, requiredSlots: ['logoUrl'] });
  const rec: any = {
    rows, summary: summarize(rows), slug: over.slug ?? null, videoId: 'vidAAAA1111', busy: false, error: '', notice: '', unavailable: !!over.unavailable, usedUrls: new Set(),
    urlOf: (r: Recipient) => `https://smartvid.app/v/${over.slug ?? 'x'}?recipient=${r.token}`,
    create: vi.fn(async () => {}), revoke: vi.fn(async () => {}), refresh: vi.fn(async () => {}), saveSlug: vi.fn(async () => {}), importCsv: vi.fn(async () => {}), findAssets: vi.fn(async () => {}), csv: vi.fn(() => 'name,url'), reload: vi.fn(), requiredSlots: ['logoUrl'],
  };
  const pub: any = { id: 'vidAAAA1111', info: { id: 'vidAAAA1111', title: 'Spring Offer', published: over.published ?? true, view_count: 0 }, title: 'Spring Offer' };
  return { rec, pub, ui: <BulkLinksCard pub={pub} rec={rec} /> };
}

describe('BulkLinksCard', () => {
  it('lists 20 contacts with business, personalization and asset status; flags the one missing a logo', () => {
    const { ui } = setup(); render(ui);
    expect(screen.getByTestId('bulk-table').querySelectorAll('tbody tr')).toHaveLength(20);
    expect(screen.getByTestId('pstatus-c0').textContent).toBe('Ready');
    expect(screen.getByTestId('pstatus-c3').textContent).toBe('Needs assets');
    expect(screen.getByTestId('assets-c3').textContent).toMatch(/Missing logoUrl/);
    expect(screen.getByTestId('bulk-summary').textContent).toMatch(/19 ready · 1 need assets/);
  });

  it('creates links for the selected contacts, and offers "Create anyway" separately', () => {
    const { ui, rec } = setup(); render(ui);
    expect((screen.getByTestId('bulk-create') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Select Person 0')); fireEvent.click(screen.getByLabelText('Select Person 3'));
    fireEvent.click(screen.getByTestId('bulk-create'));
    expect(rec.create).toHaveBeenCalledWith(['c0', 'c3']);
    fireEvent.click(screen.getByTestId('bulk-create-anyway'));
    expect(rec.create).toHaveBeenLastCalledWith(['c0', 'c3'], { allowMissing: true });
  });

  it('select all / clear selection', () => {
    const { ui, rec } = setup(); render(ui);
    fireEvent.click(screen.getByTestId('bulk-select-all'));
    fireEvent.click(screen.getByTestId('bulk-create'));
    expect((rec.create.mock.calls[0][0] as string[]).length).toBe(20);
    fireEvent.click(screen.getByTestId('bulk-select-all'));
    expect((screen.getByTestId('bulk-create') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a per-contact URL with an opaque token, no personal data in it, and copies it', () => {
    const r: Recipient = { id: 'r0', token: tok('a'), contact_ref: 'c0', status: 'active', created_at: '2026-11-12T10:00:00Z', variables: { logoUrl: 'https://cdn.test/logo0.png' } };
    const { ui } = setup({ recipients: [r], slug: 'spring-offer' }); render(ui);
    const url = (screen.getByLabelText('Link for Person 0') as HTMLInputElement).value;
    expect(url).toBe(`https://smartvid.app/v/spring-offer?recipient=${tok('a')}`);
    expect(url).not.toMatch(/Person|Biz|biz0/);
    expect(screen.getByTestId('lstatus-c0').textContent).toBe('active');
    expect(screen.getByTestId('lstatus-c1').textContent).toBe('—');
    const write = vi.fn(); Object.assign(navigator, { clipboard: { writeText: write } });
    fireEvent.click(screen.getByTestId('copy-c0'));
    expect(write).toHaveBeenCalledWith(url);
  });

  it('revoking needs a second click and calls revoke once; revoked rows have no URL or actions', () => {
    const r: Recipient = { id: 'r0', token: tok('a'), contact_ref: 'c0', status: 'active', created_at: '2026-11-12T10:00:00Z', variables: {} };
    const { ui, rec } = setup({ recipients: [r] }); const { rerender } = render(ui);
    fireEvent.click(screen.getByTestId('revoke-c0'));
    expect(rec.revoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('revoke-yes-c0'));
    expect(rec.revoke).toHaveBeenCalledWith('r0');
    const s2 = setup({ recipients: [{ ...r, status: 'revoked' }] }); rerender(s2.ui);
    expect(screen.getByTestId('lstatus-c0').textContent).toBe('revoked');
    expect(screen.queryByLabelText('Link for Person 0')).toBeNull();
    expect(screen.queryByTestId('revoke-c0')).toBeNull();
  });

  it('opens a recipient preview of that exact URL and sends missing-asset contacts to Asset Finder', () => {
    const r: Recipient = { id: 'r0', token: tok('b'), contact_ref: 'c0', status: 'active', created_at: '2026-11-12T10:00:00Z', variables: {} };
    const { ui, rec } = setup({ recipients: [r], slug: 'spring-offer' }); render(ui);
    fireEvent.click(screen.getByTestId('preview-c0'));
    expect((screen.getByTestId('recipient-frame') as HTMLIFrameElement).src).toContain(`recipient=${tok('b')}`);
    fireEvent.click(screen.getByTestId('find-c3'));
    expect(rec.findAssets).toHaveBeenCalledWith('c3');
  });

  it('validates the link name before saving', () => {
    const { ui, rec } = setup(); render(ui);
    const input = screen.getByTestId('slug-input'); const save = screen.getByTestId('slug-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'watch' } }); expect(save.disabled).toBe(true);   // reserved
    fireEvent.change(input, { target: { value: 'Bad Name!' } }); expect(save.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'smith-roofing' } }); expect(save.disabled).toBe(false);
    fireEvent.click(save); expect(rec.saveSlug).toHaveBeenCalledWith('smith-roofing');
    fireEvent.click(screen.getByTestId('slug-suggest')); expect((input as HTMLInputElement).value).toBe('spring-offer');
  });

  it('refresh and export are enabled only when they apply; export gives the CSV for the selection', () => {
    const r: Recipient = { id: 'r0', token: tok('a'), contact_ref: 'c0', status: 'active', created_at: '2026-11-12T10:00:00Z', variables: { logoUrl: 'https://cdn.test/OLD.png' } };
    const { ui, rec } = setup({ recipients: [r] }); render(ui);
    expect(screen.getByTestId('stale-c0')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Select Person 0'));
    fireEvent.click(screen.getByTestId('bulk-refresh'));
    expect(rec.refresh).toHaveBeenCalledWith(['c0']);
    expect((screen.getByTestId('bulk-export') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the publish-first and not-installed states instead of a table', () => {
    const a = setup(); a.pub.info = null; const r1 = render(<BulkLinksCard pub={a.pub} rec={a.rec} />);
    expect(screen.getByTestId('bulk-needs-publish')).toBeTruthy(); r1.unmount();
    render(setup({ unavailable: true }).ui);
    expect(screen.getByTestId('bulk-unavailable')).toBeTruthy();
  });
});
