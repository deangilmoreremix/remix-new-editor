// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { CARDS } from '../cards/registry';
import { DRAG_MIME, readDragPayload, setDragPayload } from '../dnd';
import { useStore } from '../store';
import { createProjectFromEntry } from '../projectContract';
import { MOTION_TEMPLATES, motionCardId } from '../../../data/motionRecipeCatalog';

const SHOT = MOTION_TEMPLATES.find((t) => t.componentName === 'CrashImpactReal')!;
/** A shot the demo project does not already contain (so the assertion is on
 *  the clip we just inserted, not on a pre-existing one). */
const FRESH_SHOT = MOTION_TEMPLATES.find((t) => t.componentName === 'WireframeDrawOn')!;

/**
 * Library → timeline was a dead end: `setDragPayload` was never called, so
 * `Timeline`'s onDrop could never fire and no card could reach the track.
 */
describe('library → timeline path', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes a drag payload the timeline can read back', () => {
    const store = new Map<string, string>();
    const dataTransfer = {
      setData: (mime: string, value: string) => store.set(mime, value),
      getData: (mime: string) => store.get(mime) ?? '',
      effectAllowed: 'copy',
      dropEffect: 'copy',
    };

    setDragPayload(
      { dataTransfer } as unknown as React.DragEvent,
      { cardId: motionCardId(SHOT), duration: SHOT.durationInFrames },
    );

    const payload = readDragPayload({
      dataTransfer,
    } as unknown as React.DragEvent);
    expect(payload?.cardId).toBe('demo:CrashImpactReal');
    expect(payload?.duration).toBe(SHOT.durationInFrames);
    expect(store.has(DRAG_MIME)).toBe(true);
    // The timeline drops the payload into the store verbatim — it must be a
    // registered card, otherwise addClip silently does nothing.
    expect(CARDS[payload!.cardId]).toBeTruthy();
  });

  it('adds the shot to a track and enables undo', () => {
    const before = useStore.getState();
    const trackId = before.project.tracks[before.project.tracks.length - 1].id;
    const pastBefore = before.past.length;

    before.addClip(motionCardId(FRESH_SHOT), trackId, 42);

    const after = useStore.getState();
    const clip = after.project.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.cardId === motionCardId(FRESH_SHOT));
    expect(clip).toBeTruthy();
    expect(clip!.start).toBe(42);
    expect(clip!.duration).toBeGreaterThan(0);
    // Undo became available (one snapshot pushed).
    expect(after.past.length).toBe(pastBefore + 1);
    // The clip renders: the composition skips unknown card ids.
    expect(CARDS[clip!.cardId]).toBeTruthy();
  });
});

describe('entry page → composition', () => {
  it('maps a catalog recipe id onto a registered card', () => {
    const project = createProjectFromEntry({
      description: 'a punchy open',
      aspectRatio: '16:9',
      duration: 4,
      recipeId: SHOT.id,
    });
    const clip = project.tracks.flatMap((t) => t.clips)[0];
    expect(clip.cardId).toBe('demo:CrashImpactReal');
    expect(CARDS[clip.cardId]).toBeTruthy();
    expect(CARDS[clip.cardId].component).toBeTruthy();
  });

  it('accepts a grouped card id and a component name', () => {
    for (const id of ['camera/crash-zoom-punch', 'CrashImpactReal']) {
      const project = createProjectFromEntry({
        description: 'x',
        aspectRatio: '9:16',
        duration: 3,
        recipeId: id,
      });
      const clip = project.tracks.flatMap((t) => t.clips)[0];
      expect(CARDS[clip.cardId]).toBeTruthy();
    }
  });

  it('leaves the track empty when no recipe was chosen', () => {
    const project = createProjectFromEntry({
      description: 'x',
      aspectRatio: '1:1',
      duration: 3,
    });
    expect(project.tracks.flatMap((t) => t.clips)).toEqual([]);
  });
});
