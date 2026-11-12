// [remix] One place to add anything to the timeline (replaces the "+ Add overlay…" dropdown): Animations, Motion graphics,
// Smart Speech, Template Generator, Personalization, the basic overlays and the End screen / Connect form templates.
// Each entry only routes to the handlers the timeline editor already had; the modal itself holds no timeline logic.
import { useMemo, useState, type CSSProperties } from 'react';
import type { OverlayKind } from '@cinegen/types/workspace';
import type { HfItem } from '@cinegen/lib/hyperframes/overlay';
import type { MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { OVERLAY_KINDS, overlayTemplates, isConnectTemplate } from '@cinegen/lib/overlays/overlays';
import { HyperframesPanel } from './hyperframes-modal';
import { MgTemplatesPanel } from './mg-templates-modal';

export interface AddToTimelineActions {
  onPickAnimation?: (item: HfItem) => void; // omitted when the HyperFrames flag is off
  onPickMotion: (t: MgTemplate) => void;
  onAddKind: (kind: OverlayKind) => void;
  onAddTemplate: (templateId: string, phone?: string) => void;
  onOpenSpeech?: () => void;
  onOpenGenerator?: () => void;
  onOpenPersonalization?: () => void;
}

type Tab = 'all' | 'animations' | 'motion' | 'speech' | 'overlays' | 'endscreens';
interface Entry { id: string; tab: Exclude<Tab, 'all' | 'animations' | 'motion'>; label: string; blurb: string; glyph: string; run: () => void }

const INK = 'rgba(229,237,245,.9)';
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'inherit', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '11px 12px', fontSize: 13 };
const KIND_GLYPH: Record<string, string> = { 'lead-form': '✉', 'list-builder': '☰', 'click-to-call': '☎', 'overlay-text': 'T', 'overlay-text-mask': 'Ⓣ', 'overlay-image': '▣', 'overlay-personalized-image': '◉', 'overlay-sticker': '★', 'overlay-background': '▨', 'overlay-lower-third': '▭' };

export function AddToTimelineModal({ onClose, actions }: { onClose: () => void; actions: AddToTimelineActions }) {
  const [tab, setTab] = useState<Tab>(actions.onPickAnimation ? 'animations' : 'motion');
  const [q, setQ] = useState('');
  const [connect, setConnect] = useState<string | null>(null); // Connect Form template waiting for its phone number
  const [phone, setPhone] = useState('');
  const a = actions;

  // Everything that is a single click lives in one list, so adding a feature later is one more entry here.
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    if (a.onOpenSpeech) list.push({ id: 'speech', tab: 'speech', label: 'Smart Speech', blurb: 'Turn text into a voiceover and place it on an audio track at the playhead.', glyph: '🎙', run: a.onOpenSpeech });
    if (a.onOpenGenerator) list.push({ id: 'generator', tab: 'speech', label: 'Template Generator', blurb: 'Generate a templated video or overlay from a prompt.', glyph: '✦', run: a.onOpenGenerator });
    if (a.onOpenPersonalization) list.push({ id: 'personalize', tab: 'speech', label: 'Personalization', blurb: 'Personalize the video for each contact.', glyph: '◉', run: a.onOpenPersonalization });
    for (const k of OVERLAY_KINDS) list.push({ id: k.kind, tab: 'overlays', label: k.label, blurb: k.blurb, glyph: KIND_GLYPH[k.kind] ?? '•', run: () => { a.onAddKind(k.kind); onClose(); } });
    for (const t of overlayTemplates()) {
      const isConnect = isConnectTemplate(t.id);
      list.push({ id: `tpl:${t.id}`, tab: 'endscreens', label: t.name, blurb: t.description, glyph: isConnect ? '☎' : '▶', run: () => { if (isConnect) { setConnect(t.id); setPhone(''); } else { a.onAddTemplate(t.id); onClose(); } } });
    }
    return list;
  }, [a, onClose]);

  const TABS: Array<{ id: Tab; label: string; glyph: string; count?: number; hidden?: boolean }> = [
    { id: 'all', label: 'All', glyph: '▦' },
    { id: 'animations', label: 'Animations', glyph: '✦', hidden: !a.onPickAnimation },
    { id: 'motion', label: 'Motion graphics', glyph: '✺' },
    { id: 'speech', label: 'Speech & AI', glyph: '🎙', count: entries.filter((e) => e.tab === 'speech').length },
    { id: 'overlays', label: 'Overlays & forms', glyph: '▭', count: entries.filter((e) => e.tab === 'overlays').length },
    { id: 'endscreens', label: 'End screens & connect forms', glyph: '▶', count: entries.filter((e) => e.tab === 'endscreens').length },
  ];

  const needle = q.trim().toLowerCase();
  const shown = entries.filter((e) => (tab === 'all' || e.tab === tab) && (!needle || `${e.label} ${e.blurb}`.toLowerCase().includes(needle)));
  const isPanel = tab === 'animations' || tab === 'motion';
  const pending = connect ? entries.find((e) => e.id === `tpl:${connect}`) : undefined;

  return (
    <div role="dialog" aria-label="Add to timeline" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: 16 }} onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <style>{'.add-card:hover{border-color:var(--accent)!important}'}</style>
      <div style={{ width: 'min(1480px, 96vw)', height: 'min(900px, 92vh)', display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', border: '1px solid var(--border-medium)', borderRadius: 26, color: INK, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '24px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 20 }}>＋</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Add to timeline</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, maxWidth: 720 }}>Animations, motion graphics, speech, overlays, forms and end screens. Click one to place it at the playhead, then edit it in the panel.</div>
          </div>
          <button aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'inherit', fontSize: 22, cursor: 'pointer', padding: 6 }}>×</button>
        </div>
        <div role="tablist" aria-label="Categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 20px 0' }}>
          {TABS.filter((t) => !t.hidden).map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-medium)'}`, color: on ? 'var(--accent)' : 'inherit', background: on ? 'var(--accent-dim)' : 'var(--bg-elevated)' }}>
                <span style={{ opacity: 0.8, fontSize: 12 }}>{t.glyph}</span>{t.label}
                {t.count !== undefined && <span style={{ minWidth: 22, height: 20, padding: '0 6px', borderRadius: 999, boxSizing: 'border-box', display: 'inline-grid', placeItems: 'center', fontSize: 11, background: on ? 'var(--accent-dim)' : 'var(--bg-overlay)' }}>{t.count}</span>}
              </button>
            );
          })}
        </div>
        {isPanel ? (
          // These two keep their own search, category and filter controls
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }}>
            {tab === 'animations' && a.onPickAnimation && <HyperframesPanel onPick={(i) => { a.onPickAnimation?.(i); onClose(); }} />}
            {tab === 'motion' && <div style={{ margin: '14px 20px 20px', display: 'flex', flexDirection: 'column', minHeight: 0 }}><MgTemplatesPanel onPick={(t) => { a.onPickMotion(t); onClose(); }} /></div>}
          </div>
        ) : (
          <div style={{ margin: '14px 20px 20px', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, background: 'var(--bg-base)' }}>
            <input type="text" autoFocus placeholder="⌕  Search overlays, forms, end screens, speech…" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...field, marginBottom: 12 }} />
            {tab === 'all' && !needle && <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 10 }}>Animations and Motion graphics have their own tabs with previews.</div>}
            {pending && (
              <form onSubmit={(e) => { e.preventDefault(); a.onAddTemplate(pending.id.slice(4), phone.trim() || undefined); onClose(); }}
                style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, padding: 12, border: '1px solid var(--accent)', borderRadius: 12, background: 'var(--accent-dim)' }}>
                <span style={{ fontSize: 13, flex: '0 0 auto' }}>Phone number the buttons should dial</span>
                <input type="tel" autoFocus placeholder="212 555 0147" aria-label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...field, flex: 1, padding: '8px 10px' }} />
                <button type="submit" style={{ padding: '8px 14px', borderRadius: 10, border: 0, background: 'var(--accent)', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                <button type="button" onClick={() => setConnect(null)} style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer' }}>Cancel</button>
              </form>
            )}
            <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start', paddingRight: 4, minHeight: 0 }}>
              {shown.map((e) => (
                <button key={e.id} className="add-card" onClick={e.run} data-testid={`add-${e.id}`}
                  style={{ textAlign: 'left', padding: 14, borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'inherit', cursor: 'pointer', display: 'flex', gap: 12 }}>
                  <span style={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 17 }}>{e.glyph}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{e.label}</span>
                    <span style={{ display: 'block', fontSize: 12, opacity: 0.65, marginTop: 3 }}>{e.blurb}</span>
                  </span>
                </button>
              ))}
              {!shown.length && <span style={{ fontSize: 13, opacity: 0.7 }}>Nothing matches your search.</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
