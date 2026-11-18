// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { captureOverlayPreset, saveOverlayPreset, listOverlayPresets, deleteOverlayPreset, presetOverlays } from '../lib/overlays/overlay-presets';
import { createOverlay } from '../lib/overlays/overlays';
import { MyPresetsPanel } from '../components/edit/my-presets-panel';
import { SavePresetRow } from '../components/edit/save-preset-row';

beforeEach(() => localStorage.clear());

describe('My presets', () => {
  it('saves a Smart Text look and applies it anywhere with new ids', () => {
    const o = createOverlay('overlay-text', 2, 20);
    (o.addon as Record<string, unknown>).fontColor = '#FFCC00';
    const preset = captureOverlayPreset([o], 'Gold headline')!;
    expect(preset.items[0]).toMatchObject({ type: 'overlay-text', offset: 0 });
    expect(saveOverlayPreset(preset)).toBe(true);
    expect(listOverlayPresets().map((p) => p.name)).toEqual(['Gold headline']);
    const a = presetOverlays(listOverlayPresets()[0], 7, 30);
    const b = presetOverlays(listOverlayPresets()[0], 7, 30);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ type: 'overlay-text', start: 7 });
    expect((a[0].addon as Record<string, unknown>).fontColor).toBe('#FFCC00');
    expect(a[0].id).not.toBe(o.id);
    expect(b[0].id).toBeTruthy();
    deleteOverlayPreset(preset.id);
    expect(listOverlayPresets()).toEqual([]);
  });
  it('keeps several overlays in step and skips what cannot be saved', () => {
    const t = createOverlay('overlay-text', 3, 20);
    const im = createOverlay('overlay-image', 4, 20);
    const form = createOverlay('lead-form', 3, 20);
    const preset = captureOverlayPreset([t, im, form], 'Combo')!;
    expect(preset.items.map((i) => i.type)).toEqual(['overlay-text', 'overlay-image']);
    expect(preset.items[1].offset).toBe(1);
    expect(captureOverlayPreset([form], 'x')).toBeNull();
  });
  it('the Add window panel lists, adds and deletes presets', () => {
    saveOverlayPreset(captureOverlayPreset([createOverlay('overlay-text', 0, 10)], 'One')!);
    const onPick = vi.fn();
    render(<MyPresetsPanel onPick={onPick} />);
    expect(screen.getByText('One')).toBeTruthy();
    fireEvent.click(screen.getByText('Add at playhead'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'One' }));
    fireEvent.click(screen.getByLabelText('Delete preset One'));
    expect(screen.getByTestId('my-presets-empty')).toBeTruthy();
  });
  it('the settings panel saves the open overlay under the name typed', () => {
    const o = createOverlay('overlay-text', 0, 10);
    render(<SavePresetRow overlay={o} />);
    fireEvent.click(screen.getByText('★ Save as preset'));
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'My title' } });
    fireEvent.click(screen.getByText('Save'));
    expect(listOverlayPresets().map((p) => p.name)).toEqual(['My title']);
    expect(screen.getByRole('status').textContent).toContain('My title');
  });
});
