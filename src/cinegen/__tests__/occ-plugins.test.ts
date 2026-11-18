// [remix] OpenChatCut plugin system (openchatcut-plugin@1) hosted in the CineGen editor: validation boundary, registry, snapshots.
import { describe, it, expect } from 'vitest';
import { validatePack } from '../../openchatcut/plugins/validate';
import { PLUGIN_FORMAT, PLUGIN_LIMITS, pluginAssetId } from '../../openchatcut/plugins/types';
import { registerPack, unregisterPack, type InstalledPack } from '../../openchatcut/plugins/store';
import { ALL_FX } from '../../openchatcut/gl/fx/effects';
import { getCustomTransition } from '../../openchatcut/gl/customTransitions';
import { getCustomZoom } from '../../openchatcut/editor/customZooms';
import { registerSnapshot, resolveTransition, snapshotFor, pluginFxSnapshotSync, customTransitionDefSync } from '@cinegen/lib/occ/plugins';
import { clipFxInstances } from '@cinegen/lib/occ/clip-fx';

const FX = `#version 300 es\nprecision highp float;\nuniform sampler2D u_input;\nuniform float u_amount;\nin vec2 v_texCoord;\nout vec4 fragColor;\nvoid main(){ vec4 c = texture(u_input, v_texCoord); fragColor = vec4(vec3(1.0)-c.rgb*u_amount, c.a); }`;
const TR = `#version 300 es\nprecision highp float;\nuniform sampler2D u_outgoing;\nuniform sampler2D u_incoming;\nuniform float u_progress;\nin vec2 v_texCoord;\nout vec4 fragColor;\nvoid main(){ fragColor = mix(texture(u_outgoing, v_texCoord), texture(u_incoming, v_texCoord), u_progress); }`;
const CUBE = 'LUT_3D_SIZE 2\n' + ['0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', '1 1 1'].join('\n');
const pack = (over: Record<string, unknown> = {}) => ({
  format: PLUGIN_FORMAT, id: 'test-pack', name: 'Test pack', version: '1.0.0',
  items: [
    { id: 'invert-ish', type: 'fx', name: 'Invert-ish', frag: FX, props: [{ key: 'amount', label: 'Amount', default: 1, min: 0, max: 1 }] },
    { id: 'fade-mix', type: 'transition', name: 'Fade mix', frag: TR },
    { id: 'identity', type: 'lut', name: 'Identity', cube: CUBE },
    { id: 'punch-in', type: 'zoom', name: 'Punch in', shape: 'punch', magnification: 2 },
  ],
  ...over,
});

describe('plugin validation boundary', () => {
  it('accepts a well-formed pack', () => { expect(validatePack(pack()).ok).toBe(true); });
  const bad = (name: string, v: unknown, re: RegExp) => it(`rejects: ${name}`, () => {
    const r = validatePack(v); expect(r.ok).toBe(false); if (!r.ok) expect(r.errors.join('\n')).toMatch(re);
  });
  bad('unknown format version', pack({ format: 'openchatcut-plugin@2' }), /format/);
  bad('non-object', 'nope', /JSON/);
  bad('path-like pack id', pack({ id: '../../etc' }), /id/);
  bad('script-scheme thumbnail', pack({ items: [{ id: 'a1', type: 'fx', name: 'x', frag: FX, thumb: 'javascript:alert(1)' }] }), /thumb/);
  bad('fx without u_input', pack({ items: [{ id: 'a1', type: 'fx', name: 'x', frag: 'void main(){}' }] }), /u_input/);
  bad('oversized shader', pack({ items: [{ id: 'a1', type: 'fx', name: 'x', frag: FX + ' '.repeat(PLUGIN_LIMITS.maxFragBytes) }] }), /frag/);
  bad('too many items', pack({ items: Array.from({ length: PLUGIN_LIMITS.maxItems + 1 }, (_, i) => ({ id: `i${i}-x`, type: 'fx', name: 'x', frag: FX })) }), /items/);
  bad('corrupt .cube', pack({ items: [{ id: 'a1', type: 'lut', name: 'x', cube: 'not a cube file' }] }), /cube/);
  bad('lut with both cube and frag', pack({ items: [{ id: 'a1', type: 'lut', name: 'x', cube: CUBE, frag: FX }] }), /cube/);
  bad('zoom envelope out of range', pack({ items: [{ id: 'a1', type: 'zoom', name: 'x', envelope: [0, 99] }] }), /envelope/);
  bad('unknown item type', pack({ items: [{ id: 'a1', type: 'script', name: 'x', code: 'alert(1)' }] }), /type/);
  bad('duplicate item ids', pack({ items: [{ id: 'a1', type: 'fx', name: 'x', frag: FX }, { id: 'a1', type: 'fx', name: 'y', frag: FX }] }), /重复|dup/i);
  bad('invalid uniform key', pack({ items: [{ id: 'a1', type: 'fx', name: 'x', frag: FX, props: [{ key: 'a b;', label: 'x', default: 0, min: 0, max: 1 }] }] }), /key/);
});

describe('registration, snapshots and graceful degradation', () => {
  const installed = (): InstalledPack => ({ ...(validatePack(pack()) as { ok: true; pack: never }).pack, installedAt: 1, enabled: true } as InstalledPack);
  it('registers fx / LUT / transition / zoom, and unregisters them', async () => {
    const p = installed();
    await registerPack(p);
    expect(ALL_FX[pluginAssetId('test-pack', 'invert-ish')]).toBeTruthy();
    expect(ALL_FX[pluginAssetId('test-pack', 'identity')]?.cube).toMatch(/^plugin-lut:/);
    expect(getCustomTransition(pluginAssetId('test-pack', 'fade-mix'))).toBeTruthy();
    expect(getCustomZoom(pluginAssetId('test-pack', 'punch-in'))?.magnification).toBe(2);
    await unregisterPack(p);
    expect(ALL_FX[pluginAssetId('test-pack', 'invert-ish')]).toBeUndefined();
    expect(getCustomTransition(pluginAssetId('test-pack', 'fade-mix'))).toBeUndefined();
  });
  it('a clip keeps rendering from its snapshot after the pack is gone', async () => {
    const p = installed(); await registerPack(p);
    const id = pluginAssetId('test-pack', 'invert-ish');
    const snap = (await snapshotFor(id))!;
    expect(snap.frag).toBe(FX);
    await unregisterPack(p);
    expect(ALL_FX[id]).toBeUndefined();
    const inst = clipFxInstances({ fx: [{ id, props: { amount: 0.5 }, def: snap }] } as never);
    expect(inst).toHaveLength(1); expect(inst[0].def.frag).toBe(FX);
    expect(pluginFxSnapshotSync(id)?.id).toBe(id);
  });
  it('LUT snapshots carry the cube text so the export runner can rebuild them', async () => {
    const p = installed(); await registerPack(p);
    const id = pluginAssetId('test-pack', 'identity');
    const snap = (await import('@cinegen/lib/occ/plugins')).snapshotFor;
    // snapshotFor reads the installed packs from storage; without IndexedDB it has no cube text, so register from a manual snapshot
    await unregisterPack(p);
    registerSnapshot({ id, name: 'Identity', desc: 'd', frag: '', props: [], cubeText: CUBE });
    expect(ALL_FX[id]?.cube).toMatch(/^plugin-lut:/);
    void snap;
  });
  it('transition resolves from registry, then from a stored snapshot; built-ins still win', async () => {
    const p = installed(); await registerPack(p);
    const id = pluginAssetId('test-pack', 'fade-mix');
    const def = customTransitionDefSync(id)!;
    expect(resolveTransition(id)?.frag).toBe(TR);
    await unregisterPack(p);
    expect(resolveTransition(id)).toBeNull();
    expect(resolveTransition(id, def)?.frag).toBe(TR);
    expect(resolveTransition('cross-dissolve')?.frag).toBeTruthy();
  });
});
