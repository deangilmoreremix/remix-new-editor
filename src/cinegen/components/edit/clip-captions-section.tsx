// [remix] Captions section of the clip inspector: OpenChatCut's caption styles (CAPTION_STYLES) and motion presets,
// words from the on-device Whisper transcript, optional bilingual line via OpenAI translation.
import { useState } from 'react';
import type { Clip } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import type { CaptionMotionPreset, CaptionsData, CaptionTemplate } from '../../../openchatcut/captions/types';
import { CAPTION_STYLES } from '../../../openchatcut/captions/styles';
import { phrasesFromWords, translateCues, TRANSLATION_LANGUAGES } from '@cinegen/lib/occ/translate';

const selectStyle = { flex: 1, minWidth: 0, background: 'var(--cg-surface-2, #0d1218)', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px', fontSize: 12 } as const;
const MOTIONS: CaptionMotionPreset[] = ['none', 'fade-up', 'pop', 'word-pop', 'karaoke-pulse'];

export function ClipCaptionsSection({ clip, asset, onUpdate }: { clip: Clip; asset: Asset | null; onUpdate: (u: { captions?: CaptionsData }) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [lang, setLang] = useState('Spanish');
  const c = clip.captions;
  const patch = (p: Partial<CaptionsData>) => c && onUpdate({ captions: { ...c, ...p } });
  const generate = async () => {
    if (!asset) return;
    setBusy(true); setMsg('Transcribing (the first run downloads the speech model)…');
    try {
      const { transcribeInBrowser, WHISPER_MODELS } = await import('../../../lib/editor/remotion/transcribe.js');
      const model = (navigator as Navigator & { gpu?: unknown }).gpu ? WHISPER_MODELS[0][0] : WHISPER_MODELS[1][0];
      const out = await transcribeInBrowser(toFileUrl(asset.fileRef || asset.url), { model, onProgress: () => {} });
      const sp = clip.speed || 1;
      const words = (out.captions as Array<{ text: string; startMs: number; endMs: number }>)
        .map((w) => ({ text: w.text, start: Math.round(clip.startTime * 1000 + (w.startMs - clip.trimStart * 1000) / sp), end: Math.round(clip.startTime * 1000 + (w.endMs - clip.trimStart * 1000) / sp) }))
        .filter((w) => w.end > clip.startTime * 1000 && w.start < (clip.startTime + (clip.duration - clip.trimStart - clip.trimEnd) / sp) * 1000);
      if (!words.length) { setMsg('No speech found.'); return; }
      onUpdate({ captions: { enabled: true, template: 'tiktok', pacing: 'phrase', motionPreset: 'pop', words, offsetFrames: 0 } });
      setMsg(`${words.length} words captioned.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const bilingual = async () => {
    if (!c?.words) return;
    setBusy(true); setMsg(`Translating to ${lang}…`);
    try {
      const cues = await translateCues(phrasesFromWords(c.words.map((w) => ({ text: w.text, startMs: w.start, endMs: w.end }))), lang);
      patch({ bilingual: true, translationLang: lang, translation: cues.map((x) => ({ start: x.startMs, end: x.endMs, text: x.text })) });
      setMsg(`${cues.length} ${lang} lines added under the captions.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <div className="clip-properties-panel__section" data-testid="clip-captions">
      <div className="clip-properties-panel__section-title">Captions</div>
      {!c ? (
        <div className="clip-properties-panel__row"><button className="clip-properties-panel__toggle-btn" disabled={busy || !asset} onClick={generate}>{busy ? 'Working…' : 'Generate captions'}</button></div>
      ) : (
        <>
          <div className="clip-properties-panel__row">
            <select aria-label="Caption style" style={selectStyle} value={c.template} onChange={(e) => patch({ template: e.target.value as CaptionTemplate })}>
              {CAPTION_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="clip-properties-panel__row">
            <select aria-label="Caption motion" style={selectStyle} value={c.motionPreset ?? 'none'} onChange={(e) => patch({ motionPreset: e.target.value as CaptionMotionPreset })}>
              {MOTIONS.map((m) => <option key={m} value={m}>{m === 'none' ? 'No motion' : m}</option>)}
            </select>
          </div>
          <div className="clip-properties-panel__row">
            <select aria-label="Bilingual language" style={selectStyle} value={lang} onChange={(e) => setLang(e.target.value)}>{TRANSLATION_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}</select>
            <button className="clip-properties-panel__toggle-btn" disabled={busy} onClick={bilingual}>Add translation</button>
          </div>
          <div className="clip-properties-panel__row">
            <button className="clip-properties-panel__toggle-btn" onClick={() => patch({ enabled: !c.enabled })}>{c.enabled ? 'Hide captions' : 'Show captions'}</button>
            <button className="clip-properties-panel__toggle-btn" onClick={() => onUpdate({ captions: undefined })}>Remove</button>
          </div>
        </>
      )}
      {msg && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{msg}</div>}
    </div>
  );
}
