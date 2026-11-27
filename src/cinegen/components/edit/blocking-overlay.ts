import { useEffect, useState } from 'react';

/** Anything that matches is a modal/overlay the native video surface must not draw over. */
export const BLOCKING_OVERLAY_SELECTOR =
  '.settings-backdrop, .element-modal__backdrop, .sync-dialog__overlay, .fullscreen-modal, [aria-modal="true"]';

export function hasBlockingOverlay(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector(BLOCKING_OVERLAY_SELECTOR));
}

/** True while a blocking overlay is in the document; re-evaluated when overlays open or close. */
export function useBlockingOverlay(enabled = true): boolean {
  const [open, setOpen] = useState(() => enabled && hasBlockingOverlay());
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;
    const check = () => setOpen(hasBlockingOverlay());
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal', 'class'] });
    return () => observer.disconnect();
  }, [enabled]);
  return enabled && open;
}
