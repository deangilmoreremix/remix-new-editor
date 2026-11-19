// The Template Generator's "Add to Video Pages" button opens the app's ONE landing page picker (src/lib/landingPages/pickerModal.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatorHostOptions } from '@cinegen/lib/occ/template-generator-host';

const open = vi.hoisted(() => vi.fn(() => ({ close: vi.fn() })));
vi.mock('../../lib/landingPages/pickerModal.js', () => ({ openLandingPagePicker: open }));

describe('Template Generator → the shared landing page picker', () => {
  beforeEach(() => { open.mockClear(); });

  it('opens it with the rendered video (blob file, name, length), above the generator window, and passes the saved-page callback on', async () => {
    const onPick = vi.fn();
    await generatorHostOptions([]).addToVideoPages({ url: 'blob:http://x/abc', title: 'Harbor Dental', fileSize: 8 * 1048576, duration: 31 }, { onPick });
    expect(open).toHaveBeenCalledTimes(1);
    const arg = (open.mock.calls[0] as unknown[])[0] as { video: Record<string, unknown>; zIndex: number; onPick: unknown };
    expect(arg.video).toEqual({ url: 'blob:http://x/abc', name: 'Harbor Dental', duration: 31, studio: 'template-generator' });
    expect(arg.zIndex).toBeGreaterThan(9999);                      // the generator's window is at 9999
    expect(arg.onPick).toBe(onPick);
  });

  it('leaves the length out when it is not known, and works without a callback', async () => {
    await generatorHostOptions([]).addToVideoPages({ url: 'blob:http://x/abc', title: 'Clip' });
    const arg = (open.mock.calls[0] as unknown[])[0] as { video: Record<string, unknown> };
    expect(arg.video).toEqual({ url: 'blob:http://x/abc', name: 'Clip', studio: 'template-generator' });
  });
});
