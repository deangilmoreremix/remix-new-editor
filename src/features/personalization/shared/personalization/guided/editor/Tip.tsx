'use client';

import React, { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import { C } from '../tokens';
import { EDITOR_TIPS, type EditorTip, type EditorTipId } from './editorTips';

/**
 * Tooltip for one control. Shows on hover and on keyboard focus, hides on leave/blur and on Escape, and
 * names itself to the control with `aria-describedby`, so screen-reader users get the same help. It
 * never intercepts the pointer (pointer-events: none) so it cannot cover the control it describes.
 *
 * Wrap exactly one element: `<Tip id="undo"><button>Undo</button></Tip>`.
 */
export function Tip({ id, children, side = 'bottom' }: { id: EditorTipId; children: React.ReactElement; side?: 'top' | 'bottom' }): React.JSX.Element {
  const tip: EditorTip = EDITOR_TIPS[id];
  const uid = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    if (delay <= 0) { setOpen(true); return; }
    timer.current = setTimeout(() => setOpen(true), delay);
  }, []);
  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!open) return;
    // Capture phase + stopPropagation: while a tip is showing, Escape only dismisses the tip and does
    // not also close the dialog the control lives in.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  const child = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, { 'aria-describedby': open ? uid : undefined })
    : children;

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      data-tip-id={id}
      onMouseEnter={() => show(350)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
      onPointerDown={hide}
    >
      {child}
      {open && (
        <span
          role="tooltip"
          id={uid}
          data-testid="editor-tip"
          style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 80, pointerEvents: 'none',
            ...(side === 'top' ? { bottom: '100%', marginBottom: 8 } : { top: '100%', marginTop: 8 }),
            width: 'max-content', maxWidth: 240, padding: '8px 10px', borderRadius: 8,
            background: '#0b1016', border: `1px solid ${C.borderStrong}`, boxShadow: '0 8px 24px rgba(0,0,0,.55)',
            color: C.text, fontSize: 11, lineHeight: 1.4, fontWeight: 500, textTransform: 'none', letterSpacing: 0, textAlign: 'left', whiteSpace: 'normal',
          }}
        >
          {tip.text}
          {(tip.shortcut || tip.paid || tip.free) && (
            <span style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {tip.shortcut && <span style={{ padding: '1px 6px', borderRadius: 5, border: `1px solid ${C.border}`, color: C.muted, fontSize: 10 }}>{tip.shortcut}</span>}
              {tip.paid && (
                <span data-testid="tip-paid" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 5, background: 'rgba(252,211,77,.14)', color: '#fcd34d', fontSize: 10, fontWeight: 700 }}>
                  <Coins size={10} /> Uses credits
                </span>
              )}
              {tip.free && (
                <span data-testid="tip-free" style={{ padding: '1px 6px', borderRadius: 5, background: 'rgba(34,197,94,.14)', color: C.green, fontSize: 10, fontWeight: 700 }}>No credits used</span>
              )}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
