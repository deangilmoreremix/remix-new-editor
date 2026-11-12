// [remix] Pure helpers for the Leads-tab asset picker: which image slots the video needs, what each
// asset's state is, and how an assignment becomes contact-profile variables. The master project keeps
// unresolved {{tokens}}; assets only ever travel in the profile / recipient variables.
// @ts-expect-error plain JS
import { imageSlotsInProject } from '../../../lib/personalization/imageReadiness.js';
// @ts-expect-error plain JS
import { assignmentsToVariables, isDurableUrl } from '../../../lib/personalization/businessAssetStore.js';

export interface SlotInfo { slot: string; label: string; hasFallback: boolean; clipCount: number }
export interface LibAsset { id: string; category: string; origin: string; state: string; storage_url: string; thumb_url?: string | null; meta?: { name?: string | null } }
export interface LibAssignment { slot: string; asset_id: string | null; manual: boolean }
export type AssetState = 'discovered' | 'imported' | 'assigned' | 'used';

/** Image slots (canonical token keys, e.g. logoUrl) used by Personalized Image overlays, one entry per slot. */
export function slotsForOverlays(overlays: Array<Record<string, unknown>>): SlotInfo[] {
  const found = imageSlotsInProject({ tracks: [{ items: overlays }] }) as Array<{ key: string; label: string; hasFallback: boolean }>;
  const bySlot = new Map<string, SlotInfo>();
  for (const f of found) {
    const cur = bySlot.get(f.key);
    if (cur) { cur.clipCount += 1; cur.hasFallback = cur.hasFallback && f.hasFallback; }
    else bySlot.set(f.key, { slot: f.key, label: f.label, hasFallback: f.hasFallback, clipCount: 1 });
  }
  return [...bySlot.values()];
}

/**
 * Display state. "Used" only when a PUBLISHED recipient link carries this URL - being discovered, imported or
 * even assigned in the editor does not mean it is in a published video.
 */
export function assetState(asset: LibAsset, assignedIds: Set<string>, usedUrls: Set<string>): AssetState {
  if (usedUrls.has(asset.storage_url)) return 'used';
  if (assignedIds.has(asset.id) || asset.state === 'assigned') return 'assigned';
  return asset.state === 'discovered' ? 'discovered' : 'imported';
}

export type AssignDecision = { ok: true } | { ok: false; reason: 'manual'; slot: string };

/** An automatic assignment never replaces a manual one: the UI must ask first. */
export function canAutoAssign(assignments: LibAssignment[], slot: string, assetId: string | null): AssignDecision {
  const cur = assignments.find((a) => a.slot === slot);
  return cur?.manual && cur.asset_id !== assetId ? { ok: false, reason: 'manual', slot } : { ok: true };
}

/** slot -> durable URL, for the contact profile (and, later, recipient variables). Non-durable URLs are dropped. */
export const variablesFromAssignments = (assignments: LibAssignment[], assets: LibAsset[]): Record<string, string> =>
  assignmentsToVariables(assignments, assets) as Record<string, string>;

/** Merge asset variables into a profile without touching its other variables (variables is not a deep-merged key). */
export function profilePatch(profile: { variables?: Record<string, unknown> } | null, vars: Record<string, string>, clearSlots: string[] = []) {
  const next = { ...(profile?.variables ?? {}) } as Record<string, unknown>;
  for (const s of clearSlots) delete next[s];
  for (const [k, v] of Object.entries(vars)) if (isDurableUrl(v)) next[k] = v;
  return { variables: next };
}

/** What the picker says about a slot with nothing in it. */
export function slotStatus(slot: SlotInfo, assignments: LibAssignment[], assets: LibAsset[]): 'filled' | 'fallback' | 'missing' {
  const a = assignments.find((x) => x.slot === slot.slot && x.asset_id);
  if (a && assets.some((s) => s.id === a.asset_id)) return 'filled';
  return slot.hasFallback ? 'fallback' : 'missing';
}

export const businessFromProfile = (p: { name?: string; contact?: { company?: string }; personalization?: { business?: { businessName?: string; website?: string; phone?: string } }; variables?: Record<string, string> } | null) => {
  const b = p?.personalization?.business;
  const name = String(b?.businessName || p?.variables?.businessName || p?.variables?.company || p?.contact?.company || p?.name || '').trim();
  const website = String(b?.website || p?.variables?.website || '').trim();
  return name || website ? { name: name || website, website: website || undefined, phone: b?.phone || p?.variables?.businessPhone || undefined } : null;
};
