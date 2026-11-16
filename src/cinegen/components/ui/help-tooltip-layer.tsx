// [remix] Hover help for every control in the Timeline Studio Editor (not part of CineGen).
// One delegated layer: it looks at whatever the pointer / keyboard focus is on, finds its label (data-help, title, aria-label or short
// button text), looks it up in lib/help/help-content.ts and shows a card: the name and a one-line summary first, then it expands into
// the full definition and step-by-step usage. Controls keep working exactly as before; only the native `title` bubble is replaced.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveHelp, resolveHelpForElement, type HelpEntry } from '@cinegen/lib/help/help-content';

const SHOW_DELAY_MS = 350;
const EXPAND_DELAY_MS = 900;
const HIDE_DELAY_MS = 120;
// Clips, the ruler, track names and media items are hovered constantly while editing: their card waits longer.
const STRUCTURAL_SHOW_DELAY_MS = 900;

interface Shown {
  entry: HelpEntry;
  rect: DOMRect;
  expanded: boolean;
}

/** Row label of a slider / dropdown / field that has no title of its own ("Rate", "Position X", "Fit"...). */
function rowLabel(el: HTMLElement): string {
  // Fields, and icon-only switches that sit inside a <label> ("Instrumental", "Analyze Video").
  const isField = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
  const isLabelledSwitch = el instanceof HTMLButtonElement && !(el.textContent || '').trim() && !!el.closest('label');
  if (!isField && !isLabelledSwitch) return '';
  const own = (n: Element | null) => (n?.textContent || '').trim().replace(/\s+/g, ' ');
  const wrap = el.closest('label');
  const firstOption = el instanceof HTMLSelectElement ? (el.options[0]?.text || '').trim() : ''; // dropdowns whose first option is their name ("Genre", "Mood")
  const cand = [own(wrap), own(el.previousElementSibling), own(el.parentElement?.querySelector(':scope > label, :scope > span')), firstOption];
  return cand.find((c) => c && c.length <= 28 && resolveHelp(c)) || '';
}

/** The label a control is known by, and the element that carries it. */
function labelOf(start: EventTarget | null): { el: HTMLElement; label: string; entry?: HelpEntry } | null {
  let el = start instanceof HTMLElement ? start : (start as Node | null)?.parentElement ?? null;
  for (let i = 0; el && i < 6; i++, el = el.parentElement) {
    if (el.closest('.help-tip')) return null;
    const direct = el.dataset.help || el.dataset.helpTitle || el.getAttribute('title') || el.getAttribute('aria-label')
      || ((el.tagName === 'BUTTON' || el.tagName === 'SUMMARY') ? (el.textContent || '').trim().replace(/\s+/g, ' ') : '');
    const firstLine = el.tagName === 'BUTTON' ? ((el.innerText || '').split('\n')[0] || '').trim() : '';
    const placeholder = el instanceof HTMLInputElement ? el.placeholder : '';
    const label = direct && direct.length <= 160 && resolveHelp(direct) ? direct
      : firstLine && firstLine.length <= 40 && resolveHelp(firstLine) ? firstLine
      : placeholder && resolveHelp(placeholder) ? placeholder
      : rowLabel(el);
    if (label) return { el, label };
    const byClass = resolveHelpForElement(el);
    if (byClass) return { el, label: '', entry: byClass };
  }
  return null;
}

function place(rect: DOMRect, w: number, h: number): { left: number; top: number } {
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampTop = (t: number) => Math.max(pad, Math.min(t, vh - h - pad));
  const clampLeft = (l: number) => Math.max(pad, Math.min(l, vw - w - pad));
  // Small icon controls (tool rail, track buttons): open beside them so the card never covers the rail itself.
  if (rect.width <= 64 && rect.right + pad + w <= vw) return { left: rect.right + pad, top: clampTop(rect.top + rect.height / 2 - 24) };
  if (rect.bottom + pad + h <= vh) return { left: clampLeft(rect.left + rect.width / 2 - w / 2), top: rect.bottom + pad };
  if (rect.top - pad - h >= 0) return { left: clampLeft(rect.left + rect.width / 2 - w / 2), top: rect.top - pad - h };
  if (rect.right + pad + w <= vw) return { left: rect.right + pad, top: clampTop(rect.top) };
  return { left: clampLeft(rect.left - pad - w), top: clampTop(rect.top) };
}

export function HelpTooltipLayer() {
  const [shown, setShown] = useState<Shown | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const target = useRef<{ el: HTMLElement; title: string | null } | null>(null);
  const timers = useRef<{ show?: number; expand?: number; hide?: number }>({});
  const overCard = useRef(false);

  const clearTimers = useCallback(() => {
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.expand);
    window.clearTimeout(timers.current.hide);
  }, []);

  const restoreTitle = useCallback(() => {
    const t = target.current;
    if (t && t.title != null && !t.el.getAttribute('title')) t.el.setAttribute('title', t.title);
    if (t) { t.el.removeAttribute('aria-describedby'); delete t.el.dataset.helpTitle; }
    target.current = null;
  }, []);

  const hide = useCallback(() => {
    clearTimers();
    restoreTitle();
    setShown(null);
    setPos(null);
    overCard.current = false;
  }, [clearTimers, restoreTitle]);

  const open = useCallback((el: HTMLElement, label: string, direct?: HelpEntry) => {
    const entry = direct ?? resolveHelp(label);
    if (!entry) return;
    if (target.current?.el === el) return;
    clearTimers();
    restoreTitle();
    const title = el.getAttribute('title');
    if (title != null) { el.dataset.helpTitle = title; el.removeAttribute('title'); } // no second, native bubble
    target.current = { el, title };
    const showDelay = direct ? STRUCTURAL_SHOW_DELAY_MS : SHOW_DELAY_MS;
    timers.current.show = window.setTimeout(() => {
      if (target.current?.el !== el) return;
      setPos(null);
      setShown({ entry, rect: el.getBoundingClientRect(), expanded: false });
      el.setAttribute('aria-describedby', 'help-tip-card');
      timers.current.expand = window.setTimeout(() => setShown((s) => (s ? { ...s, expanded: true } : s)), EXPAND_DELAY_MS - SHOW_DELAY_MS);
    }, showDelay);
  }, [clearTimers, restoreTitle]);

  useEffect(() => {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || coarse) return;
      const hit = labelOf(e.target);
      if (hit) { window.clearTimeout(timers.current.hide); open(hit.el, hit.label, hit.entry); }
    };
    const onOut = (e: PointerEvent) => {
      const to = e.relatedTarget as Node | null;
      if (to && target.current?.el.contains(to)) return;
      if (to && (to as HTMLElement).closest?.('.help-tip')) return;
      window.clearTimeout(timers.current.hide);
      timers.current.hide = window.setTimeout(() => { if (!overCard.current) hide(); }, HIDE_DELAY_MS);
    };
    const onFocus = (e: FocusEvent) => {
      const hit = labelOf(e.target);
      if (hit && (e.target as HTMLElement).matches?.(':focus-visible')) open(hit.el, hit.label, hit.entry);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('pointerout', onOut, true);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', hide, true);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('pointerout', onOut, true);
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('focusout', hide, true);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
      clearTimers();
      restoreTitle();
    };
  }, [open, hide, clearTimers, restoreTitle]);

  // Position once the card has a size, and again when it expands.
  useEffect(() => {
    if (!shown || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    setPos(place(shown.rect, r.width, r.height));
  }, [shown?.entry, shown?.rect, shown?.expanded]);

  if (!shown || typeof document === 'undefined') return null;
  const { entry, expanded } = shown;
  return createPortal(
    <div
      id="help-tip-card"
      ref={cardRef}
      role="tooltip"
      className={`help-tip${expanded ? ' help-tip--expanded' : ''}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
      onPointerEnter={() => { overCard.current = true; window.clearTimeout(timers.current.hide); setShown((s) => (s ? { ...s, expanded: true } : s)); }}
      onPointerLeave={() => { overCard.current = false; timers.current.hide = window.setTimeout(hide, HIDE_DELAY_MS); }}
    >
      <div className="help-tip__head">
        <strong className="help-tip__name">{entry.name}</strong>
        {entry.shortcut && <kbd className="help-tip__key">{entry.shortcut}</kbd>}
      </div>
      <p className="help-tip__summary">{entry.summary}</p>
      {expanded ? (
        <div className="help-tip__more">
          <p className="help-tip__what">{entry.what}</p>
          {entry.how.length > 0 && (
            <>
              <span className="help-tip__label">How to use</span>
              <ol className="help-tip__how">{entry.how.map((h, i) => <li key={i}>{h}</li>)}</ol>
            </>
          )}
        </div>
      ) : (
        <span className="help-tip__hint">Keep hovering for details</span>
      )}
    </div>,
    document.body,
  );
}
