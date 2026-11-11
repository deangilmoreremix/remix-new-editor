// [remix] Sound-effects library (OpenChatCut's registry, names, groups and waveforms) inside the Edit tab.
import { useMemo, useRef, useState } from 'react';
import { SOUND_GROUPS, SOUND_GROUP_TONE, formatSoundDuration, peaksToPath, resamplePeaks, type SoundEffect } from '../../../openchatcut/audio/soundLibrary';
import { availableSounds, missingSoundCount, soundEffectSrc } from '@cinegen/lib/occ/sound-library';

export function SoundLibraryPopup({ onClose, onAdd }: { onClose: () => void; onAdd: (effect: SoundEffect) => void }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const all = useMemo(() => availableSounds(), []);
  const shown = all.filter((s) => (group === 'all' || (group === 'popular' ? s.popular : s.group === group))
    && (!q.trim() || `${s.name} ${s.desc} ${s.keywords.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())));
  const play = (s: SoundEffect) => {
    audio.current?.pause();
    if (playing === s.id) { setPlaying(null); return; }
    const a = new Audio(soundEffectSrc(s.id)); audio.current = a; setPlaying(s.id);
    a.onended = () => setPlaying(null); void a.play().catch(() => setPlaying(null));
  };
  const chip = (id: string, label: string) => (
    <button key={id} className="clip-properties-panel__toggle-btn" style={group === id ? { borderColor: '#22d3ee' } : undefined} onClick={() => setGroup(id)}>{label}</button>
  );
  return (
    <div role="dialog" aria-label="Sound effects library" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' }} onClick={() => { audio.current?.pause(); onClose(); }}>
      <div style={{ width: 'min(820px, 94vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: '#0b1016', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: 14, color: '#e5e7eb' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>Sound effects</strong>
          <input aria-label="Search sounds" placeholder="Search sounds…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 140, background: '#0d1218', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '4px 8px', fontSize: 12 }} />
          <button className="clip-properties-panel__toggle-btn" aria-label="Close sound library" onClick={() => { audio.current?.pause(); onClose(); }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {chip('all', `All (${all.length})`)}{chip('popular', 'Popular')}{SOUND_GROUPS.map((g) => chip(g.id, g.nameEn))}
        </div>
        <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10, paddingRight: 4 }}>
          {shown.map((s) => {
            const tone = SOUND_GROUP_TONE[s.group] ?? SOUND_GROUP_TONE['ui-motion-feedback'];
            return (
              <div key={s.id} data-testid={`sound-${s.id}`} style={{ background: tone.bg, color: tone.ink, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                <svg viewBox="0 0 100 32" preserveAspectRatio="none" style={{ width: '100%', height: 32 }}><path d={peaksToPath(resamplePeaks(s.peaks, 48))} fill={tone.glyph} /></svg>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, opacity: 0.7, flex: 1 }}>{formatSoundDuration(s.seconds)}</span>
                  <button className="clip-properties-panel__toggle-btn" style={{ color: tone.ink, borderColor: tone.ink }} onClick={() => play(s)} aria-label={`${playing === s.id ? 'Stop' : 'Play'} ${s.name}`}>{playing === s.id ? '■' : '▶'}</button>
                  <button className="clip-properties-panel__toggle-btn" style={{ color: tone.ink, borderColor: tone.ink }} onClick={() => onAdd(s)}>Add</button>
                </div>
              </div>
            );
          })}
          {!shown.length && <div style={{ opacity: 0.6, fontSize: 12 }}>No sounds match.</div>}
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>Click Add to place the sound at the playhead on an audio track.{missingSoundCount() > 0 ? ` ${missingSoundCount()} more are listed in OpenChatCut's registry but their audio files are not in its repository.` : ''}</div>
      </div>
    </div>
  );
}
