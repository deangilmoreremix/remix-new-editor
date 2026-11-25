// [remix] Sound-effects library (OpenChatCut's registry, names, groups and waveforms) inside the Edit tab.
import { useMemo, useRef, useState } from 'react';
import { SOUND_GROUPS, SOUND_GROUP_TONE, formatSoundDuration, peaksToPath, resamplePeaks, type SoundEffect } from '../../../openchatcut/audio/soundLibrary';
import { ModalShell } from '../ui/modal-shell';
import '../../styles/edit-modal-stock-sound.css';
import { availableSounds, missingSoundCount, soundEffectSrc } from '@cinegen/lib/occ/sound-library';

const MODAL_TITLE = 'Sound effects';

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
  const close = () => { audio.current?.pause(); onClose(); };
  const chip = (id: string, label: string, count?: number) => (
    <button key={id} type="button" className="cg-chip" aria-pressed={group === id} onClick={() => setGroup(id)}>{label}{count !== undefined && <span className="cg-count">{count}</span>}</button>
  );
  const missing = missingSoundCount();
  return (
    <ModalShell
      title={MODAL_TITLE}
      subtitle="Browse ready-made sounds and add one at the playhead."
      icon="♪"
      ariaLabel="Sound effects library"
      closeLabel="Close sound library"
      width="min(820px, 94vw)"
      height="min(760px, 86vh)"
      onClose={close}
      toolbar={(
        <>
          <label className="cg-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input aria-label="Search sounds" placeholder="Search sounds…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <span className="cg-count" aria-hidden="true">{shown.length}</span>
        </>
      )}
      footer={<span>Click Add to place the sound at the playhead on an audio track.{missing > 0 ? ` ${missing} more are listed in OpenChatCut's registry but their audio files are not in its repository.` : ''}</span>}
    >
      <div className="cg-chips" style={{ marginBottom: 12 }}>
        {chip('all', 'All', all.length)}{chip('popular', 'Popular')}{SOUND_GROUPS.map((g) => chip(g.id, g.nameEn))}
      </div>
      <div className="cg-grid cg-sound__grid">
        {shown.map((s) => {
          const tone = SOUND_GROUP_TONE[s.group] ?? SOUND_GROUP_TONE['ui-motion-feedback'];
          return (
            <div key={s.id} data-testid={`sound-${s.id}`} className="cg-sound-card" style={{ background: tone.bg, color: tone.ink }}>
              <div className="cg-sound-card__name">{s.name}</div>
              <svg className="cg-sound-card__wave" viewBox="0 0 100 32" preserveAspectRatio="none"><path d={peaksToPath(resamplePeaks(s.peaks, 48))} fill={tone.glyph} /></svg>
              <div className="cg-sound-card__row">
                <span className="cg-sound-card__dur">{formatSoundDuration(s.seconds)}</span>
                <button type="button" className="cg-btn" style={{ color: tone.ink, borderColor: tone.ink }} onClick={() => play(s)} aria-label={`${playing === s.id ? 'Stop' : 'Play'} ${s.name}`}>{playing === s.id ? '■' : '▶'}</button>
                <button type="button" className="cg-btn" style={{ color: tone.ink, borderColor: tone.ink }} onClick={() => onAdd(s)}>Add</button>
              </div>
            </div>
          );
        })}
      </div>
      {!shown.length && <div className="cg-empty" data-testid="sound-empty">No sounds match.</div>}
    </ModalShell>
  );
}
