// [remix] Captions section of the clip inspector: OpenChatCut's caption styles (CAPTION_STYLES) and motion presets,
// words from the on-device Whisper transcript, optional bilingual line via OpenAI translation.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Clip } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import type { CaptionMotionPreset, CaptionsData, CaptionTemplate } from '../../../openchatcut/captions/types';
import { CAPTION_STYLES } from '../../../openchatcut/captions/styles';
// [remix] OpenChatCut's own sentence-by-sentence editor (captions/CaptionCueEditor.tsx) + its CSS
import { backfillCueIdentities } from '../../../openchatcut/transcript/identity';
import { DESIGN_STYLE_PRESETS } from '../../../openchatcut/editor/design-presets';
import { CAPTION_FONT_FAMILIES, presetCaptionOverride } from '@cinegen/lib/occ/design-style';
import { captionsToSrt, captionsToTxt } from '../../../openchatcut/captions/exportCaptions';
import { parseSrt } from '../../../openchatcut/captions/srt';
import { deleteCaptionPreset, listCaptionPresets, saveCaptionPreset, type CaptionPreset } from '../../../openchatcut/captions/presetStore';
import { importFontFile, loadUserFonts, userFontFamilies } from '@cinegen/lib/occ/user-fonts';
import { CaptionCueEditor } from '../../../openchatcut/captions/CaptionCueEditor';
import '../../../openchatcut/captions/captionEditor.css';
import { phrasesFromWords, translateCues, TRANSLATION_LANGUAGES } from '@cinegen/lib/occ/translate';

const selectStyle = { flex: 1, minWidth: 0, background: 'var(--cg-surface-2, #0d1218)', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px', fontSize: 12 } as const;
const MOTIONS: CaptionMotionPreset[] = ['none', 'fade-up', 'pop', 'word-pop', 'karaoke-pulse', 'char-rise', 'char-pop', 'char-wave', 'word-rise'];

export function ClipCaptionsSection({ clip, asset, onUpdate, onSeek }: { clip: Clip; asset: Asset | null; onUpdate: (u: { captions?: CaptionsData }) => void; onSeek?: (time: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [lang, setLang] = useState('Spanish');
  const c = useMemo(() => {
    const cur = clip.captions;
    if (!cur?.words?.length) return cur;
    const words = backfillCueIdentities(cur.words, clip.id);
    return words === cur.words ? cur : { ...cur, words };
  }, [clip.captions, clip.id]);
  const noItems = useMemo(() => [], []);
  // [remix] saved caption presets (their presetStore), imported fonts, SRT import/export
  const [presets, setPresets] = useState<CaptionPreset[]>([]);
  const [, bumpFonts] = useState(0);
  const srtRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void listCaptionPresets().then(setPresets); void loadUserFonts().then((f) => f.length && bumpFonts((n) => n + 1)); }, []);
  const download = (name: string, text: string, type: string) => { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
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
      onUpdate({ captions: { enabled: true, template: 'tiktok', pacing: 'phrase', motionPreset: 'pop', words: backfillCueIdentities(words, clip.id), offsetFrames: 0 } });
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
      <input ref={srtRef} type="file" accept=".srt,text/plain" hidden data-testid="caption-srt-file" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const words = parseSrt(await f.text()); if (!words.length) { setMsg('No cues found in that .srt file.'); return; } const off = Math.round(clip.startTime * 1000); onUpdate({ captions: { ...(c ?? { enabled: true, template: 'tiktok', pacing: 'phrase', motionPreset: 'pop', offsetFrames: 0 }), words: backfillCueIdentities(words.map((w) => ({ ...w, start: w.start + off, end: w.end + off })), clip.id), wordOverrides: undefined, translation: undefined, bilingual: undefined } as CaptionsData }); setMsg(`${words.length} cue${words.length === 1 ? '' : 's'} imported from ${f.name}.`); }} />
      {!c ? (
        <div className="clip-properties-panel__row"><button className="clip-properties-panel__toggle-btn" disabled={busy || !asset} onClick={generate}>{busy ? 'Working…' : 'Generate captions'}</button><button className="clip-properties-panel__toggle-btn" onClick={() => srtRef.current?.click()}>Import .srt</button></div>
      ) : (
        <>
          <div className="clip-properties-panel__row">
            <select aria-label="Caption style" style={selectStyle} value={c.template} onChange={(e) => patch({ template: e.target.value as CaptionTemplate })}>
              {CAPTION_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="clip-properties-panel__row">
            <select aria-label="Brand style" data-testid="caption-brand-style" style={selectStyle} value="" onChange={(e) => { const p = DESIGN_STYLE_PRESETS.find((x) => x.id === e.target.value); if (p) patch({ styleOverride: { ...c.styleOverride, ...presetCaptionOverride(p.style) } }); }}>
              <option value="">Brand style…</option>
              {DESIGN_STYLE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="clip-properties-panel__row">
            <select aria-label="Caption font" data-testid="caption-font" style={selectStyle} value={c.styleOverride?.fontFamily ?? ''} onChange={(e) => { const { fontFamily: _f, ...rest } = c.styleOverride ?? {}; patch({ styleOverride: e.target.value ? { ...rest, fontFamily: e.target.value } : rest }); }}>
              <option value="">Font: style default</option>
              {userFontFamilies().map((f) => <option key={f} value={f}>{f} (imported)</option>)}
              {CAPTION_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
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
            <select aria-label="Caption preset" data-testid="caption-preset" style={selectStyle} value="" onChange={(e) => { const p = presets.find((x) => x.id === e.target.value); if (p) patch({ ...(p.template ? { template: p.template } : {}), ...(p.pacing ? { pacing: p.pacing } : {}), ...(p.motionPreset ? { motionPreset: p.motionPreset } : {}), styleOverride: p.styleOverride }); }}>
              <option value="">My presets…</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="clip-properties-panel__toggle-btn" data-testid="caption-preset-save" onClick={async () => { const name = window.prompt('Name this caption look'); if (!name?.trim() || !c) return; await saveCaptionPreset({ id: `cp_${Date.now().toString(36)}`, name: name.trim(), template: c.template, styleOverride: c.styleOverride, pacing: c.pacing, motionPreset: c.motionPreset, createdAt: Date.now() }); setPresets(await listCaptionPresets()); }}>Save look</button>
            <button className="clip-properties-panel__toggle-btn" aria-label="Delete a saved look" disabled={!presets.length} onClick={async () => { const name = window.prompt(`Delete which look?\n${presets.map((p) => p.name).join(', ')}`); const hit = presets.find((p) => p.name === name?.trim()); if (hit) { await deleteCaptionPreset(hit.id); setPresets(await listCaptionPresets()); } }}>Delete…</button>
          </div>
          <div className="clip-properties-panel__row">
            <input ref={fontRef} type="file" accept=".ttf,.otf,.woff,.woff2" hidden data-testid="caption-font-file" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const fam = await importFontFile(f); bumpFonts((n) => n + 1); patch({ styleOverride: { ...c.styleOverride, fontFamily: fam } }); setMsg(`Font “${fam}” imported.`); } catch (err) { setMsg(err instanceof Error ? err.message : String(err)); } }} />
            <button className="clip-properties-panel__toggle-btn" onClick={() => fontRef.current?.click()}>Import font…</button>
            <button className="clip-properties-panel__toggle-btn" onClick={() => srtRef.current?.click()}>Import .srt</button>
            <button className="clip-properties-panel__toggle-btn" data-testid="caption-export-srt" onClick={() => download(`${clip.name || 'captions'}.srt`, captionsToSrt(c, noItems, 30), 'application/x-subrip')}>Export .srt</button>
            <button className="clip-properties-panel__toggle-btn" onClick={() => download(`${clip.name || 'captions'}.txt`, captionsToTxt(c, noItems, 30), 'text/plain')}>.txt</button>
          </div>
          <div className="cc-cap-host" data-testid="caption-cue-editor"><CaptionCueEditor captions={c} items={noItems} fps={30} onUpdate={patch} onSeekMs={onSeek ? (ms) => onSeek(ms / 1000) : undefined} /></div>
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
