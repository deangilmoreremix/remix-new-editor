// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ShapeExportPanel } from '../ShapeExportPanel';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { document.body.innerHTML = ''; });

const ITEMS = (statuses: Array<'waiting' | 'rendering' | 'done' | 'failed' | 'cancelled'>) =>
  ['16:9', '9:16', '1:1', '4:5'].map((aspect, i) => ({ aspect, status: statuses[i] ?? 'waiting', progress: statuses[i] === 'rendering' ? 0.4 : 0, ...(statuses[i] === 'failed' ? { error: 'boom' } : {}) }));

function mount(props: Partial<React.ComponentProps<typeof ShapeExportPanel>> = {}) {
  const onStart = vi.fn(); const onCancel = vi.fn();
  const el = document.createElement('div'); document.body.appendChild(el);
  act(() => { createRoot(el).render(<ShapeExportPanel state={{ status: 'idle', items: [] }} disabled={false} onStart={onStart} onCancel={onCancel} {...props} />); });
  return { el, onStart, onCancel };
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;

describe('ShapeExportPanel', () => {
  it('starts the export on click and lists nothing while idle', () => {
    const { el, onStart } = mount();
    expect(el.querySelector('li')).toBeNull();
    act(() => { q(el, 'pz-export-all-shapes')!.click(); });
    expect(onStart).toHaveBeenCalledTimes(1);
  });
  it('is disabled when blocked', () => {
    const { el, onStart } = mount({ disabled: true });
    act(() => { q(el, 'pz-export-all-shapes')!.click(); });
    expect(onStart).not.toHaveBeenCalled();
  });
  it('shows per-shape progress, success and failure, with a cancel while running', () => {
    const { el, onCancel } = mount({ state: { status: 'running', items: ITEMS(['done', 'rendering', 'failed']) } });
    expect(q(el, 'pz-shape-16x9')!.textContent).toContain('saved to your downloads');
    expect(q(el, 'pz-shape-9x16')!.textContent).toContain('rendering 40%');
    expect(q(el, 'pz-shape-1x1')!.textContent).toContain('failed — boom');
    expect(q(el, 'pz-shape-4x5')!.textContent).toContain('waiting');
    expect(q(el, 'pz-export-all-shapes')!.disabled).toBe(true);
    act(() => { q(el, 'pz-export-all-cancel')!.click(); });
    expect(onCancel).toHaveBeenCalled();
  });
});
