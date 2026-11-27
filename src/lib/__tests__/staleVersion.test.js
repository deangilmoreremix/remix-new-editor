// staleVersion: a tab from before a deploy shows one "SmartVid was updated. Reload" banner instead of dead buttons.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isStaleChunkError, showReloadBanner, mountStaleVersionGuard } from '../staleVersion.js';

afterEach(() => { document.body.innerHTML = ''; });

describe('staleVersion', () => {
  it('recognises missing code-file errors from Chrome, Firefox and Safari', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://smartvid.app/assets/pickerModal-BX-cFTiQ.js'))).toBe(true);
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new Error('Network down'))).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });

  it('shows one banner whose button reloads', () => {
    const reload = vi.fn();
    const a = showReloadBanner({ reload });
    const b = showReloadBanner({ reload });
    expect(a).toBe(b);
    expect(document.querySelectorAll('[data-stale-version]').length).toBe(1);
    expect(a.textContent).toContain('SmartVid was updated');
    a.querySelector('button').click();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows the banner for a stale-import rejection and ignores other rejections', () => {
    const guard = mountStaleVersionGuard({ win: window });
    const fire = (reason) => { const e = new Event('unhandledrejection'); e.reason = reason; window.dispatchEvent(e); };
    fire(new Error('Something else'));
    expect(document.querySelector('[data-stale-version]')).toBeNull();
    fire(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'));
    expect(document.querySelector('[data-stale-version]')).not.toBeNull();
    guard.stop();
  });

  it('shows the banner for Vite\'s preload error event', () => {
    const guard = mountStaleVersionGuard({ win: window });
    window.dispatchEvent(new Event('vite:preloadError'));
    expect(document.querySelector('[data-stale-version]')).not.toBeNull();
    guard.stop();
  });
});
