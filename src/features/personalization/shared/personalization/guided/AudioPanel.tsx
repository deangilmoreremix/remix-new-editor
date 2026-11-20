import { useEffect, useRef, useState } from 'react';
import { Music, Mic, Trash2, Volume2 } from 'lucide-react';
import { useDemoPersonalize } from '../DemoPersonalizeProvider';
import { Tip } from './editor/Tip';
import { loadWaveform, type WaveformData } from './editor/waveform';
import { AUDIO_ACCEPT_ATTRIBUTE, validateAudioFile } from './audioTrack';
import { C, chipStyle, hintStyle, inputStyle, labelStyle, panelStyle, secondaryButtonStyle } from './tokens';
import { MAX_AUDIO_TRACKS, SOLO_VIDEO, type AudioTrack, type AudioTrackKind } from '../preview/audioMix';

/**
 * Audio mix (Step 4): the video's own sound and any number of tracks (music, voiceover) with volume, fades, start, trim, mute and
 * solo. A track's waveform sits on a strip the width of the video, so its start and length are visible; the same numbers drive
 * the live preview and the exported video. Uploading is free and uses no credits.
 */
export function AudioPanel(): React.JSX.Element {
  const { previewSettings, updatePreviewComposition, addAudioTrack, removeAudioTrack } = useDemoPersonalize();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickKind, setPickKind] = useState<AudioTrackKind>('music');
  const fileRef = useRef<HTMLInputElement>(null);
  const tracks = previewSettings.audioTracks ?? [];
  const videoVolume = previewSettings.videoVolume ?? 1;
  const solo = previewSettings.audioSolo;
  const durationSec = previewSettings.durationInFrames / Math.max(1, previewSettings.fps);

  const setTrack = (id: string, patch: Partial<AudioTrack>) =>
    updatePreviewComposition({ audioTracks: tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const toggleSolo = (id: string) => updatePreviewComposition({ audioSolo: solo === id ? undefined : id });

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const problem = validateAudioFile(file);
    if (problem) { setError(problem); return; }
    setError(null);
    void addAudioTrack(file, pickKind);
  };

  const num = (id: string, label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void) => (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 9, color: C.muted2 }}>
      {label}
      <input id={id} data-testid={id} type="number" aria-label={label} min={min} max={max} step={step} value={Math.round(value * 100) / 100} onChange={(e) => { if (e.target.value.trim() !== '') onChange(Math.min(max, Math.max(min, Number(e.target.value)))); }} style={{ ...inputStyle, minHeight: 26, padding: '0 6px', fontSize: 11 }} />
    </label>
  );

  return (
    <div data-testid="audio-panel" style={{ ...panelStyle, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Volume2 size={14} color={C.cyan} aria-hidden />
        <button type="button" data-testid="audio-toggle-panel" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', flex: 1, textAlign: 'left' }}>
          Audio mix {tracks.length ? `· ${tracks.length} track${tracks.length > 1 ? 's' : ''}` : ''}
        </button>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Tip id="audioVideoSound" side="top"><div style={labelStyle}>Video sound</div></Tip>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input data-testid="audio-video-volume" type="range" aria-label="Video sound volume" min={0} max={1} step={0.01} value={videoVolume} onChange={(e) => updatePreviewComposition({ videoVolume: Number(e.target.value) })} style={{ flex: 1, accentColor: C.cyan }} />
              <button type="button" data-testid="audio-video-mute" aria-pressed={previewSettings.videoMuted === true} onClick={() => updatePreviewComposition({ videoMuted: !previewSettings.videoMuted })} style={{ ...chipStyle(previewSettings.videoMuted === true), minHeight: 26, fontSize: 10 }}>Mute</button>
              <button type="button" data-testid="audio-video-solo" aria-pressed={solo === SOLO_VIDEO} onClick={() => toggleSolo(SOLO_VIDEO)} style={{ ...chipStyle(solo === SOLO_VIDEO), minHeight: 26, fontSize: 10 }}>Solo</button>
            </div>
          </div>

          {tracks.map((t) => (
            <div key={t.id} data-testid="audio-track" data-track-id={t.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.kind === 'voiceover' ? <Mic size={12} aria-hidden /> : <Music size={12} aria-hidden />}
                <span style={{ color: C.text, fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={t.name}>{t.name}</span>
                <button type="button" data-testid="audio-track-mute" aria-pressed={t.muted} onClick={() => setTrack(t.id, { muted: !t.muted })} style={{ ...chipStyle(t.muted), minHeight: 24, fontSize: 10 }}>Mute</button>
                <button type="button" data-testid="audio-track-solo" aria-pressed={solo === t.id} onClick={() => toggleSolo(t.id)} style={{ ...chipStyle(solo === t.id), minHeight: 24, fontSize: 10 }}>Solo</button>
                <button type="button" data-testid="audio-track-delete" aria-label={`Remove ${t.name}`} onClick={() => removeAudioTrack(t.id)} style={{ ...secondaryButtonStyle, minHeight: 24, width: 28, padding: 0, display: 'grid', placeItems: 'center' }}><Trash2 size={12} aria-hidden /></button>
              </div>
              <WaveStrip track={t} videoDurationSec={durationSec} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, color: C.muted2 }}>Volume</span>
                <input data-testid="audio-track-volume" type="range" aria-label={`${t.name} volume`} min={0} max={1} step={0.01} value={t.volume} onChange={(e) => setTrack(t.id, { volume: Number(e.target.value) })} style={{ flex: 1, accentColor: C.cyan }} />
                <select data-testid="audio-track-kind" aria-label={`${t.name} type`} value={t.kind} onChange={(e) => setTrack(t.id, { kind: e.target.value as AudioTrackKind })} style={{ ...inputStyle, minHeight: 24, width: 'auto', fontSize: 10 }}>
                  <option value="music">Music</option>
                  <option value="voiceover">Voiceover</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                <label htmlFor={`audio-length-${t.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 9, color: C.muted2 }}>
                  Play for (s)
                  <input id={`audio-length-${t.id}`} data-testid={`audio-length-${t.id}`} type="number" aria-label="Play for seconds (empty means until the end)" min={0.1} step={0.1} placeholder="to end"
                    value={t.length === undefined ? '' : Math.round(t.length * 100) / 100}
                    onChange={(e) => setTrack(t.id, { length: e.target.value.trim() === '' ? undefined : Math.max(0.1, Number(e.target.value)) })}
                    style={{ ...inputStyle, minHeight: 26, padding: '0 6px', fontSize: 11 }} />
                </label>
                {num(`audio-start-${t.id}`, 'Start (s)', t.start, 0, Math.max(0, durationSec - 0.1), 0.1, (v) => setTrack(t.id, { start: v }))}
                {num(`audio-trim-${t.id}`, 'Skip (s)', t.trimStart, 0, 3600, 0.1, (v) => setTrack(t.id, { trimStart: v }))}
                {num(`audio-fadein-${t.id}`, 'Fade in (s)', t.fadeIn, 0, 30, 0.1, (v) => setTrack(t.id, { fadeIn: v }))}
                {num(`audio-fadeout-${t.id}`, 'Fade out (s)', t.fadeOut, 0, 30, 0.1, (v) => setTrack(t.id, { fadeOut: v }))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['music', 'voiceover'] as const).map((kind) => (
              <Tip key={kind} id="audioAdd" side="top">
                <button
                  type="button"
                  data-testid={`audio-add-${kind}`}
                  disabled={tracks.length >= MAX_AUDIO_TRACKS}
                  onClick={() => { setPickKind(kind); fileRef.current?.click(); }}
                  style={{ ...secondaryButtonStyle, minHeight: 30, fontSize: 11, padding: '0 12px', borderColor: C.cyan, color: C.cyan }}
                >
                  {kind === 'music' ? 'Add music' : 'Add voiceover'}
                </button>
              </Tip>
            ))}
            <input ref={fileRef} type="file" hidden data-testid="audio-file" accept={AUDIO_ACCEPT_ATTRIBUTE} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {error && <div role="alert" data-testid="audio-error" style={{ color: '#fca5a5', fontSize: 11 }}>{error}</div>}
          <p style={{ ...hintStyle, margin: 0 }}>Free, no credits. MP3, M4A, WAV, OGG or AAC, up to 25 MB each. Your original video's sound is never changed.</p>
        </div>
      )}
    </div>
  );
}

/** A waveform drawn on a strip as wide as the video, positioned and sized by the track's start, skip and length. */
function WaveStrip({ track, videoDurationSec }: { track: AudioTrack; videoDurationSec: number }) {
  const [wave, setWave] = useState<WaveformData | null>(null);
  useEffect(() => {
    let live = true;
    void loadWaveform(track.url).then((w) => { if (live) setWave(w); });
    return () => { live = false; };
  }, [track.url]);
  const total = Math.max(0.1, videoDurationSec);
  const fileLeft = wave ? Math.max(0, wave.durationSec - track.trimStart) : 0;
  const playSec = track.length !== undefined ? Math.min(track.length, fileLeft || track.length) : Math.min(fileLeft || total, total - track.start);
  const leftPct = (track.start / total) * 100;
  const widthPct = Math.max(1, Math.min(100 - leftPct, (playSec / total) * 100));
  return (
    <div data-testid="audio-wave-strip" aria-hidden style={{ position: 'relative', height: 28, background: 'rgba(255,255,255,.04)', borderRadius: 6, overflow: 'hidden' }}>
      <div data-testid="audio-wave-bar" style={{ position: 'absolute', top: 0, bottom: 0, left: `${leftPct}%`, width: `${widthPct}%`, background: track.muted ? 'rgba(255,255,255,.08)' : C.cyanSoft, border: `1px solid ${C.cyan}`, borderRadius: 4, boxSizing: 'border-box', overflow: 'hidden' }}>
        {wave && (
          <svg viewBox={`0 0 ${wave.peaks.length} 2`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            {wave.peaks.map((p, i) => <rect key={i} x={i} y={1 - p} width={0.7} height={Math.max(0.04, p * 2)} fill={C.cyan} opacity={0.8} />)}
          </svg>
        )}
      </div>
    </div>
  );
}
