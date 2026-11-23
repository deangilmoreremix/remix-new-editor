// [remix] Inspector for the selected overlay. The fields are drawn by the old editor's settings renderer (`renderAddonEditor`),
// so Lead Generator / List Builder / CTA have the same Basic / Style / Fields / Integrations tabs as before.
import { useEffect, useRef, useState } from 'react';
import '../../styles/edit-panels.css';
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS settings renderer from the main app
import { renderAddonEditor } from '../../../lib/editor/addons/addonEditor.js';
// @ts-expect-error plain JS personalization tokens (the same list the old editor's Personalize menu uses)
import { TOKEN_DEFS } from '../../../components/personalize/tokenSchema.js';
// @ts-expect-error plain JS opt-in form schema + the Lead Generator clip adapter
import { applyOptinToLeadForm, switchListBuilderKind } from '../../../lib/editor/addons/listBuilder.js';
import type { MgPropField } from '@cinegen/lib/occ/mg-templates';
import { overlaySchema } from '@cinegen/lib/overlays/descriptors';
import { LottieEditSection } from './lottie-edit-section';
import { FormLeadsButton } from '@cinegen/components/leads/form-leads-button';
import { isRegistryOverlay, gatesOnTimeline } from '@cinegen/lib/overlays/overlays';
import { SavePresetRow } from './save-preset-row';
import { contactImageServices, measureLogoFor, makeAllVideoReady } from '@cinegen/lib/personalize/contact-image-services';
import { overlayMediaServices } from '@cinegen/lib/overlays/overlay-media-services';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { usePreviewContact } from '@cinegen/lib/personalize/preview-contact';
import { OPEN_SPEECH_EVENT } from '@cinegen/lib/occ/smart-speech';
import { importFontFile, loadUserFonts, userFontFamilies } from '@cinegen/lib/occ/user-fonts';
import { CAPTION_FONT_FAMILIES } from '@cinegen/lib/occ/design-style';
// @ts-expect-error plain JS: fonts installed on this computer (Local Font Access API)
import { supportsSystemFonts, systemFontFamilies, loadSystemFonts, refreshSystemFontsIfAllowed } from '../../../lib/editor/addons/systemFonts.js';
import { hyperframesItem, defaultFit } from '@cinegen/lib/hyperframes/overlay';
// @ts-expect-error plain JS placement helpers
import { HF_FITS, HF_FIT_LABELS, normalizeGeom, isReactItem } from '../../../lib/hyperframes/placement.js';

/** [remix] Props of an OpenChatCut motion-graphics template, drawn from the template's own propSchema. */
function MgPropsEditor({ overlay, onUpdate }: { overlay: OverlayClip; onUpdate: (u: Partial<OverlayClip>) => void }) {
  const schema = (overlay.propSchema as MgPropField[] | undefined) ?? [];
  const props = (overlay.props as Record<string, unknown>) ?? {};
  const set = (key: string, v: unknown) => onUpdate({ props: { ...props, [key]: v } });
  return (
    <div className="cg-panel-pad--end">
      {schema.map((f) => {
        const v = props[f.key] ?? f.defaultValue;
        const label = <span>{f.label ?? f.key}</span>;
        if (f.type === 'boolean') return <label key={f.key} className="addon-field"><span><input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} /> {f.label ?? f.key}</span></label>;
        if (f.type === 'color') return <label key={f.key} className="addon-field">{label}<input type="color" value={/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : '#ffffff'} onChange={(e) => set(f.key, e.target.value)} /></label>;
        if (f.type === 'number') return <label key={f.key} className="addon-field">{label}<input type="number" min={f.min} max={f.max} step={f.step ?? 1} value={Number(v ?? 0)} onChange={(e) => set(f.key, Number(e.target.value))} /></label>;
        if (f.type === 'select') return <label key={f.key} className="addon-field">{label}<select value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)}>{(f.options ?? []).map((o) => { const val = typeof o === 'string' ? o : o.value; return <option key={val} value={val}>{typeof o === 'string' ? o : o.label ?? o.value}</option>; })}</select></label>;
        return <label key={f.key} className="addon-field">{label}<input type="text" value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} /></label>;
      })}
    </div>
  );
}

/** Placement of an animation in the frame: fit, offset, size. The same values are set by dragging on the video. */
function HfPlacementControls({ overlay, duration, onUpdate }: { overlay: OverlayClip; duration: number; onUpdate: (u: Partial<OverlayClip>) => void }) {
  const item = hyperframesItem(String(overlay.blockId ?? ''));
  const isRui = isReactItem(String(overlay.blockId ?? ''));
  const fitDefault = item && !isRui ? defaultFit(item) : 'contain';
  const g = normalizeGeom(overlay.geom, fitDefault) as { x: number; y: number; scale: number; fit: string };
  const set = (patch: Record<string, unknown>) => onUpdate({ geom: { ...((overlay.geom as Record<string, unknown>) ?? {}), fit: g.fit, ...patch } });
  const num = (v: string, d: number) => (Number.isFinite(Number(v)) && v.trim() !== '' ? Number(v) : d);
  return (
    <div data-testid="hf-placement" className="cg-panel-pad">
      <div className="cg-label" style={{ margin: '4px 0 6px' }}>Placement</div>
      {!isRui && (
        <label className="addon-field"><span>Fit</span>
          <select aria-label="Fit" value={g.fit} onChange={(e) => set({ fit: e.target.value })}>{(HF_FITS as string[]).map((f) => <option key={f} value={f}>{(HF_FIT_LABELS as Record<string, string>)[f]}</option>)}</select>
        </label>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <label className="addon-field" style={{ flex: 1 }}><span>Left / right (%)</span><input aria-label="Left / right" type="number" step={1} value={Number(g.x.toFixed(1))} onChange={(e) => set({ x: num(e.target.value, g.x) })} /></label>
        <label className="addon-field" style={{ flex: 1 }}><span>Up / down (%)</span><input aria-label="Up / down" type="number" step={1} value={Number(g.y.toFixed(1))} onChange={(e) => set({ y: num(e.target.value, g.y) })} /></label>
        <label className="addon-field" style={{ flex: 1 }}><span>Size (%)</span><input aria-label="Size" type="number" min={10} max={400} step={5} value={Math.round(g.scale * 100)} onChange={(e) => set({ scale: Math.min(4, Math.max(0.1, num(e.target.value, 100) / 100)) })} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button type="button" className="cg-btn cg-btn--sm" onClick={() => onUpdate({ geom: { fit: fitDefault } })}>Reset position</button>
        <button type="button" className="cg-btn cg-btn--sm" disabled={duration <= overlay.start + 0.5} onClick={() => onUpdate({ end: Math.max(overlay.start + 0.5, duration) })}>Extend to end of video</button>
      </div>
      <div className="cg-note" style={{ marginTop: 6 }}>Tip: select it, then drag the "Move" handle on the video, or the corner square to resize.</div>
    </div>
  );
}

interface Props {
  overlay: OverlayClip;
  duration: number;
  onUpdate: (updates: Partial<OverlayClip>) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function OverlaySettingsPanel({ overlay, duration, onUpdate, onRemove, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef(overlay);
  latest.current = overlay;
  const editorRef = useRef<{ setOptions?: (o: Record<string, unknown>) => void } | null>(null);
  // true while a change came from this panel itself (so its own echo doesn't redraw the form under the caret)
  const ownEdit = useRef(false);
  const [note, setNote] = useState('');
  const [allBusy, setAllBusy] = useState(false); // outcome of a picture action (saved to the contact, Video Ready ...)
  const { state: workspace } = useWorkspace();
  const assetsRef = useRef(workspace.assets); assetsRef.current = workspace.assets;
  const contact = usePreviewContact(); // the contact whose pictures the settings show

  useEffect(() => {
    if (!box.current || latest.current.type === 'mg-template' || latest.current.type === 'hyperframes') return;
    const schema = overlaySchema(latest.current);
    const editor = renderAddonEditor(box.current, {
      fields: schema.fields, fieldsFor: schema.fieldsFor, options: schema.options, onFieldChange: schema.onFieldChange, idPrefix: `ov-${overlay.id}`,
      // [remix] the Personalize menu of Smart Text / Text Mask (the old editor passed the same token list)
      services: {
        tokens: (TOKEN_DEFS as Array<{ key: string; label: string }>).map((d) => [d.key, d.label]),
        // the same font import the captions have: the Font list then includes what was imported (stored in this browser)
        ...overlayMediaServices({ notify: (m) => setNote(m), assets: () => assetsRef.current }), // upload, project images, Pixabay / Pexels, stickers
        ...contactImageServices({ notify: (m) => setNote(m) }), // Personalized Image: the contact's pictures, image finder, crop focus, Make Video Ready
        extraFonts: CAPTION_FONT_FAMILIES,
        userFonts: userFontFamilies,
        systemFonts: systemFontFamilies,
        canLoadSystemFonts: supportsSystemFonts,
        loadSystemFonts,
        importFont: importFontFile,
        // Smart Text: "Convert to Smart Speech" opens the Smart Speech window with this text
        fieldAction: (action: string, opts: { text?: string }) => { if (action === 'speech') window.dispatchEvent(new CustomEvent(OPEN_SPEECH_EVENT, { detail: { text: String(opts.text ?? '') } })); },
      },
      onChange: (next: Record<string, unknown>) => {
        ownEdit.current = true;
        const cur = latest.current;
        if (cur.type === 'list-builder') {
          // Switching List Builder <-> Personalizer swaps in that kind's own defaults
          const curKind = (cur.config as { kind?: string } | undefined)?.kind ?? 'list-builder';
          if (next.kind && next.kind !== curKind) {
            const switched = switchListBuilderKind(next, next.kind);
            onUpdate({ config: switched });
            editor?.setOptions?.(switched);
            return;
          }
          onUpdate({ config: next });
        } else if (isRegistryOverlay(cur.type)) onUpdate({ addon: next });
        else if (cur.type === 'lead-form') {
          // the shared form options -> the flat Lead Generator clip the old editor saved (style / design are copied, never mutated)
          const clip = { ...cur, style: { ...((cur.style as object) ?? {}) }, design: { ...((cur.design as object) ?? {}) } } as Record<string, unknown>;
          applyOptinToLeadForm(clip, next);
          const { id: _id, type: _type, start: _start, end: _end, ...rest } = clip;
          void _id; void _type; void _start; void _end;
          onUpdate(rest as Partial<OverlayClip>);
        } else {
          const { id: _id, type: _type, start: _start, end: _end, ...rest } = next as Record<string, unknown>;
          void _id; void _type; void _start; void _end;
          onUpdate(rest as Partial<OverlayClip>);
        }
      },
    });
    editorRef.current = editor;
    let alive = true; // a font list that finishes loading after another overlay was picked must not redraw this (destroyed) editor
    void refreshSystemFontsIfAllowed().then((f: string[]) => { if (alive && f.length) editor?.setOptions?.(overlaySchema(latest.current).options); }); // already allowed earlier: no prompt
    void loadUserFonts().then((f) => { if (alive && f.length) editor?.setOptions?.(overlaySchema(latest.current).options); }); // fonts imported earlier appear in the list
    return () => { alive = false; editor?.destroy?.(); editorRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay.id]);

  // the form was edited by clicking its text: show the new text in the panel too
  useEffect(() => {
    if (ownEdit.current) { ownEdit.current = false; return; }
    if (!box.current || overlay.type === 'mg-template') return; // [remix] add-ons too: Smart Text can be edited on the video
    editorRef.current?.setOptions?.(overlaySchema(overlay).options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay]);

  // the contact (or its pictures) changed: the picture buttons redraw; a logo gets measured once so "Backing: Auto" suits it
  useEffect(() => { if (contact.version) editorRef.current?.setOptions?.(overlaySchema(latest.current).options); }, [contact.version]);
  useEffect(() => { void measureLogoFor(contact.profile as never); }, [contact.profile]);

  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  return (
    <aside className="clip-properties-panel addon-panel">
      <div className="clip-properties-panel__header">
        <span className="clip-properties-panel__title cg-title-ellipsis">{overlay.name} overlay</span>
        <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button type="button" className="cg-btn cg-btn--sm" onClick={onRemove}>Delete</button>
          <button type="button" className="cg-btn cg-btn--sm" onClick={onClose} aria-label="Close">✕</button>
        </span>
      </div>
      {(overlay.type === 'list-builder' || overlay.type === 'lead-form') && <FormLeadsButton overlayId={overlay.id} type={overlay.type} />}
      {overlay.type === 'lead-form' && !gatesOnTimeline(overlay) && (
        <p data-testid="trigger-note" className="cg-note cg-panel-note">On the published page this form appears {overlay.trigger === 'end' ? 'at the end of the video' : overlay.trigger === 'pause' ? 'when the viewer pauses' : 'when the viewer is about to leave'}. Here it shows while the video is stopped inside this time range, and does not pause playback.</p>
      )}
      {overlay.type === 'list-builder' ? (
        <p className="cg-note cg-panel-note">Viewers fill this out before the video plays. It sits at the start of the timeline and takes no video time.</p>
      ) : (
      <div className="cg-panel-pad" style={{ display: 'flex', gap: 8 }}>
        <label className="cg-time-label">Start (s)<br />
          <input type="number" min={0} max={Math.max(0, overlay.end - 0.5)} step={0.1} value={Number(overlay.start.toFixed(2))}
            onChange={(e) => onUpdate({ start: Math.max(0, Math.min(num(e.target.value, overlay.start), overlay.end - 0.5)) })} className="cg-field cg-time-field" />
        </label>
        <label className="cg-time-label">End (s)<br />
          <input type="number" min={overlay.start + 0.5} max={Math.max(duration, overlay.end)} step={0.1} value={Number(overlay.end.toFixed(2))}
            onChange={(e) => onUpdate({ end: Math.max(overlay.start + 0.5, num(e.target.value, overlay.end)) })} className="cg-field cg-time-field" />
        </label>
      </div>
      )}
      {isRegistryOverlay(overlay.type) && <SavePresetRow overlay={overlay} />}
      {note && <p role="status" data-testid="overlay-note" className="cg-note cg-panel-note">{note}</p>}
      {overlay.type === 'overlay-personalized-image' && contact.profiles.length > 0 && (
        <div className="cg-panel-pad">
          <button type="button" className="cg-btn cg-btn--sm cg-btn--block" data-testid="all-video-ready" disabled={allBusy}
            title="Make all Video Ready"
            onClick={async () => {
              setAllBusy(true);
              try {
                const r = await makeAllVideoReady(workspace.overlays ?? [], { notify: (m) => setNote(m), onProgress: (d, t, who) => { if (who) setNote(`Making images Video Ready: ${d + 1} of ${t} (${who})…`); } });
                setNote(r.message);
              } finally { setAllBusy(false); }
            }}>{allBusy ? 'Working…' : '✨ Make all contacts’ images Video Ready'}</button>
        </div>
      )}
      {overlay.type === 'overlay-personalized-image' && !contact.profiles.length && (
        <p data-testid="no-contacts-hint" className="cg-note cg-panel-note">
          No contacts yet, so this shows a grey placeholder. Make one with the <strong>Personalization</strong> button on the Overlays lane: their logo and photo then appear here, and each contact gets their own picture in the video.
        </p>
      )}
      {overlay.type === 'hyperframes' && <HfPlacementControls overlay={overlay} duration={duration} onUpdate={onUpdate} />}
      {overlay.type === 'mg-template' || overlay.type === 'hyperframes' ? <MgPropsEditor overlay={overlay} onUpdate={onUpdate} /> : <div ref={box} className="cg-panel-pad--end" />}
      {overlay.type === 'overlay-sticker' && (overlay.addon as { kind?: string } | undefined)?.kind === 'lottie' && <LottieEditSection addon={overlay.addon as never} onChange={(next) => onUpdate({ addon: next })} />}
    </aside>
  );
}
