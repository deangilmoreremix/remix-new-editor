// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';
import { Tip } from '../Tip';
import { EDITOR_TIPS, type EditorTipId } from '../editorTips';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
const mounted: { root: ReturnType<typeof createRoot>; el: HTMLElement }[] = [];
function mount(node: React.ReactElement) {
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el); mounted.push({ root, el });
  act(() => { root.render(node); });
  return el;
}
afterEach(() => { vi.useRealTimers(); for (const { root, el } of mounted.splice(0)) { act(() => root.unmount()); el.remove(); } });
const q = (el: HTMLElement, sel: string) => el.querySelector(sel) as HTMLElement | null;

describe('Tip', () => {
  it('shows on keyboard focus immediately, names itself to the control, and hides on blur', () => {
    const el = mount(<Tip id="undo"><button type="button">Undo</button></Tip>);
    const btn = q(el, 'button')!;
    expect(q(el, '[role="tooltip"]')).toBeNull();
    act(() => { btn.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
    const tip = q(el, '[role="tooltip"]')!;
    expect(tip.textContent).toContain(EDITOR_TIPS.undo.text);
    expect(tip.textContent).toContain('⌘Z');
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id);
    act(() => { btn.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(q(el, '[role="tooltip"]')).toBeNull();
    expect(btn.getAttribute('aria-describedby')).toBeNull();
  });

  it('shows after a short hover delay and hides when the pointer leaves', () => {
    vi.useFakeTimers();
    const el = mount(<Tip id="snap"><button type="button">Snap</button></Tip>);
    const wrap = q(el, '[data-tip-id="snap"]')!;
    act(() => { wrap.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })); });
    expect(q(el, '[role="tooltip"]')).toBeNull();
    act(() => { vi.advanceTimersByTime(400); });
    expect(q(el, '[role="tooltip"]')).toBeTruthy();
    act(() => { wrap.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })); });
    expect(q(el, '[role="tooltip"]')).toBeNull();
  });

  it('closes on Escape and never captures the pointer', () => {
    const el = mount(<Tip id="redo"><button type="button">Redo</button></Tip>);
    act(() => { q(el, 'button')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
    const tip = q(el, '[role="tooltip"]')!;
    expect(tip.style.pointerEvents).toBe('none');
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(q(el, '[role="tooltip"]')).toBeNull();
  });

  it('Escape dismisses only the tip: it does not reach a handler that would close the dialog', () => {
    const closeDialog = vi.fn();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDialog(); };
    document.addEventListener('keydown', onKey);
    try {
      const el = mount(<Tip id="undo"><button type="button">Undo</button></Tip>);
      act(() => { q(el, 'button')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
      act(() => { q(el, 'button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
      expect(q(el, '[role="tooltip"]')).toBeNull();
      expect(closeDialog).not.toHaveBeenCalled();
      // with no tip showing, Escape passes through untouched
      act(() => { q(el, 'button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
      expect(closeDialog).toHaveBeenCalledTimes(1);
    } finally { document.removeEventListener('keydown', onKey); }
  });

  it('marks paid actions with a credits badge and free actions as free', () => {
    const paid = mount(<Tip id="generateAi"><button type="button">AI</button></Tip>);
    act(() => { q(paid, 'button')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
    expect(q(paid, '[data-testid="tip-paid"]')).toBeTruthy();
    expect(q(paid, '[data-testid="tip-free"]')).toBeNull();
    const free = mount(<Tip id="renderBranded"><button type="button">Render</button></Tip>);
    act(() => { q(free, 'button')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
    expect(q(free, '[data-testid="tip-free"]')).toBeTruthy();
    expect(q(free, '[data-testid="tip-paid"]')).toBeNull();
  });

  it('hides when the control is pressed, so it never lingers over what was clicked', () => {
    const el = mount(<Tip id="undo"><button type="button">Undo</button></Tip>);
    act(() => { q(el, 'button')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
    expect(q(el, '[role="tooltip"]')).toBeTruthy();
    act(() => { q(el, '[data-tip-id="undo"]')!.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(q(el, '[role="tooltip"]')).toBeNull();
  });
});

describe('editor tips', () => {
  it('every tip has real copy, and no two tips say the same thing', () => {
    const texts = Object.values(EDITOR_TIPS).map((t) => t.text);
    for (const t of texts) { expect(t.trim().length).toBeGreaterThan(15); expect(t.length).toBeLessThan(220); }
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('a tip cannot be both paid and free', () => {
    for (const t of Object.values(EDITOR_TIPS)) expect(Boolean((t as { paid?: boolean }).paid && (t as { free?: boolean }).free)).toBe(false);
  });

  it('every tip used in the code exists, and every tip in the map is used by a control', () => {
    const roots = ['src/features/personalization/shared/personalization/guided'];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); } else if (/\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    roots.forEach((r) => walk(path.join(process.cwd(), r)));
    const used = new Set<string>();
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/<Tip\s+(?:key=\{[^}]*\}\s+)?id=(?:"([A-Za-z]+)"|\{[^}]*\})/g)) if (m[1]) used.add(m[1]);
      for (const m of src.matchAll(/tipId=(?:"([A-Za-z]+)"|\{([^}]*)\})/g)) {
        if (m[1]) used.add(m[1]);
        // a ternary: take the branch values (after ? and :), not the condition being compared
        if (m[2]) for (const q of m[2].matchAll(/[?:]\s*'([A-Za-z]+)'/g)) used.add(q[1]);
      }
      for (const m of src.matchAll(/tip:\s*'([A-Za-z]+)'/g)) used.add(m[1]);
    }
    const known = new Set(Object.keys(EDITOR_TIPS));
    for (const id of used) expect(known.has(id), `tip "${id}" is used but not defined in editorTips.ts`).toBe(true);
    for (const id of known) expect(used.has(id as EditorTipId), `tip "${id}" is defined but no control uses it`).toBe(true);
  });
});
