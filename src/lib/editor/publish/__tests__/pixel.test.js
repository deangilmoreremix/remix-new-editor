import { describe, it, expect, vi } from 'vitest';
import { pixelIdFor, fireLeadPixel } from '../pixel.js';

const project = {
  listBuilder: { enabled: true, fbPixelId: ' 1234567890 ' },
  tracks: [{ items: [{ id: 7, type: 'lead-form', fbPixelId: '987654321' }, { id: 8, type: 'lead-form', fbPixelId: 'abc' }] }],
};

describe('published-video Facebook Pixel', () => {
  it('finds the pixel id for a lead form clip or the list builder', () => {
    expect(pixelIdFor(project, 'lead-form', '7')).toBe('987654321');
    expect(pixelIdFor(project, 'list-builder', 'list-builder')).toBe('1234567890');
    expect(pixelIdFor(project, 'personalizer', 'list-builder')).toBe('1234567890');
  });

  it('ignores missing, invalid or disabled pixel ids', () => {
    expect(pixelIdFor(project, 'lead-form', '8')).toBe('');
    expect(pixelIdFor(project, 'lead-form', '99')).toBe('');
    expect(pixelIdFor({ listBuilder: { enabled: false, fbPixelId: '1234567890' } }, 'list-builder')).toBe('');
    expect(pixelIdFor(project, 'call-attempt', '7')).toBe('');
  });

  it('fires a bare Lead (no form answers) only with full consent', () => {
    const fbq = vi.fn();
    const win = { document: { createElement: () => ({}), head: { appendChild() {} } }, fbq };
    expect(fireLeadPixel('1234567890', { win, mode: 'full' })).toBe(true);
    expect(fbq).toHaveBeenCalledWith('init', '1234567890');
    expect(fbq).toHaveBeenCalledWith('trackSingle', '1234567890', 'Lead');
    expect(fbq.mock.calls.every((c) => c.length <= 3)).toBe(true);
  });

  it('does nothing when the viewer opted out or there is no id', () => {
    const fbq = vi.fn();
    const win = { document: {}, fbq };
    expect(fireLeadPixel('1234567890', { win, mode: 'off' })).toBe(false);
    expect(fireLeadPixel('1234567890', { win, mode: 'anonymous' })).toBe(false);
    expect(fireLeadPixel('', { win, mode: 'full' })).toBe(false);
    expect(fbq).not.toHaveBeenCalled();
  });
});
