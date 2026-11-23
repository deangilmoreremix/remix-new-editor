// [remix] One-click personalized layouts (the classic editor's Overlays → Personalize): Logo + CTA end card, presenter intro, product
// spotlight, opening frame. Built from tokens (the plan comes from src/lib/personalization/timelineAssets.js), so every contact
// gets their own logo, photo and details. They use the contact being previewed.
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS contact store (localStorage)
import * as contactStore from '../../../lib/contactStore.js';
// @ts-expect-error plain JS layouts
import { PERSONALIZED_LAYOUTS, buildLayoutPlan, imageTokenOf } from '../../../lib/personalization/timelineAssets.js';
// @ts-expect-error plain JS per-contact helpers
import { contactName, listContactProfiles } from '../../../lib/editor/personalize/perContact.js';
// @ts-expect-error plain JS token schema
import { resolveToken } from '../../../components/personalize/tokenSchema.js';
import { createOverlay } from '@cinegen/lib/overlays/overlays';

export interface LayoutInfo { id: string; label: string; icon: string; description: string }
export const personalizedLayouts = (): LayoutInfo[] => [...(PERSONALIZED_LAYOUTS as LayoutInfo[])];

interface PlanItem { type: string; name: string; startSec: number; endSec: number; addon: Record<string, unknown> }
export interface LayoutResult { ok: boolean; message: string; overlays: OverlayClip[]; measureLogo: boolean }

/** The overlays a layout adds for the contact being previewed, or why it cannot be added yet. */
export function createLayoutOverlays(layoutId: string, startSec: number, timelineSeconds: number): LayoutResult {
  const layout = (PERSONALIZED_LAYOUTS as LayoutInfo[]).find((l) => l.id === layoutId);
  const none = (message: string): LayoutResult => ({ ok: false, message, overlays: [], measureLogo: false });
  if (!layout) return none('That layout does not exist.');
  const profile = contactStore.getActiveProfile();
  if (!profile) return none('Pick a contact in "Preview as" (above the video) first, or make one with the Personalization button. Layouts use that contact\'s logo, photo and details, and every contact gets their own.');
  const T = Math.max(1, timelineSeconds);
  const plan = buildLayoutPlan(layoutId, profile, { timelineSeconds: T, startSec }) as PlanItem[];
  if (!plan.length) return none(`${contactName(profile)} has no logo, CTA graphic or CTA text yet. Add them in the Personalize window's image finder.`);
  const overlays = plan.map((item) => {
    const base = createOverlay(item.type as never, item.startSec, T);
    return { ...base, name: item.name, start: item.startSec, end: item.endSec, addon: { ...(base.addon as object), ...item.addon } } as OverlayClip;
  });
  // contacts that have no picture for a layout's token yet (their slot shows the fallback or a placeholder)
  const missing = (listContactProfiles(contactStore) as unknown[]).filter((p) => plan.some((i) => {
    const key = imageTokenOf(i.addon?.src);
    return key && !resolveToken(p, key);
  })).length;
  return {
    ok: true, overlays, measureLogo: plan.some((i) => i.addon?.plate === 'auto'),
    message: `Added ${layout.label}${missing ? `. ${missing} contact${missing === 1 ? ' has' : 's have'} no image for it yet (use Check contacts in this window).` : '.'}`,
  };
}
