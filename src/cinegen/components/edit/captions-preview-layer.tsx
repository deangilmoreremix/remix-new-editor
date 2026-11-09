// [remix] Preview of OpenChatCut captions over the viewer. Their CaptionsLayer is a Remotion component, so it is mounted in a
// controls-less @remotion/player and seeked to the playhead; the export renders the very same component.
import { useEffect, useMemo, useRef } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { CaptionsData } from '../../../openchatcut/captions/types';
import { CaptionsLayer } from '../../../openchatcut/captions/CaptionsLayer';
import { CAPTION_STYLE_BY_ID } from '../../../openchatcut/captions/styles';
import { registerGoogleFonts } from '../../../lib/editor/remotion/TimelineComposition.jsx';

const FPS = 30;
function Comp({ captions }: { captions: CaptionsData }) { return <CaptionsLayer captions={captions} items={[]} />; }

export function CaptionsPreviewLayer({ captions, currentTime, aspect }: { captions: CaptionsData | null; currentTime: number; aspect: number }) {
  const ref = useRef<PlayerRef>(null);
  const font = captions ? CAPTION_STYLE_BY_ID[captions.template]?.fontFamily : undefined;
  useEffect(() => { if (font) void (registerGoogleFonts as (f: string[]) => Promise<unknown>)([font]); }, [font]);
  useEffect(() => { ref.current?.seekTo(Math.max(0, Math.round(currentTime * FPS))); }, [currentTime, captions]);
  const props = useMemo(() => ({ captions: captions as CaptionsData }), [captions]);
  if (!captions?.enabled) return null;
  const h = 720; const w = Math.round(h * (aspect || 16 / 9));
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} data-testid="captions-preview">
      <Player ref={ref} component={Comp} inputProps={props} durationInFrames={FPS * 60 * 60} fps={FPS} compositionWidth={w} compositionHeight={h}
        controls={false} clickToPlay={false} style={{ width: '100%', height: '100%', background: 'transparent' }} acknowledgeRemotionLicense />
    </div>
  );
}
