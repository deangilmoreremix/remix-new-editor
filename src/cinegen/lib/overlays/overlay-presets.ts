// [remix] My Presets: save the selected overlay (or every overlay at the playhead) and drop it on any timeline later.
// The preset shape and storage are the old editor's own (lib/editor/addons/overlayPresets.js, kept per browser in localStorage),
// so presets saved there show up here too. Only add-on overlays (Smart Text, Image, Stickers, Lower Thirds...) can be saved:
// forms and motion graphics keep their own templates.
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS preset storage and clip builder
import { presetToClips, loadPresets, savePresets } from '../../../lib/editor/addons/overlayPresets.js';
import { isRegistryOverlay } from '@cinegen/lib/overlays/overlays';

export interface OverlayPresetItem { type: string; addon: Record<string, unknown>; offset: number; duration: number; trackName?: string }
export interface OverlayPreset { id: string; name: string; createdAt: string; items: OverlayPresetItem[] }

export const listOverlayPresets = (): OverlayPreset[] => (loadPresets() as OverlayPreset[]).filter((p) => p && Array.isArray(p.items));

/** A preset from these overlays (times kept relative to the earliest one), or null when none of them can be saved. */
export function captureOverlayPreset(overlays: OverlayClip[], name: string): OverlayPreset | null {
  const usable = overlays.filter((o) => isRegistryOverlay(o.type));
  if (!usable.length) return null;
  const t0 = Math.min(...usable.map((o) => o.start));
  return {
    id: `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: (name.trim() || usable[0].name || 'Preset').slice(0, 60),
    createdAt: new Date().toISOString(),
    items: usable.map((o) => ({
      type: o.type,
      addon: JSON.parse(JSON.stringify((o.addon as object) ?? {})),
      offset: Math.round((o.start - t0) * 1000) / 1000,
      duration: Math.round((o.end - o.start) * 1000) / 1000,
      trackName: 'Text',
    })),
  };
}

export function saveOverlayPreset(preset: OverlayPreset): boolean {
  return savePresets([preset, ...listOverlayPresets()]);
}

export function deleteOverlayPreset(id: string): boolean {
  return savePresets(listOverlayPresets().filter((p) => p.id !== id));
}

/** The overlays a preset adds when dropped at `startSec` (new ids, so a preset can be applied again and again). */
export function presetOverlays(preset: OverlayPreset, startSec: number, timelineSeconds: number): OverlayClip[] {
  const base = Date.now();
  return (presetToClips(preset, startSec, timelineSeconds, base) as Array<Record<string, unknown>>)
    .filter((c) => isRegistryOverlay(String(c.type)))
    .map((c, i) => ({ ...c, id: `ov-${base.toString(36)}-${i}`, start: Number(c.start), end: Number(c.end), name: String(c.name ?? c.type) }) as unknown as OverlayClip);
}
