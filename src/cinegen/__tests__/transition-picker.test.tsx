// [remix] Stage 6: the transition picker (search, categories, thumbnails) and the parameter controls drive real state.
// Only the GL thumbnail canvas is replaced (jsdom has no WebGL); everything else is the real component + real catalog.
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('../../openchatcut/library/TransitionThumb', () => ({ TransitionThumb: ({ type, playing }: { type: string; playing?: boolean }) => <span data-testid={`thumb-${type}`} data-playing={String(!!playing)} /> }));

import { TransitionPicker, TransitionParams } from '../components/edit/transition-picker';
import { GLT_CATALOG, GLT_CATEGORIES } from '../../openchatcut/gl/glt';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactElement) {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host); act(() => { root.render(node); });
  return { host, cleanup: () => { act(() => root.unmount()); host.remove(); } };
}
const setValue = (el: HTMLInputElement | HTMLSelectElement, v: string) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
  act(() => { el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
};
const tid = (host: HTMLElement, id: string) => [...host.querySelectorAll('[data-testid]')].find((e) => e.getAttribute('data-testid') === id) as HTMLElement | undefined; // (jsdom's selector engine chokes on '&' in attribute values)
const classic = [{ id: 'cross-dissolve', label: 'Cross Dissolve' }, { id: 'page-curl', label: 'Page Curl' }];

describe('TransitionPicker', () => {
  it('lists classic + every vendored transition with a preview thumbnail, filters by category and search, picks by click', () => {
    const onPick = vi.fn();
    const { host, cleanup } = mount(<TransitionPicker value="cross-dissolve" classic={classic} plugin={[]} onPick={onPick} />);
    expect(host.querySelectorAll('[data-testid^="tr-pick-"]').length).toBe(classic.length + GLT_CATALOG.length);
    expect(host.querySelector('[data-testid="thumb-glt-cube"]')).toBeTruthy();
    for (const c of GLT_CATEGORIES) expect(tid(host, `tr-cat-${c}`), c).toBeTruthy();
    // category
    act(() => { tid(host, 'tr-cat-Wipe')!.click(); });
    const wipes = GLT_CATALOG.filter((e) => e.category === 'Wipe').length;
    expect(host.querySelectorAll('[data-testid^="tr-pick-"]').length).toBe(wipes);
    act(() => { tid(host, 'tr-cat-Classic')!.click(); });
    expect(host.querySelectorAll('[data-testid^="tr-pick-"]').length).toBe(classic.length);
    act(() => { tid(host, 'tr-cat-All')!.click(); });
    // search
    setValue(host.querySelector('input[type="search"]') as HTMLInputElement, 'swirl');
    expect([...host.querySelectorAll('[data-testid^="tr-pick-"]')].map((e) => e.getAttribute('data-testid'))).toContain('tr-pick-glt-swirl');
    setValue(host.querySelector('input[type="search"]') as HTMLInputElement, 'zzzqq');
    expect(host.textContent).toContain('No transitions match');
    setValue(host.querySelector('input[type="search"]') as HTMLInputElement, 'cross');
    act(() => { (host.querySelector('[data-testid="tr-pick-glt-cross-warp"]') as HTMLElement).click(); });
    expect(onPick).toHaveBeenCalledWith('glt-cross-warp');
    // hover plays the live preview
    const card = host.querySelector('[data-testid="tr-pick-glt-cross-warp"]') as HTMLElement;
    act(() => { card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(host.querySelector('[data-testid="thumb-glt-cross-warp"]')!.getAttribute('data-playing')).toBe('true');
    cleanup();
  });
});

describe('TransitionParams', () => {
  it('shows controls with defaults, stores only changed values, resets, and handles direction / bool / colour / int', () => {
    const calls: Array<Record<string, unknown> | undefined> = [];
    let params: Record<string, number | boolean | number[]> | undefined;
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    const render = (id: string) => act(() => { root.render(<TransitionParams id={id} params={params} onChange={(n) => { calls.push(n); params = n; render(id); }} />); });
    render('glt-cube');
    expect(host.querySelector('[data-testid="transition-params-reset"]')).toBeNull();
    const persp = host.querySelector('input[aria-label="persp"]') as HTMLInputElement;
    expect(parseFloat(persp.value)).toBeCloseTo(0.7);
    setValue(persp, '0.2');
    expect(calls.at(-1)).toEqual({ persp: 0.2 });
    setValue(host.querySelector('input[aria-label="persp"]') as HTMLInputElement, '0.7'); // back to the default -> not stored
    expect(calls.at(-1)).toBeUndefined();
    setValue(host.querySelector('input[aria-label="floating"]') as HTMLInputElement, '9');
    expect(calls.at(-1)).toEqual({ floating: 9 });
    act(() => { (host.querySelector('[data-testid="transition-params-reset"]') as HTMLElement).click(); });
    expect(calls.at(-1)).toBeUndefined();

    params = undefined; render('glt-directional-wipe');
    setValue(host.querySelector('select[aria-label="Direction"]') as HTMLSelectElement, 'up');
    expect(calls.at(-1)).toEqual({ direction: [0, 1] });
    expect((host.querySelector('select[aria-label="Direction"]') as HTMLSelectElement).value).toBe('up');

    params = undefined; render('glt-pixelize'); // ivec2 + int
    expect(host.querySelector('input[aria-label="steps"]')).toBeTruthy();
    expect(host.querySelector('input[aria-label="squaresMin x"]')).toBeTruthy();
    setValue(host.querySelector('input[aria-label="steps"]') as HTMLInputElement, '7');
    expect(calls.at(-1)).toEqual({ steps: 7 });
    const boolEntry = GLT_CATALOG.find((e) => e.params.some((p) => p.type === 'bool'))!;
    const bp = boolEntry.params.find((p) => p.type === 'bool')!;
    params = undefined; render(boolEntry.id);
    act(() => { (host.querySelector(`input[type="checkbox"][aria-label="${bp.name}"]`) as HTMLInputElement).click(); });
    expect(calls.at(-1)).toEqual({ [bp.name]: !bp.default });

    const colorEntry = GLT_CATALOG.find((e) => e.params.some((p) => p.color && (p.type === 'vec4' || p.type === 'vec3')))!;
    const cp = colorEntry.params.find((p) => p.color)!;
    params = undefined; render(colorEntry.id);
    setValue(host.querySelector(`input[type="color"][aria-label="${cp.name}"]`) as HTMLInputElement, '#336699');
    const got = (calls.at(-1) as Record<string, number[]>)[cp.name];
    expect(got.slice(0, 3).map((x) => Math.round(x * 255))).toEqual([0x33, 0x66, 0x99]);
    expect(got.length).toBe((cp.default as number[]).length);

    act(() => root.unmount()); host.remove();
  });
  it('renders nothing for non-vendored ids and for shaders without parameters', () => {
    const none = GLT_CATALOG.find((e) => e.params.length === 0);
    const a = mount(<TransitionParams id="cross-dissolve" onChange={() => {}} />); expect(a.host.innerHTML).toBe(''); a.cleanup();
    if (none) { const b = mount(<TransitionParams id={none.id} onChange={() => {}} />); expect(b.host.innerHTML).toBe(''); b.cleanup(); }
  });
});
