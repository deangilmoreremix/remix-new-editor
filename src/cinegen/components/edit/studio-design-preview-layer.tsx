// [remix] Draws the Studio Design clips for real in the editor preview, under the labelled box that lets you move and resize them.
// A controls-less @remotion/player runs the same TimelineComposition as the published video and the MP4 export, with the previewed
// contact's details, and is seeked to the playhead (same pattern as the captions preview).
import { useEffect, useMemo, useRef } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { OverlayClip } from '@cinegen/types/workspace';
import { TimelineComposition } from '../../../lib/editor/remotion/TimelineComposition.jsx';
import { studioDesignModel, hasStudioDesign, FPS } from '../../lib/overlays/studio-design-model';

type Model = NonNullable<ReturnType<typeof studioDesignModel>>;
function Comp({ model }: { model: Model }) { return <TimelineComposition model={model} />; }

interface Props { overlays: OverlayClip[]; profile?: Record<string, unknown> | null; profileVersion?: number; currentTime: number; timelineSeconds: number; aspect?: string }

export function StudioDesignPreviewLayer({ overlays, profile = null, profileVersion = 0, currentTime, timelineSeconds, aspect = '16:9' }: Props) {
  const ref = useRef<PlayerRef>(null);
  const model = useMemo(
    () => (hasStudioDesign(overlays) ? studioDesignModel(overlays as never, profile, timelineSeconds, aspect) : null),
    // profileVersion: the contact's data changed even though the profile object is the same
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlays, profile, profileVersion, timelineSeconds, aspect],
  );
  useEffect(() => { ref.current?.seekTo(Math.max(0, Math.round(currentTime * FPS))); }, [currentTime, model]);
  const props = useMemo(() => ({ model: model as Model }), [model]);
  if (!model) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} data-testid="studio-design-preview">
      <Player ref={ref} component={Comp} inputProps={props} durationInFrames={Math.max(1, model.durationInFrames)} fps={FPS}
        compositionWidth={model.width} compositionHeight={model.height} controls={false} clickToPlay={false}
        style={{ width: '100%', height: '100%', background: 'transparent' }} acknowledgeRemotionLicense />
    </div>
  );
}
