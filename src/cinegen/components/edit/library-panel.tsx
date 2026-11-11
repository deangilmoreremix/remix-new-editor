// [remix] Library: one browsable place for everything you can add to a timeline that is not your own media: motion-graphics
// templates, effects, transitions, colour looks (LUTs), overlays and forms (lead generator, CTA, text, stickers, end screens) and sound
// effects. It reuses the data and thumbnails of the existing browsers (MgTemplatesModal, OccLibraryModal, SoundLibraryPopup, the
// overlay lane's "Add overlay" menu); this panel only gathers them. Elements stay the four subject categories.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OverlayKind } from '@cinegen/types/workspace';
import { OVERLAY_KINDS, overlayTemplates } from '@cinegen/lib/overlays/overlays';
import { loadMgTemplates, type MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { buildAnimationCatalog, animationGroups, filterAnimations } from '@cinegen/lib/occ/animation-catalog';
import { GL_TRANSITION_ORDER, glTransitionLabel } from '@cinegen/lib/occ/transitions';
import { userLutIds } from '@cinegen/lib/occ/user-luts';
import { availableSounds, soundEffectSrc } from '@cinegen/lib/occ/sound-library';
import { SOUND_GROUPS, formatSoundDuration, type SoundEffect } from '../../../openchatcut/audio/soundLibrary';
import { ALL_FX, FX_IDS, LUT_IDS } from '../../../openchatcut/gl/fx/effects';
import { t } from '../../../openchatcut/i18n/t';
import { FxThumb } from '../../../openchatcut/library/FxThumb';
import { TransitionThumb } from '../../../openchatcut/library/TransitionThumb';
import { PreviewCleanupContext } from '../../../openchatcut/library/ResourcePreviewContext';
import { usePluginPacks, pluginResourceItems } from '../../../openchatcut/library/pluginResources';
import { getCustomTransition } from '../../../openchatcut/gl/customTransitions';
import '../../../openchatcut/library/library.css';

export type LibraryCategory = 'animations' | 'effects' | 'transitions' | 'looks' | 'overlays' | 'sounds';

export const LIBRARY_CATEGORIES: Array<{ id: LibraryCategory; label: string; hint: string }> = [
  { id: 'animations', label: 'Animations', hint: 'Animated titles, lower thirds and call-outs' },
  { id: 'effects', label: 'Effects', hint: 'Visual effects for the selected clip' },
  { id: 'transitions', label: 'Transitions', hint: 'How the selected clip changes into the next one' },
  { id: 'looks', label: 'Looks', hint: 'Colour grades (LUTs) for the selected clip' },
  { id: 'overlays', label: 'Overlays & forms', hint: 'Lead forms, buttons, text, stickers and end screens' },
  { id: 'sounds', label: 'Sounds', hint: 'Sound effects placed at the playhead' },
];

/** What happens when you click a card. A handler may return a short message to show (for example "Select a clip first"). */
export interface LibraryActions {
  onAddOverlay: (kind: OverlayKind) => string | void;
  onAddTemplate: (templateId: string) => string | void;
  onAddMg: (template: MgTemplate) => string | void;
  onApplyFx: (id: string) => string | void | Promise<string | void>;
  onApplyLut: (id: string) => string | void | Promise<string | void>;
  onApplyTransition: (id: string) => string | void | Promise<string | void>;
  onAddSound: (effect: SoundEffect) => string | void;
}

const card: React.CSSProperties = { textAlign: 'left', padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 };

export function LibraryPanel(actions: LibraryActions & { initialCategory?: LibraryCategory }) {
  const [cat, setCat] = useState<LibraryCategory>(actions.initialCategory ?? 'animations');
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const [mg, setMg] = useState<MgTemplate[] | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const noteTimer = useRef<number | undefined>(undefined);
  const packs = usePluginPacks();

  useEffect(() => { void loadMgTemplates().then(setMg); }, []);
  useEffect(() => () => { audio.current?.pause(); window.clearTimeout(noteTimer.current); }, []);

  const say = (m: string | void) => {
    if (!m) { setNote(''); return; }
    setNote(m);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(''), 4000);
  };
  const run = async (fn: () => string | void | Promise<string | void>) => { try { say(await fn()); } catch (e) { say(e instanceof Error ? e.message : 'That did not work.'); } };
  const match = (...parts: Array<string | undefined>) => !q.trim() || parts.filter(Boolean).join(' ').toLowerCase().includes(q.trim().toLowerCase());

  const fxIds = useMemo(() => [...FX_IDS, ...pluginResourceItems(packs, 'fx').map((i) => i.id)], [packs]);
  const lutIds = useMemo(() => [...LUT_IDS, ...userLutIds(), ...pluginResourceItems(packs, 'lut').map((i) => i.id)], [packs]);
  const trIds = useMemo(() => [...GL_TRANSITION_ORDER, ...pluginResourceItems(packs, 'transition').map((i) => i.id)], [packs]);
  const fxName = (id: string) => t(ALL_FX[id]?.name ?? id);
  const trName = (id: string) => (id.startsWith('plugin:') ? getCustomTransition(id)?.label ?? id : glTransitionLabel(id));
  const sounds = useMemo(() => availableSounds(), []);

  const play = (s: SoundEffect) => {
    audio.current?.pause();
    if (playing === s.id) { setPlaying(null); return; }
    const a = new Audio(soundEffectSrc(s.id));
    audio.current = a; setPlaying(s.id);
    a.onended = () => setPlaying(null);
    void a.play().catch(() => setPlaying(null));
  };

  const thumbGrid = (ids: string[], kind: 'fx' | 'tr', pick: (id: string) => void) => (
    <PreviewCleanupContext.Provider value={() => {}}>
      <div className="library-panel__grid">
        {ids.filter((id) => match(kind === 'tr' ? trName(id) : fxName(id))).map((id) => (
          <button key={id} className={`cc-resource-card${hover === id ? ' hovered' : ''}`} data-testid={`library-card-${id}`}
            onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onClick={() => void run(() => pick(id))}>
            <div className="cc-resource-thumb">
              {kind === 'tr' && !id.startsWith('plugin:') ? <TransitionThumb type={id as never} playing={hover === id} /> : kind === 'fx' ? <FxThumb assetId={id} playing={hover === id} /> : null}
            </div>
            <span className="cc-resource-name">{kind === 'tr' ? trName(id) : fxName(id)}</span>
          </button>
        ))}
      </div>
    </PreviewCleanupContext.Provider>
  );

  const body = () => {
    if (cat === 'animations') {
      const items = buildAnimationCatalog({ mg: mg ?? [] });
      const list = filterAnimations(items, group, q);
      return (
        <div className="library-panel__stack">
          <div className="library-panel__chips" role="tablist" aria-label="Animation groups">
            <button className={`library-panel__chip${group === null ? ' library-panel__chip--on' : ''}`} data-testid="library-group-everything" data-help="library group" onClick={() => setGroup(null)}>Everything</button>
            {animationGroups(items).map((g) => (
              <button key={g.group} className={`library-panel__chip${group === g.group ? ' library-panel__chip--on' : ''}`} data-testid={`library-group-${g.group}`} data-help="library group" onClick={() => setGroup(g.group)}>{g.group} <span style={{ opacity: 0.6 }}>{g.count}</span></button>
            ))}
          </div>
          <div className="library-panel__grid library-panel__grid--wide">
            {!mg && <span className="library-panel__empty">Loading…</span>}
            {mg && !list.length && <span className="library-panel__empty">No animations match.</span>}
            {list.map((x) => (
              <button key={x.id} style={card} title={x.description} data-testid={`library-mg-${x.id}`} onClick={() => void run(() => actions.onAddMg(x.mg))}>
                <strong style={{ fontSize: 12 }}>{x.name}</strong>
                <span style={{ fontSize: 10, opacity: 0.65 }}>{x.group} · {x.seconds.toFixed(1)}s</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (cat === 'effects') return thumbGrid(fxIds, 'fx', actions.onApplyFx);
    if (cat === 'looks') return thumbGrid(lutIds, 'fx', actions.onApplyLut);
    if (cat === 'transitions') return thumbGrid(trIds, 'tr', actions.onApplyTransition);
    if (cat === 'overlays') {
      const kinds = OVERLAY_KINDS.filter((k) => match(k.label, k.blurb));
      const tpls = overlayTemplates().filter((x) => match(x.name, x.description, x.library));
      return (
        <div className="library-panel__stack">
          <div className="library-panel__grid library-panel__grid--wide">
            {kinds.map((k) => (
              <button key={k.kind} style={card} title={k.blurb} data-testid={`library-overlay-${k.kind}`} onClick={() => void run(() => actions.onAddOverlay(k.kind))}>
                <strong style={{ fontSize: 12 }}>{k.label}</strong>
                <span style={{ fontSize: 10, opacity: 0.65 }}>{k.blurb}</span>
              </button>
            ))}
          </div>
          {tpls.length > 0 && <div className="library-panel__subhead">End screens and connect forms</div>}
          <div className="library-panel__grid library-panel__grid--wide">
            {tpls.map((x) => (
              <button key={x.id} style={card} title={x.description} data-testid={`library-template-${x.id}`} onClick={() => void run(() => actions.onAddTemplate(x.id))}>
                <strong style={{ fontSize: 12 }}>{x.name}</strong>
                <span style={{ fontSize: 10, opacity: 0.65 }}>{x.description}</span>
              </button>
            ))}
          </div>
          {!kinds.length && !tpls.length && <span className="library-panel__empty">No overlays match.</span>}
        </div>
      );
    }
    const list = sounds.filter((s) => match(s.name, s.desc, s.keywords.join(' '), SOUND_GROUPS.find((g) => g.id === s.group)?.nameEn));
    return (
      <div className="library-panel__stack">
        {list.map((s) => (
          <div key={s.id} className="library-panel__sound" data-testid={`library-sound-${s.id}`}>
            <span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</strong><span style={{ fontSize: 10, opacity: 0.65 }}>{formatSoundDuration(s.seconds)}</span></span>
            <button className="clip-properties-panel__toggle-btn" aria-label={`${playing === s.id ? 'Stop' : 'Play'} ${s.name}`} data-help="preview sound" onClick={() => play(s)}>{playing === s.id ? '■' : '▶'}</button>
            <button className="clip-properties-panel__toggle-btn" aria-label={`Add ${s.name}`} data-help="add sound to timeline" onClick={() => void run(() => actions.onAddSound(s))}>Add</button>
          </div>
        ))}
        {!list.length && <span className="library-panel__empty">No sounds match.</span>}
      </div>
    );
  };

  const active = LIBRARY_CATEGORIES.find((c) => c.id === cat)!;
  return (
    <div className="library-panel" data-testid="library-panel">
      <input className="library-panel__search" type="text" placeholder="Search the library…" aria-label="Search the library" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="library-panel__chips" role="tablist" aria-label="Library categories">
        {LIBRARY_CATEGORIES.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} data-testid={`library-cat-${c.id}`} className={`library-panel__chip${cat === c.id ? ' library-panel__chip--on' : ''}`} data-help={`library ${c.id}`} onClick={() => { setCat(c.id); setNote(''); }}>{c.label}</button>
        ))}
      </div>
      <div className="library-panel__hint">{active.hint}</div>
      {note && <div className="library-panel__note" role="status">{note}</div>}
      <div className="library-panel__body">{body()}</div>
    </div>
  );
}
