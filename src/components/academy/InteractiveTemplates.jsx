import { getTemplateRecipeId } from '../../data/academy/template-recipes/index.js';
// Interactive Academy templates + shared UI primitives.
// Each upstream Markdown template is rendered as a stateful editor that
// produces typed data and links to a SmartVideo recipe ("Create With Smart Video" or
// "Use Template"). Media is shown via the LEARN → SEE → CREATE flow.
import React, { useMemo, useState, useEffect } from 'react';
import { Markdown } from './Markdown.jsx';
import {
  ACADEMY_TEMPLATES,
  BLANK_UGC_SCRIPT,
  EXAMPLE_UGC_SCRIPT,
  BLANK_AD_BRIEF,
  EXAMPLE_AD_BRIEF,
  BLANK_CHARACTER_CHECKLIST,
  EXAMPLE_CHARACTER_CHECKLIST,
  BLANK_BATCH_MATRIX,
  EXAMPLE_BATCH_MATRIX,
  BLANK_TEARDOWN,
  EXAMPLE_TEARDOWN,
  BLANK_OUTREACH,
  EXAMPLE_OUTREACH,
  BLANK_RETAINER,
  EXAMPLE_RETAINER,
} from '../../data/academy/templates.js';
import { getAssetsForTemplate, getAssetById } from '../../data/academyAssets.js';
import { getRecipePrompt, executeRecipe } from '../../lib/recipes/executor.js';
import { openStyleInStudio } from '../../lib/examplesRail.js';
import { getAcademyStudioRoute } from '../../data/academy/studioRoutes.ts';
import { Icon } from './icons.jsx';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------
const inputCls =
  'w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/30';
const labelCls = 'block text-xs font-medium text-white/60 mb-1';
const cardCls = 'rounded-2xl border border-white/10 bg-white/[0.03] p-4';

function Field({ label, children }) {
  return (
    <label className="block">
      {label ? <span className={labelCls}>{label}</span> : null}
      {children}
    </label>
  );
}
function TextArea({ value, onChange, rows = 3, placeholder }) {
  return (
    <textarea
      className={inputCls + ' resize-y leading-relaxed'}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      className={inputCls}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
function PrimaryButton({ onClick, icon, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={
        'inline-flex items-center gap-2 rounded-xl bg-white text-neutral-900 font-semibold text-sm px-4 py-2 hover:bg-white/90 transition ' +
        className
      }
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
function GhostButton({ onClick, icon, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={
        'inline-flex items-center gap-2 rounded-xl border border-white/15 text-white text-sm px-4 py-2 hover:bg-white/5 transition ' +
        className
      }
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Asset gallery (SEE)
// ---------------------------------------------------------------------------
function AssetCard({ asset, onOpen }) {
  const isVideo = asset.type === 'video';
  return (
    <button
      onClick={() => onOpen(asset)}
      className="group block w-full text-left rounded-xl overflow-hidden border border-white/10 bg-black/30 hover:border-white/25 transition"
    >
      <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <video
            className="h-full w-full object-cover"
            src={asset.videoSrc}
            poster={asset.thumbnail}
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <img src={asset.src} alt={asset.title} className="h-full w-full object-cover" loading="lazy" />
        )}
        {isVideo ? (
          <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide bg-black/70 text-white px-2 py-0.5 rounded-full">
            Video
          </span>
        ) : null}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-medium text-white truncate">{asset.title}</p>
        <p className="text-[11px] text-white/50 line-clamp-2 mt-0.5">{asset.description}</p>
      </div>
    </button>
  );
}

// "Try this in Studio" — stages a studio prefill from the asset's title /
// description and navigates to the mapped studio (per ACADEMY_STUDIO_ROUTES).
// Uses the same `openStyleInStudio` → `stageStudioPrefill` → `navigate` channel
// the MiniMax examples rail relies on.
function TryInStudioButton({ asset }) {
  const target = getAcademyStudioRoute(asset.category);
  const route = target?.route || 'image';
  const studioName = target?.studio || 'Studio';
  const onClick = () => {
    openStyleInStudio({
      prompt: `${asset.title}. ${asset.description || ''}`.trim(),
      route,
      model: target?.model,
      params: { _sourceSlug: asset.id, _sourceTitle: asset.title },
      ref: 'academy',
    });
  };
  return (
    <PrimaryButton onClick={onClick} icon="Sparkles">
      Try this in {studioName}
    </PrimaryButton>
  );
}

function Lightbox({ asset, onClose }) {
  if (!asset) return null;
  const isVideo = asset.type === 'video';
  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button className="absolute top-4 right-4 text-white/70 hover:text-white" aria-label="Close">
        <Icon name="X" size={24} />
      </button>
      <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video src={asset.videoSrc} poster={asset.thumbnail} controls autoPlay className="w-full rounded-xl" />
        ) : (
          <img src={asset.src} alt={asset.title} className="w-full rounded-xl" />
        )}
        <p className="text-white text-sm mt-3">{asset.title}</p>
        <p className="text-white/50 text-xs mt-1">{asset.description}</p>
        <div className="mt-3">
          <TryInStudioButton asset={asset} />
        </div>
      </div>
    </div>
  );
}

function AssetGallery({ assetIds }) {
  const [active, setActive] = useState(null);
  const assets = useMemo(
    () => (assetIds || []).map(getAssetById).filter(Boolean),
    [assetIds]
  );
  if (!assets.length) {
    return <p className="text-sm text-white/40">No example media for this item.</p>;
  }
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {assets.map((a) => (
          <AssetCard key={a.id} asset={a} onOpen={setActive} />
        ))}
      </div>
      <Lightbox asset={active} onClose={() => setActive(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recipe action buttons
// ---------------------------------------------------------------------------
function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

function CreateWithAIButton({ recipeId, buildContext, label = 'Create With Smart Video' }) {
  const [prompt, setPrompt] = useState(null);
  const recipe = ACADEMY_TEMPLATES.find((t) => t.recipeId === recipeId);
  const onOpen = () => setPrompt(getRecipePrompt(recipeId, buildContext()));
  const onLaunch = () => {
    executeRecipe(recipeId, buildContext());
  };
  return (
    <>
      <PrimaryButton onClick={onOpen} icon="Sparkles">
        {label}
      </PrimaryButton>
      {prompt !== null ? (
        <div
          className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPrompt(null)}
        >
          <div className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className={cardCls + ' p-0 overflow-hidden'}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Icon name="Sparkles" size={16} /> {recipe ? recipe.title : 'Recipe'} — brief
                </p>
                <button className="text-white/50 hover:text-white" onClick={() => setPrompt(null)}>
                  <Icon name="X" size={18} />
                </button>
              </div>
              <pre className="text-xs text-white/80 whitespace-pre-wrap p-4 max-h-[50vh] overflow-auto font-mono">
                {prompt}
              </pre>
              <div className="flex gap-2 px-4 py-3 border-t border-white/10">
                <GhostButton onClick={() => copyText(prompt)} icon="Copy">
                  Copy brief
                </GhostButton>
                <PrimaryButton onClick={onLaunch} icon="ArrowRight">
                  Open in Studio
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function UseTemplateButton({ buildText, label = 'Use Template' }) {
  const [done, setDone] = useState(false);
  return (
    <GhostButton
      icon="ClipboardList"
      onClick={() => {
        copyText(buildText());
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? 'Copied!' : label}
    </GhostButton>
  );
}

function ExampleToggle({ useExample, setUseExample, label = 'Show example' }) {
  return (
    <GhostButton icon="FileText" onClick={() => setUseExample((v) => !v)}>
      {useExample ? 'Clear example' : label}
    </GhostButton>
  );
}

// ---------------------------------------------------------------------------
// 1. UGC Script Builder
// ---------------------------------------------------------------------------
function UGCScriptBuilder({ meta }) {
  const [useExample, setUseExample] = useState(false);
  const data = useExample ? EXAMPLE_UGC_SCRIPT : BLANK_UGC_SCRIPT;
  const [local, setLocal] = useState(BLANK_UGC_SCRIPT);
  const d = useExample ? EXAMPLE_UGC_SCRIPT : local;
  const set = (patch) => setLocal((p) => ({ ...p, ...patch }));
  const setBeat = (key, patch) => setLocal((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
  const toggleCheck = (id) =>
    setLocal((p) => ({
      ...p,
      checklist: p.checklist.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)),
    }));

  const buildContext = () => ({ script: useExample ? EXAMPLE_UGC_SCRIPT : local });
  const buildText = () =>
    [
      `Product: ${d.product}`,
      `Target length: ${d.targetLength}`,
      '',
      `HOOK (${d.hook.timing}): ${d.hook.line}`,
      `PROBLEM/PITCH (${d.problemPitch.timing}): ${d.problemPitch.line}`,
      `PROOF/DEMO (${d.proofDemo.timing}): ${d.proofDemo.line}`,
      `CTA (${d.cta.timing}): ${d.cta.line}`,
    ].join('\n');

  const beats = [
    { key: 'hook', title: 'Hook', hint: 'A question, bold claim, or visual surprise. Be specific.' },
    { key: 'problemPitch', title: 'Problem / Pitch', hint: 'Name a specific competing failure, said like a friend.' },
    { key: 'proofDemo', title: 'Proof / Demo', hint: 'A concrete number or detail beats an adjective.' },
    { key: 'cta', title: 'Call To Action', hint: 'One clear next step; state price if it is a strength.' },
  ];

  return (
    <div className="space-y-4">
      <Field label="Product">
        <TextInput value={d.product} onChange={(v) => set({ product: v })} placeholder="e.g. GripMount — magnetic phone car mount" />
      </Field>
      <Field label="Target length">
        <TextInput value={d.targetLength} onChange={(v) => set({ targetLength: v })} />
      </Field>

      {beats.map((b) => (
        <div key={b.key} className={cardCls}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-white">{b.title}</p>
            <span className="text-[11px] text-white/40">{d[b.key].timing}</span>
          </div>
          <p className="text-[11px] text-white/40 mb-2">{b.hint}</p>
          <TextArea
            rows={2}
            value={d[b.key].line}
            onChange={(v) => setBeat(b.key, { line: v })}
            placeholder="Write the line…"
          />
        </div>
      ))}

      <div className={cardCls}>
        <p className="text-sm font-semibold text-white mb-2">Pre-ship checklist</p>
        <div className="space-y-2">
          {d.checklist.map((c) => (
            <label key={c.id} className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={c.checked}
                onChange={() => toggleCheck(c.id)}
                className="mt-0.5 accent-white"
              />
              <span className="text-xs text-white/70">{c.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CreateWithAIButton recipeId="create-ugc-ad" buildContext={buildContext} />
        <UseTemplateButton buildText={buildText} />
        <ExampleToggle useExample={useExample} setUseExample={setUseExample} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Ad Brief Form
// ---------------------------------------------------------------------------
function AdBriefForm({ meta }) {
  const [useExample, setUseExample] = useState(false);
  const [local, setLocal] = useState(BLANK_AD_BRIEF);
  const d = useExample ? EXAMPLE_AD_BRIEF : local;
  const set = (patch) => setLocal((p) => ({ ...p, ...patch }));
  const buildContext = () => ({ brief: useExample ? EXAMPLE_AD_BRIEF : local });
  const buildText = () =>
    [
      'AD BRIEF',
      `Product/service: ${d.product}`,
      `Platform(s) / aspect: ${d.platforms}`,
      `Variants needed: ${d.variants}`,
      `Tone: ${d.tone}`,
      `Constraints: ${d.constraints}`,
      `Assets available: ${d.assets}`,
      `Deadline / revisions: ${d.deadline}`,
    ].join('\n');

  const fields = [
    { key: 'product', label: 'Product / service' },
    { key: 'platforms', label: 'Target platform(s) / aspect ratio' },
    { key: 'variants', label: 'Number of variants needed' },
    { key: 'tone', label: 'Tone' },
    { key: 'constraints', label: 'Brand / legal constraints' },
    { key: 'assets', label: 'Existing brand assets' },
    { key: 'deadline', label: 'Deadline / revision rounds' },
  ];

  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <Field key={f.key} label={f.label}>
          <TextInput value={d[f.key]} onChange={(v) => set({ [f.key]: v })} placeholder={f.label} />
        </Field>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <CreateWithAIButton recipeId="ai-campaign-planner" buildContext={buildContext} />
        <UseTemplateButton buildText={buildText} />
        <ExampleToggle useExample={useExample} setUseExample={setUseExample} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Character Consistency Checklist
// ---------------------------------------------------------------------------
function CharacterConsistencyChecker({ meta }) {
  const [useExample, setUseExample] = useState(false);
  const d = useExample ? EXAMPLE_CHARACTER_CHECKLIST : BLANK_CHARACTER_CHECKLIST;
  const [local, setLocal] = useState(BLANK_CHARACTER_CHECKLIST);
  const view = useExample ? EXAMPLE_CHARACTER_CHECKLIST : local;
  const setShot = (i, v) =>
    setLocal((p) => {
      const shots = [...p.shots];
      shots[i] = v;
      return { ...p, shots };
    });
  const buildContext = () => ({ character: view.character });
  const buildText = () => {
    const rows = view.shots
      .map(
        (shot) =>
          `• ${shot}: ` +
          view.items.map((it) => `${it.label}=${view.example?.[shot]?.[it.id] || '—'}`).join('; ')
      )
      .join('\n');
    return `CHARACTER CONSISTENCY CHECK\nCharacter: ${view.character}\n${rows}`;
  };

  return (
    <div className="space-y-4">
      <Field label="Anchor character description">
        <TextArea
          rows={2}
          value={view.character}
          onChange={(v) => setLocal((p) => ({ ...p, character: v }))}
          placeholder="e.g. woman, late 20s, brown hair, freckles, front-facing neutral light"
        />
      </Field>

      <div className={cardCls}>
        <p className="text-sm font-semibold text-white mb-2">Drift check — per shot</p>
        <div className="space-y-2">
          {view.shots.map((shot, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-white/60 w-28 shrink-0">Shot {i + 1}</span>
              <TextInput value={shot} onChange={(v) => setShot(i, v)} placeholder="e.g. Car interior" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {view.items.map((it) => (
          <div key={it.id} className={cardCls + ' py-3'}>
            <p className="text-sm text-white font-medium">{it.label}</p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {view.shots.map((shot) => (
                <div key={shot} className="text-xs">
                  <span className="text-white/40">{shot}: </span>
                  <span className="text-white/80">
                    {useExample ? view.example?.[shot]?.[it.id] || '—' : 'pass / fail'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CreateWithAIButton recipeId="create-consistent-character" buildContext={buildContext} label="Create Consistent Character" />
        <UseTemplateButton buildText={buildText} />
        <ExampleToggle useExample={useExample} setUseExample={setUseExample} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Batch Matrix Builder
// ---------------------------------------------------------------------------
function BatchMatrixBuilder({ meta }) {
  const [useExample, setUseExample] = useState(false);
  const [local, setLocal] = useState(BLANK_BATCH_MATRIX);
  const d = useExample ? EXAMPLE_BATCH_MATRIX : local;
  const set = (patch) => setLocal((p) => ({ ...p, ...patch }));
  const setRow = (id, patch) =>
    setLocal((p) => ({ ...p, rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const addRow = () =>
    setLocal((p) => ({
      ...p,
      rows: [...p.rows, { id: `ad-${p.rows.length + 1}-${Date.now()}`, hook: '', angle: '', notes: '' }],
    }));
  const removeRow = (id) => setLocal((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== id) }));
  const buildContext = () => ({ matrix: useExample ? EXAMPLE_BATCH_MATRIX : local });
  const buildText = () =>
    [
      `Product: ${d.product}`,
      `Constants: ${d.constants}`,
      '',
      ...d.rows.map((r, i) => `Ad ${i + 1}: hook="${r.hook}" | angle=${r.angle}${r.notes ? ` | ${r.notes}` : ''}`),
    ].join('\n');

  return (
    <div className="space-y-4">
      <Field label="Product">
        <TextInput value={d.product} onChange={(v) => set({ product: v })} placeholder="e.g. GripMount — $28 magnetic phone car mount" />
      </Field>
      <Field label="Constants (held across every ad)">
        <TextInput value={d.constants} onChange={(v) => set({ constants: v })} />
      </Field>

      <div className="space-y-3">
        {d.rows.map((row, i) => (
          <div key={row.id} className={cardCls}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">Ad {i + 1}</p>
              <button
                className="text-white/40 hover:text-white text-xs"
                onClick={() => removeRow(row.id)}
                disabled={d.rows.length <= 1}
              >
                Remove
              </button>
            </div>
            <div className="space-y-2">
              <Field label="Hook angle">
                <TextArea rows={2} value={row.hook} onChange={(v) => setRow(row.id, { hook: v })} placeholder="Opening line / angle" />
              </Field>
              <Field label="Selling angle">
                <TextInput value={row.angle} onChange={(v) => setRow(row.id, { angle: v })} placeholder="e.g. Problem-first" />
              </Field>
              <Field label="Notes">
                <TextInput value={row.notes} onChange={(v) => setRow(row.id, { notes: v })} placeholder="What this variant tests" />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <GhostButton icon="Plus" onClick={addRow}>
        Add ad row
      </GhostButton>

      <div className="flex flex-wrap items-center gap-2">
        <CreateWithAIButton recipeId="create-ugc-campaign" buildContext={buildContext} />
        <UseTemplateButton buildText={buildText} />
        <ExampleToggle useExample={useExample} setUseExample={setUseExample} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Teardown Worksheet
// ---------------------------------------------------------------------------
function TeardownWorksheet({ meta }) {
  const [useExample, setUseExample] = useState(false);
  const [local, setLocal] = useState(BLANK_TEARDOWN);
  const d = useExample ? EXAMPLE_TEARDOWN : local;
  const set = (patch) => setLocal((p) => ({ ...p, ...patch }));
  const setLayer = (id, patch) =>
    setLocal((p) => ({
      ...p,
      layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  const buildContext = () => ({ teardown: true });
  const buildText = () =>
    [
      `CATEGORY: ${d.category}`,
      `LONGEVITY (signal): ${d.longevity}`,
      '',
      ...d.layers.map((l) => `${l.label.toUpperCase()}\n  What: ${l.whatDone}\n  Why: ${l.why}`),
      '',
      `TAKEAWAY: ${d.takeaway}`,
    ].join('\n');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Ad category / product type">
          <TextInput value={d.category} onChange={(v) => set({ category: v })} placeholder="e.g. Skincare serum" />
        </Field>
        <Field label="How long running (longevity signal)">
          <TextInput value={d.longevity} onChange={(v) => set({ longevity: v })} placeholder="e.g. 47 days, 6 variants" />
        </Field>
      </div>

      <div className="space-y-3">
        {d.layers.map((l) => (
          <div key={l.id} className={cardCls}>
            <p className="text-sm font-semibold text-white mb-2">{l.label}</p>
            <div className="space-y-2">
              <Field label="What was done">
                <TextArea rows={2} value={l.whatDone} onChange={(v) => setLayer(l.id, { whatDone: v })} />
              </Field>
              <Field label="Why it might work">
                <TextArea rows={2} value={l.why} onChange={(v) => setLayer(l.id, { why: v })} />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <Field label="Structural takeaway (reusable for a different product)">
        <TextArea rows={2} value={d.takeaway} onChange={(v) => set({ takeaway: v })} />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <UseTemplateButton buildText={buildText} />
        <CreateWithAIButton recipeId="ai-campaign-planner" buildContext={buildContext} label="Plan With Smart Video" />
        <ExampleToggle useExample={useExample} setUseExample={setUseExample} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Outreach Composer
// ---------------------------------------------------------------------------
function OutreachComposer({ meta }) {
  const [useExample, setUseExample] = useState(false);
  const [local, setLocal] = useState(BLANK_OUTREACH);
  const d = useExample ? EXAMPLE_OUTREACH : local;
  const set = (patch) => setLocal((p) => ({ ...p, ...patch }));
  const buildText = () => {
    const link = d.link || '[link to sample ad]';
    return [
      `Subject: A quick ad concept for ${d.brand || '[Brand]'}`,
      '',
      `Hi ${d.name || '[Name]'},`,
      '',
      `I put together a quick AI-generated UGC-style ad for ${d.brand || '[Brand]'}'s ${d.product || '[product]'} — thought it might be useful for testing a new angle. ${link}`,
      '',
      `If it's a fit, I can produce a full batch of variants (different hooks/angles) for testing — turnaround is usually ${d.days || 'X'} days.`,
      '',
      'Happy to share more examples if useful.',
      '',
      `— ${d.yourName || '[Your name]'}`,
    ].join('\n');
  };
  const fields = [
    { key: 'brand', label: 'Brand' },
    { key: 'name', label: 'Contact name' },
    { key: 'product', label: 'Product' },
    { key: 'link', label: 'Sample ad link' },
    { key: 'days', label: 'Turnaround (days)' },
    { key: 'yourName', label: 'Your name' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            <TextInput value={d[f.key]} onChange={(v) => set({ [f.key]: v })} />
          </Field>
        ))}
      </div>
      <div className={cardCls}>
        <p className="text-xs font-medium text-white/60 mb-2">Preview</p>
        <pre className="text-xs text-white/80 whitespace-pre-wrap font-mono">{buildText()}</pre>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <UseTemplateButton buildText={buildText} />
        <ExampleToggle useExample={useExample} setUseExample={setUseExample} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Retainer Proposal
// ---------------------------------------------------------------------------
function RetainerProposal({ meta }) {
  const [useExample, setUseExample] = useState(false);
  const [local, setLocal] = useState(BLANK_RETAINER);
  const d = useExample ? EXAMPLE_RETAINER : local;
  const set = (patch) => setLocal((p) => ({ ...p, ...patch }));
  const buildText = () =>
    [
      `CLIENT: ${d.client}`,
      `SCOPE: ${d.scope}`,
      `PRICE: ${d.price}`,
      `INCLUDES: ${d.includes}`,
      `TURNAROUND: ${d.turnaround}`,
      `TERM: ${d.term}`,
      '',
      `WHY THIS WORKS: ${d.why}`,
    ].join('\n');
  const fields = [
    { key: 'client', label: 'Client' },
    { key: 'scope', label: 'Scope' },
    { key: 'price', label: 'Price' },
    { key: 'includes', label: 'Includes' },
    { key: 'turnaround', label: 'Turnaround' },
    { key: 'term', label: 'Term' },
    { key: 'why', label: 'Why this works', textarea: true },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.textarea ? (
              <TextArea rows={3} value={d[f.key]} onChange={(v) => set({ [f.key]: v })} />
            ) : (
              <TextInput value={d[f.key]} onChange={(v) => set({ [f.key]: v })} />
            )}
          </Field>
        ))}
      </div>
      <div className={cardCls}>
        <p className="text-xs font-medium text-white/60 mb-2">Preview</p>
        <pre className="text-xs text-white/80 whitespace-pre-wrap font-mono">{buildText()}</pre>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <UseTemplateButton buildText={buildText} />
        <ExampleToggle useExample={useExample} setUseExample={setUseExample} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template editor (LEARN / SEE / CREATE)
// ---------------------------------------------------------------------------
const EDITORS = {
  'ugc-script': UGCScriptBuilder,
  'ad-brief': AdBriefForm,
  'character-consistency-checklist': CharacterConsistencyChecker,
  'batch-matrix': BatchMatrixBuilder,
  teardown: TeardownWorksheet,
  outreach: OutreachComposer,
  retainer: RetainerProposal,
};

export function TemplateEditor({ meta, onOpenLesson }) {
  const [tab, setTab] = useState('build');
  const Editor = EDITORS[meta.kind];
  const tabs = [
    { id: 'build', label: 'Create', icon: 'Sparkles' },
    { id: 'see', label: 'See', icon: 'Eye' },
    { id: 'learn', label: 'Learn', icon: 'BookOpen' },
  ];
  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/40">{meta.kind.replace(/-/g, ' ')}</p>
          <h2 className="text-xl font-bold text-white">{meta.title}</h2>
          <p className="text-sm text-white/60 mt-1">{meta.description}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/10 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              'flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ' +
              (tab === t.id
                ? 'border-white text-white'
                : 'border-transparent text-white/50 hover:text-white')
            }
          >
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'build' ? (Editor ? <Editor meta={meta} /> : <GenericTemplateDoc meta={meta} onOpenLesson={onOpenLesson} />) : null}
      {tab === 'see' ? (
        <div>
          <p className="text-sm text-white/60 mb-3">Example media from this template's lesson.</p>
          <AssetGallery assetIds={meta.assetIds} />
        </div>
      ) : null}
      {tab === 'learn' ? (
        <div className={cardCls}>
          <p className="text-sm text-white/70 mb-3">
            This template comes from the lesson below. Review the concept, then come back to Create.
          </p>
          <GhostButton icon="BookOpen" onClick={() => onOpenLesson(meta.lessonId)}>
            Open linked lesson
          </GhostButton>
        </div>
      ) : null}
    </div>
  );
}

// Generic document view for the 70 non-UGC templates imported from the other
// 14 tracks. Renders the raw Markdown and offers Use Template / Create With AI.
function GenericTemplateDoc({ meta, onOpenLesson }) {
  const copyRaw = () => {
    fetch(meta.rawPath)
      .then((r) => r.text())
      .then((t) => copyText(t))
      .catch(() => {});
  };
  return (
    <div className="space-y-3">
      <div className={cardCls + ' max-h-[60vh] overflow-auto'}>
        <Markdown rawPath={meta.rawPath} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {getTemplateRecipeId(meta.id) ? (
          <CreateWithAIButton recipeId={getTemplateRecipeId(meta.id)} buildContext={() => ({})} label="Create With Smart Video" />
        ) : null}
        <GhostButton icon="ClipboardList" onClick={copyRaw}>
          Use Template
        </GhostButton>
        {meta.lessonId ? (
          <GhostButton icon="BookOpen" onClick={() => onOpenLesson && onOpenLesson(meta.lessonId)}>
            Open linked lesson
          </GhostButton>
        ) : null}
      </div>
    </div>
  );
}

export { AssetGallery };
