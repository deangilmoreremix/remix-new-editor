/**
 * Motion Studio Personalization Adapter
 *
 * Bridges the shared Personalization context (`useDemoPersonalize`) and the
 * Motion Studio `ProjectData` so the entry screen can produce a typed,
 * brand-aware project without re-implementing the Personalization modal or
 * reaching into the provider's internals.
 *
 * This file does NOT touch the Personalization provider and does NOT open a
 * new Personalization modal — it only reads what is already there and maps it
 * onto Motion Studio shapes.
 */

import { useMemo } from 'react';
import { useDemoPersonalize } from '../../shared/personalization/DemoPersonalizeProvider';
import type { ClientProfile, AssetLibrary, PersonalizationAsset } from '../../shared/personalization/types';
import type { ProjectData } from './types';
import type { PersonalizationPerson } from './projectContract';

/**
 * Input contract for the adapter: the only slice of the Personalization
 * context the adapter needs to build a `PersonalizationPerson`. Decoupling
 * the type from the full context makes the adapter easy to unit-test (pass
 * a literal) and keeps the call site explicit about which fields it reads.
 */
export type PersonalizationAdapter = {
  clients: ClientProfile[];
  selectedClientId: string;
  assets: AssetLibrary;
};

/** Extract a durable URL from a Personalization asset, falling back to undefined. */
const assetUrl = (asset: PersonalizationAsset | null | undefined): string | undefined => {
  if (!asset) return undefined;
  // Prefer the durable uploaded URL; fall back to whatever the asset is
  // currently rendering with.
  const url = asset.uploadedUrl || asset.url;
  if (!url) return undefined;
  // Skip blob: URLs (transient preview URLs) — they only live for the
  // current session and cannot be used by a downstream renderer.
  if (typeof url === 'string' && url.startsWith('blob:')) return undefined;
  return url;
};

/**
 * Map a Personalization adapter input onto a Motion Studio
 * `PersonalizationPerson`. Returns `null` when no brand context is selected,
 * matching the contract "handles missing assets gracefully".
 */
export const buildPersonalizationPerson = (
  input: PersonalizationAdapter,
): PersonalizationPerson | null => {
  const activeClient =
    input.clients.find((c) => c.id === input.selectedClientId) ?? null;

  // No selected client → no brand context to surface.
  if (!activeClient) return null;

  const assets = input.assets;
  const mainLogo = assets.logos?.[0];
  const mainLogoUrl = assetUrl(mainLogo);

  // Build a logos record only when we actually have at least one usable URL.
  const logos: PersonalizationPerson['logos'] | undefined = mainLogoUrl
    ? { main: mainLogoUrl }
    : undefined;

  // Identities, products and brand references all live in the asset library
  // — surface their URLs so downstream renderers can pre-load them.
  const identities = (assets.identities ?? [])
    .map(assetUrl)
    .filter((u): u is string => Boolean(u));
  const products = (assets.products ?? [])
    .map((p) => {
      const url = assetUrl(p);
      if (!url) return undefined;
      return { name: p.name, images: [url] };
    })
    .filter(
      (p): p is { name: string; images: string[] } => Boolean(p),
    );
  const brandReferences = (assets.brandReferences ?? [])
    .map(assetUrl)
    .filter((u): u is string => Boolean(u));

  const firstFrame = assetUrl(assets.firstFrame);
  const lastFrame = assetUrl(assets.lastFrame);

  const person: PersonalizationPerson = {};
  if (activeClient.businessName) person.businessName = activeClient.businessName;
  if (logos) person.logos = logos;
  if (identities.length > 0) person.identities = identities;
  if (products.length > 0) person.products = products;
  if (brandReferences.length > 0) person.brandReferences = brandReferences;
  if (firstFrame) person.firstFrame = firstFrame;
  if (lastFrame) person.lastFrame = lastFrame;
  if (activeClient.brandDescription) person.notes = activeClient.brandDescription;

  return Object.keys(person).length > 0 ? person : null;
};

/**
 * Hook: read the current Personalization context and return a typed
 * `PersonalizationPerson | null`. Re-derives only when the relevant slice of
 * the context changes, so re-renders are cheap.
 */
export const usePersonalizationPerson = (): PersonalizationPerson | null => {
  const { clients, selectedClientId, assets } = useDemoPersonalize();
  return useMemo(
    () => buildPersonalizationPerson({ clients, selectedClientId, assets }),
    [clients, selectedClientId, assets],
  );
};

/**
 * Inject brand data from a `PersonalizationPerson` into a `ProjectData`.
 * Returns a NEW project — never mutates the input.
 *
 * Injection points (in order of preference):
 *  - `person.brandColors` → `project.themeColors` (only defined keys)
 *  - `person.brandColors.background` → `project.background` (when supplied)
 *  - `person.businessName` → prefix on `project.name`
 *  - `person.firstFrame` / `person.lastFrame` → attached to the first clip's
 *    `props` (so a downstream renderer can pick them up without expanding the
 *    `ProjectData` contract)
 *
 * A `null` person is a no-op: the project is returned unchanged.
 */
export const applyPersonalizationToProject = (
  project: ProjectData,
  person: PersonalizationPerson | null | undefined,
): ProjectData => {
  if (!person) return project;

  const next: ProjectData = { ...project };

  // 1. Brand colors → theme palette + stage background
  if (person.brandColors) {
    const themeColors: Record<string, string> = { ...(next.themeColors ?? {}) };
    if (person.brandColors.primary) themeColors.primary = person.brandColors.primary;
    if (person.brandColors.secondary) themeColors.secondary = person.brandColors.secondary;
    if (person.brandColors.accent) themeColors.accent = person.brandColors.accent;
    if (person.brandColors.background) {
      themeColors.background = person.brandColors.background;
      // Also drive the stage background so previews pick the brand colour up
      // even before any clip paints over it.
      next.background = person.brandColors.background;
    }
    if (Object.keys(themeColors).length > 0) {
      next.themeColors = themeColors;
    }
  }

  // 2. Business name → project name (preserve the original suffix)
  if (person.businessName) {
    const separator = next.name ? ' — ' : '';
    next.name = `${person.businessName}${separator}${next.name ?? ''}`.trim();
  }

  // 3. First / last frame references → first clip's props
  const hasFirst = Boolean(person.firstFrame);
  const hasLast = Boolean(person.lastFrame);
  if ((hasFirst || hasLast) && next.tracks.length > 0) {
    const firstTrack = next.tracks[0];
    const updatedClips = firstTrack.clips.map((clip, index) => {
      if (index !== 0) return clip;
      return {
        ...clip,
        props: {
          ...(clip.props ?? {}),
          ...(hasFirst ? { firstFrame: person.firstFrame } : {}),
          ...(hasLast ? { lastFrame: person.lastFrame } : {}),
        },
      };
    });
    next.tracks = [
      { ...firstTrack, clips: updatedClips },
      ...next.tracks.slice(1),
    ];
  }

  return next;
};
