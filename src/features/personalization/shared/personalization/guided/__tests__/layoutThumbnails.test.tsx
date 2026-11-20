// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PREVIEW_LAYOUTS, createDefaultPreviewSettings } from '../../preview/presets';

vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: vi.fn() }));
// The real preview mounts a Remotion Player; the card behaviour is what is under test here.
vi.mock('../PersonalizationTemplateBrowser', () => ({
  TemplateLivePreview: ({ item, playing }: { item: { id: string }; playing: boolean }) => (
    <div data-testid={`preview-${item.id}`} data-playing={String(playing)} />
  ),
}));
import { useDemoPersonalize } from '../../DemoPersonalizeProvider';
import { LayoutThumbnails } from '../LayoutThumbnails';

afterEach(() => cleanup());

function setup(layout = 'business-introduction') {
  vi.mocked(useDemoPersonalize).mockImplementation(() => ({
    previewSettings: { ...createDefaultPreviewSettings(), layout },
    source: null, previewVideo: null, clientForm: { businessName: 'Acme Bakery' }, assets: {},
  }) as unknown as ReturnType<typeof useDemoPersonalize>);
  const onChoose = vi.fn();
  render(<LayoutThumbnails onChoose={onChoose} activeLayoutId={layout as never} />);
  return onChoose;
}

describe('LayoutThumbnails', () => {
  it('draws only what the customer has: no invented offer, phone or call to action', async () => {
    const presets = await import('../../preview/presets');
    const spy = vi.spyOn(presets, 'applyLayoutPreset');
    vi.mocked(useDemoPersonalize).mockImplementation(() => ({
      previewSettings: createDefaultPreviewSettings(), source: null, previewVideo: null,
      clientForm: { businessName: 'Acme Bakery' }, assets: {},
    }) as unknown as ReturnType<typeof useDemoPersonalize>);
    render(<LayoutThumbnails onChoose={vi.fn()} activeLayoutId={null} />);
    const ctx = spy.mock.calls[0][2] as Record<string, unknown>;
    expect(ctx.offer).toBe('');
    expect(ctx.cta).toBe('');
    expect(ctx.phone).toBe('');
    expect(JSON.stringify(ctx)).not.toMatch(/20% off|Book now|555/);
    spy.mockRestore();
  });
  it('shows every layout as a button with a name and a preview, and no <video>', () => {
    setup();
    for (const layout of PREVIEW_LAYOUTS) {
      expect(screen.getByTestId(`layout-thumb-${layout.id}`).textContent).toContain(layout.name);
      expect(screen.getByTestId(`preview-${layout.id}`)).toBeTruthy();
    }
    expect(document.querySelectorAll('video')).toHaveLength(0);
  });
  it('marks only the active layout pressed and plays only the hovered one', () => {
    setup('product-showcase');
    expect(screen.getByTestId('layout-thumb-product-showcase').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('layout-thumb-business-introduction').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('preview-product-showcase').getAttribute('data-playing')).toBe('false');
    expect(screen.getByTestId('preview-special-offer').getAttribute('data-playing')).toBe('false');
    fireEvent.mouseEnter(screen.getByTestId('layout-thumb-special-offer'));
    expect(screen.getByTestId('preview-special-offer').getAttribute('data-playing')).toBe('true');
  });
  it('choosing a layout reports its id', () => {
    const onChoose = setup();
    fireEvent.click(screen.getByTestId('layout-thumb-service-promotion'));
    expect(onChoose).toHaveBeenCalledWith('service-promotion');
  });
});
