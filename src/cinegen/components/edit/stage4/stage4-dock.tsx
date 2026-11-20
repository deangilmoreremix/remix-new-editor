// [remix] Stage 4 entry point: a floating "Media tools" button on the CineGen timeline page (bottom right) that opens a panel with
// Audio (master volume, meters, EQ), Scenes (scene browser) and Media health (capabilities, relink, proxies, jobs).
import { useCallback, useState } from 'react';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';
import type { PlaybackEngine, PlaybackProxyMode } from '@cinegen/lib/editor/playback-engine';
import { AudioPanel } from './audio-panel';
import { ScenesPanel } from './scenes-panel';
import { MediaHealth } from './media-health';
import { LocalAiPanel } from './local-ai-panel';
import { S } from './ui';

type Dispatch = (a: { type: 'SET_TIMELINE'; timelineId: string; timeline: Timeline } | { type: 'UPDATE_ASSET'; asset: Partial<Asset> & { id: string } } | { type: 'ADD_ASSET'; asset: Asset }) => void;
export interface Stage4Props {
  engine: PlaybackEngine; timeline: Timeline; dispatch: Dispatch; assets: Asset[]; selectedClipIds: Set<string>; currentTime: number;
  seek: (t: number) => void; isPlaying: boolean; proxyMode: PlaybackProxyMode; setProxyMode: (m: PlaybackProxyMode) => void;
}

export function Stage4Dock(p: Stage4Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'audio' | 'scenes' | 'health' | 'ai'>('audio');
  const commit = useCallback((t: Timeline) => p.dispatch({ type: 'SET_TIMELINE', timelineId: p.timeline.id, timeline: t }), [p]);
  return (
    <div data-testid="stage4-dock" style={{ position: 'relative', flex: '0 0 auto', zIndex: 41, color: '#eee', fontSize: 11 }}>
      {open && (
        <div role="dialog" aria-label="Media tools" style={{ position: 'fixed', right: 12, bottom: 40, zIndex: 60, width: 440, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 180px)', overflow: 'auto', background: 'rgba(20,20,24,0.97)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: 10 }}>
          <div style={S.row}>
            {(['audio', 'scenes', 'health', 'ai'] as const).map((t) => <button key={t} data-testid={`s4-tab-${t}`} style={tab === t ? S.btnOn : S.btn} onClick={() => setTab(t)}>{t === 'audio' ? 'Audio' : t === 'scenes' ? 'Scenes' : t === 'ai' ? 'Local AI' : 'Media health'}</button>)}
            <span style={{ flex: 1 }} /><button style={S.btn} aria-label="Close media tools" onClick={() => setOpen(false)}>×</button>
          </div>
          {tab === 'audio' && <AudioPanel timeline={p.timeline} selectedClipIds={p.selectedClipIds} engine={p.engine} isPlaying={p.isPlaying} commit={commit} currentTime={p.currentTime} addAsset={(a) => p.dispatch({ type: 'ADD_ASSET', asset: a })} />}
          {tab === 'scenes' && <ScenesPanel assets={p.assets} timeline={p.timeline} currentTime={p.currentTime} commit={commit} seek={p.seek} />}
          {tab === 'ai' && <LocalAiPanel />}
          {tab === 'health' && <MediaHealth assets={p.assets} isPlaying={p.isPlaying} proxyMode={p.proxyMode} setProxyMode={p.setProxyMode} updateAsset={(a) => p.dispatch({ type: 'UPDATE_ASSET', asset: a })} />}
        </div>
      )}
      <button data-testid="s4-open" style={{ ...S.btn, background: 'rgba(20,20,24,0.92)' }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>Media tools</button>
    </div>
  );
}
