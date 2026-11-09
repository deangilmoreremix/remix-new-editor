// [remix] "Analyze" section of the clip inspector: OpenChatCut's colour scopes, auto-grade, scene detection, quiet-span,
// loudness and beat analysis, run in the browser on the selected clip's media.
import { useState } from 'react';
import type { Clip, Timeline } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import { splitClip } from '@cinegen/lib/editor/timeline-operations';
import * as A from '@cinegen/lib/occ/analysis';
import { TRANSLATION_LANGUAGES, phrasesFromWords, translateCues, toSrt } from '@cinegen/lib/occ/translate';

interface Props {
  clip: Clip;
  asset: Asset | null;
  onTimelineEdit: (edit: (tl: Timeline) => Timeline) => void;
  onUpdateClip: (updates: Partial<Pick<Clip, 'volume' | 'fx'>>) => void;
}
type Job = 'scopes' | 'scenes' | 'quiet' | 'loudness' | 'beats' | 'captions';

export function ClipAnalyzeSection({ clip, asset, onTimelineEdit, onUpdateClip }: Props) {
  const [busy, setBusy] = useState<Job | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [scenes, setScenes] = useState<A.SceneChange[]>([]);
  const [lang, setLang] = useState<string>('Spanish');
  const [grade, setGrade] = useState<{ black: number; white: number } | null>(null);
  const src = asset ? toFileUrl(asset.fileRef || asset.url) : '';
  const isVideo = asset?.type === 'video' || asset?.type === 'image';

  const run = async (job: Job, fn: () => Promise<void>) => {
    setBusy(job); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const mid = clip.trimStart + (clip.duration - clip.trimStart - clip.trimEnd) / 2;

  return (
    <div className="clip-properties-panel__section" data-testid="clip-analyze">
      <div className="clip-properties-panel__section-title">Analyze</div>
      <div className="clip-properties-panel__toggle-row" style={{ flexWrap: 'wrap' }}>
        {isVideo && <button className="clip-properties-panel__toggle-btn" disabled={!!busy} onClick={() => run('scopes', async () => {
          const s = await A.scopesAt(src, mid); const g = A.autoGradeFromScopes(s);
          setLines([...A.describeScopeStats(s), `auto-grade: brightness ${g.filters.brightness} · contrast ${g.filters.contrast} · saturation ${g.filters.saturate}${g.adjustments.length ? ` (${g.adjustments.join(', ')})` : ' (no change needed)'}`]);
          setGrade({ black: s.blackPoint, white: s.whitePoint });
        })}>{busy === 'scopes' ? 'Reading…' : 'Color scopes'}</button>}
        {isVideo && <button className="clip-properties-panel__toggle-btn" disabled={!!busy} onClick={() => run('scenes', async () => {
          const found = await A.detectSceneChanges(src); setScenes(found);
          setLines([found.length ? `${found.length} scene change${found.length === 1 ? '' : 's'}: ${found.map((f) => `${(f.timeMs / 1000).toFixed(1)}s`).join(', ')}` : 'No scene changes found.']);
        })}>{busy === 'scenes' ? 'Scanning…' : 'Detect scenes'}</button>}
        <button className="clip-properties-panel__toggle-btn" disabled={!!busy} onClick={() => run('quiet', async () => {
          const spans = await A.quietSpans(src);
          const times = spans.flatMap((s) => [A.sourceToTimeline(clip, s.startMs / 1000), A.sourceToTimeline(clip, s.endMs / 1000)]).filter((t): t is number => t != null);
          onTimelineEdit((tl) => A.addMarkers(tl, times, 'quiet', '#f59e0b'));
          setLines([spans.length ? `${spans.length} quiet stretch${spans.length === 1 ? '' : 'es'} marked (RMS only — check before cutting).` : 'No quiet stretches found.']);
        })}>{busy === 'quiet' ? 'Listening…' : 'Find quiet spans'}</button>
        <button className="clip-properties-panel__toggle-btn" disabled={!!busy} onClick={() => run('loudness', async () => {
          const lufs = await A.loudnessLufs(src); const gain = A.gainForTarget(lufs, -14);
          setLines([`loudness ≈ ${lufs.toFixed(1)} LUFS · gain to reach -14 LUFS: ×${gain.toFixed(2)}`]);
          onUpdateClip({ volume: Math.round(clip.volume * gain * 100) / 100 });
        })}>{busy === 'loudness' ? 'Measuring…' : 'Normalize to -14 LUFS'}</button>
        <button className="clip-properties-panel__toggle-btn" disabled={!!busy} onClick={() => run('beats', async () => {
          const b = await A.beatsOf(src);
          if (!b.bpm) { setLines(['No steady beat found.']); return; }
          const times = b.downbeats.map((s) => A.sourceToTimeline(clip, s)).filter((t): t is number => t != null);
          onTimelineEdit((tl) => A.addMarkers(tl, times, 'beat', '#22d3ee'));
          setLines([`${b.bpm.toFixed(0)} BPM (confidence ${b.confidence.toFixed(1)}) · ${times.length} bar markers added`]);
        })}>{busy === 'beats' ? 'Analyzing…' : 'Beat markers'}</button>
      </div>
      <div className="clip-properties-panel__row" style={{ marginTop: 8 }}>
        <select aria-label="Caption language" value={lang} onChange={(e) => setLang(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'var(--cg-surface-2, #0d1218)', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px', fontSize: 12 }}>
          {TRANSLATION_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className="clip-properties-panel__toggle-btn" disabled={!!busy} onClick={() => run('captions', async () => {
          setLines(['Transcribing (first run downloads the speech model)…']);
          const { transcribeInBrowser, WHISPER_MODELS } = await import('../../../lib/editor/remotion/transcribe.js');
          const model = (navigator as Navigator & { gpu?: unknown }).gpu ? WHISPER_MODELS[0][0] : WHISPER_MODELS[1][0];
          const out = await transcribeInBrowser(src, { model, onProgress: () => {} });
          const cues = phrasesFromWords(out.captions as Array<{ text: string; startMs: number; endMs: number }>);
          if (!cues.length) { setLines(['No speech found to caption.']); return; }
          setLines([`Translating ${cues.length} caption lines to ${lang}…`]);
          const translated = await translateCues(cues, lang);
          const url = URL.createObjectURL(new Blob([toSrt(translated)], { type: 'application/x-subrip' }));
          const a = document.createElement('a'); a.href = url; a.download = `${(asset?.name ?? 'captions').replace(/\.[^.]+$/, '')}.${lang.split(' ')[0].toLowerCase()}.srt`; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          setLines([`${translated.length} ${lang} caption lines saved as .srt — ${translated[0].text}`]);
        })}>{busy === 'captions' ? 'Working…' : 'Translate captions (.srt)'}</button>
      </div>
      {scenes.length > 0 && (
        <button className="clip-properties-panel__toggle-btn" style={{ marginTop: 6 }} onClick={() => {
          const times = scenes.map((s) => A.sourceToTimeline(clip, s.timeMs / 1000)).filter((t): t is number => t != null).sort((a, b) => b - a);
          onTimelineEdit((tl) => { let out = tl; let id = clip.id; for (const t of times) { out = splitClip(out, id, t); } return out; });
          setScenes([]);
        }}>Split clip at {scenes.length} scene change{scenes.length === 1 ? '' : 's'}</button>
      )}
      {grade && (
        <button className="clip-properties-panel__toggle-btn" style={{ marginTop: 6 }} onClick={() => {
          onUpdateClip({ fx: [...(clip.fx ?? []), { id: 'builtin:fx-levels', props: { inBlack: Math.min(0.5, grade.black), inWhite: Math.max(0.5, grade.white) } }] });
          setGrade(null);
        }}>Apply auto levels</button>
      )}
      {error && <div className="clip-properties-panel__empty-text" style={{ color: '#f87171', marginTop: 6 }}>{error}</div>}
      {lines.map((l, i) => <div key={i} style={{ fontSize: 11, opacity: 0.85, marginTop: 4, lineHeight: 1.35 }}>{l}</div>)}
    </div>
  );
}
