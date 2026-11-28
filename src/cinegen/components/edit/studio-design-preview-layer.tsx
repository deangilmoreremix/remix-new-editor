// [remix] Draws the Studio Design clips for real in the editor preview, under the labelled box that lets you move and resize them.
// One controls-less @remotion/player per design runs the same TimelineComposition as the published video and the MP4 export, with the
// previewed contact's details, and is seeked to the playhead (same pattern as the captions preview). Each design is stacked with the
// other overlays in the published paint order (`ranks`), so a design above an image overlay shows above it, and below one shows below.
import { useEffect, useMemo, useRef } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { OverlayClip } from '@cinegen/types/workspace';
import { TimelineComposition } from '../../../lib/editor/remotion/TimelineComposition.jsx';
import { studioDesignModel, STUDIO_DESIGN_TYPE, FPS } from '../../lib/overlays/studio-design-model';

type Model = NonNullable<ReturnType<typeof studioDesignModel>>;
function Comp({ model }: { model: Model }) { return <TimelineComposition model={model} />; }

interface Props {
  overlays: OverlayClip[];
  /** overlay id -> its place in the published paint order (see overlayPaintRanks) */
  ranks: Map<string, number>;
  /** designs that must stay under the sandboxed animations (see designsBelowSandbox) */
  below: Set<string>;
  /** 'inside': stacked with the overlays in their container (OverlayLayer's `behind` slot); 'below': under the animation frame */
  mode: 'inside' | 'below';
  profile?: Record<string, unknown> | null;
  profileVersion?: number;
  currentTime: number;
  timelineSeconds: number;
  aspect?: string;
}

function DesignPlayer({ overlay, rank, profile, profileVersion, currentTime, timelineSeconds, aspect }: Omit<Props, 'overlays' | 'ranks' | 'below' | 'mode'> & { overlay: OverlayClip; rank: number }) {
  const ref = useRef<PlayerRef>(null);
  const model = useMemo(
    () => studioDesignModel([overlay as never], profile ?? null, timelineSeconds, aspect),
    // profileVersion: the contact's data changed even though the profile object is the same
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlay, profile, profileVersion, timelineSeconds, aspect],
  );
  useEffect(() => { ref.current?.seekTo(Math.max(0, Math.round(currentTime * FPS))); }, [currentTime, model]);
  const props = useMemo(() => ({ model: model as Model }), [model]);
  if (!model) return null;
  return (
    // z-index rank + 1: the DOM overlays in the same container use the same scale (see overlay-layer.tsx)
    <div style={{ position: 'absolute', inset: 0, zIndex: rank + 1, pointerEvents: 'none' }} data-design-id={String(overlay.id)}>
      <Player ref={ref} component={Comp} inputProps={props} durationInFrames={Math.max(1, model.durationInFrames)} fps={FPS}
        compositionWidth={model.width} compositionHeight={model.height} controls={false} clickToPlay={false}
        style={{ width: '100%', height: '100%', background: 'transparent' }} acknowledgeRemotionLicense />
    </div>
  );
}

/** 'inside' is mounted in the overlay container so its players share that container's stacking context; 'below' sits under the animation frame. */
export function StudioDesignPreviewLayer({ overlays, ranks, below, mode, ...rest }: Props) {
  const designs = overlays.filter((o) => o.type === STUDIO_DESIGN_TYPE && below.has(String(o.id)) === (mode === 'below'));
  if (!designs.length) return null;
  const players = designs.map((o) => <DesignPlayer key={String(o.id)} overlay={o} rank={ranks.get(String(o.id)) ?? 0} {...rest} />);
  if (mode === 'below') {
    // z-index 3: its own stacking context under the animation frame (4) and the overlay container (5)
    return <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }} data-testid="studio-design-preview-below">{players}</div>;
  }
  return (
    <div data-studio-design-preview style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} data-testid="studio-design-preview">
      {players}
    </div>
  );
}
