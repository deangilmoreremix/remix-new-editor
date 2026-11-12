import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssetPicker } from '@cinegen/components/leads/asset-picker';
import type { BusinessLibrary } from '@cinegen/components/leads/use-business-library';

const asset = (id: string, category: string, state = 'imported', origin = 'discovered') => ({ id, category, origin, state, storage_url: `https://cdn.test/${id}.png`, meta: { name: id } });
const slot = (s: string, label: string, hasFallback = false) => ({ slot: s, label, hasFallback, clipCount: 1 });
function lib(over: Partial<BusinessLibrary> = {}): BusinessLibrary {
  return {
    profile: { id: 'c1' }, business: { id: 'b1', name: 'Smith Roofing' }, slots: [slot('logoUrl', 'logo'), slot('productImageUrl', 'product image', true)],
    assets: [asset('a1', 'logo', 'discovered'), asset('a2', 'service', 'imported', 'uploaded'), asset('a3', 'logo', 'assigned')],
    assignments: [], busy: false, error: '', unavailable: false, signedIn: true, notice: '',
    assign: vi.fn(async () => true), clear: vi.fn(async () => {}), remove: vi.fn(async () => {}), upload: vi.fn(async () => {}),
    findMore: vi.fn(async () => {}), syncFromModal: vi.fn(async () => 0), reload: vi.fn(async () => {}), ...over,
  };
}

describe('AssetPicker', () => {
  it('shows discovered / imported / assigned / used as distinct states', () => {
    render(<AssetPicker lib={lib()} usedUrls={new Set(['https://cdn.test/a3.png'])} />);
    expect(screen.getByTestId('state-a1').textContent).toBe('discovered');
    expect(screen.getByTestId('state-a2').textContent).toBe('imported');
    expect(screen.getByTestId('state-a3').textContent).toBe('used'); // only because a published link carries it
  });

  it('flags a missing slot and lets a fallback slot read as covered', () => {
    render(<AssetPicker lib={lib()} />);
    expect(screen.getByTestId('slot-logoUrl').getAttribute('data-status')).toBe('missing');
    expect(screen.getByTestId('slot-productImageUrl').getAttribute('data-status')).toBe('fallback');
    expect(screen.getByTestId('slot-logoUrl').textContent).toMatch(/No logo yet/);
  });

  it('assigns an asset to a chosen slot as a manual choice', async () => {
    const l = lib(); render(<AssetPicker lib={l} />);
    fireEvent.click(screen.getByTestId('use-a1'));
    fireEvent.click(screen.getByTestId('assign-a1-logoUrl'));
    await waitFor(() => expect(l.assign).toHaveBeenCalledWith('logoUrl', 'a1', { manual: true }));
  });

  it('asks before replacing an image the user chose, and does nothing on "Keep current"', async () => {
    const l = lib({ assignments: [{ slot: 'logoUrl', asset_id: 'a3', manual: true }] }); render(<AssetPicker lib={l} />);
    fireEvent.click(screen.getByTestId('use-a1'));
    fireEvent.click(screen.getByTestId('assign-a1-logoUrl'));
    expect(l.assign).not.toHaveBeenCalled();
    expect(screen.getByTestId('replace-confirm')).toBeTruthy();
    fireEvent.click(screen.getByText('Keep current'));
    expect(l.assign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('assign-a1-logoUrl'));
    fireEvent.click(screen.getByTestId('replace-yes'));
    await waitFor(() => expect(l.assign).toHaveBeenCalledWith('logoUrl', 'a1', { manual: true }));
  });

  it('filters by category, removes, uploads (images only) and opens the finder', async () => {
    const l = lib(); render(<AssetPicker lib={l} />);
    fireEvent.click(screen.getByRole('tab', { name: 'service' }));
    expect(screen.queryByTestId('asset-a1')).toBeNull();
    expect(screen.getByTestId('asset-a2')).toBeTruthy();
    fireEvent.click(screen.getByTestId('remove-a2'));
    expect(l.remove).toHaveBeenCalledWith('a2');
    const file = new File(['x'], 'p.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('picker-upload'), { target: { files: [file] } });
    expect(l.upload).toHaveBeenCalledWith(file, 'service');
    fireEvent.click(screen.getByTestId('picker-find'));
    expect(l.findMore).toHaveBeenCalled();
  });

  it('handles signed-out, no business, empty and not-installed states without crashing', () => {
    const { unmount } = render(<AssetPicker lib={lib({ signedIn: false, business: null })} />);
    expect(screen.getByTestId('picker-signin')).toBeTruthy(); unmount();
    const r2 = render(<AssetPicker lib={lib({ business: null })} />);
    expect(screen.getByTestId('picker-nobiz')).toBeTruthy(); r2.unmount();
    const r3 = render(<AssetPicker lib={lib({ assets: [] })} />);
    expect(screen.getByTestId('picker-empty').textContent).toMatch(/Smith Roofing/); r3.unmount();
    render(<AssetPicker lib={lib({ unavailable: true })} />);
    expect(screen.getByTestId('picker-unavailable')).toBeTruthy();
  });

  it('never renders another business: shows only the assets it is given', () => {
    render(<AssetPicker lib={lib({ business: { id: 'b2', name: 'Wilson Plumbing' }, assets: [asset('w1', 'logo')] })} />);
    expect(screen.getByTestId('picker-business').textContent).toBe('Wilson Plumbing');
    expect(screen.queryByTestId('asset-a1')).toBeNull();
  });
});
