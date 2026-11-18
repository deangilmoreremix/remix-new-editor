/**
 * "Storyboard" side panel (CineGen Director / Storyboarder / Shot Board /
 * Elements) for the Timeline Editor.
 *
 *   Storyboard  idea or scene → shot cards → Images 2.6 frames → optional
 *               MuAPI animation → placed on the timeline
 *   Script      import .fountain / .fdx / .txt → scenes, beat sheet, shot list
 *   Shot Board  9 camera angles of a frame (Images 2.6 edits)
 *   Elements    characters / locations / props / vehicles with reference images
 *
 * Text AI: OpenAI Responses API; images: OpenAI Images 2.6 — both on the
 * user's own OpenAI key. Video (animate) is the only MuAPI step.
 */
import * as sb from './storyboard.js';
import * as els from './elementsStore.js';
import { runLlm } from './timelineLlm.js';
import { OPENAI_IMAGE_MODELS, DEFAULT_IMAGE_MODEL } from './openaiImages.js';
import { importScript, serializeScreenplay, sceneCharacters } from '../director/screenplay.js';
import { IMAGE_TO_VIDEO_MODELS, DEFAULT_IMAGE_TO_VIDEO_MODEL } from '../../muapi/frameModels.js';
import { defaultCaptionStyle } from '../remotion/captions.js';
import * as lb from './lookBible.js';
import { frameAtPlayhead } from '../ml/aiActions.js';
import { canvasToBlob } from '../ml/frameGrab.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const opts = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
const price = (m) => `$${m.costUsd < 0.1 ? m.costUsd.toFixed(3).replace(/0$/, '') : m.costUsd.toFixed(2)}`;

/**
 * @param {HTMLElement} container
 * @param {object} opts { editor (aiActions contract + insertClip), llm?, confirm? }
 */
export function renderStoryboardPanel(container, { editor, llm = runLlm } = {}) {
  const ui = {
    tab: 'storyboard',
    idea: '', style: '', count: 6, aspect: '16:9', imageModel: DEFAULT_IMAGE_MODEL, videoModel: DEFAULT_IMAGE_TO_VIDEO_MODEL,
    title: '', shots: [],
    script: null, beats: null, shotlists: {},
    boardRef: null, board: [], boardNote: '',
    elements: [], editing: null,
    look: lb.loadLook(), breakdown: null, breakdownItems: [],
    busy: '', error: '', controller: null,
  };

  const setBusy = (t) => {
    ui.busy = t;
    const st = container.querySelector('[data-sb-status]');
    if (st && t) st.textContent = t; else draw();
  };

  async function task(label, fn) {
    if (ui.busy) return;
    ui.error = '';
    ui.controller = new AbortController();
    setBusy(`${label}…`);
    try {
      await fn(ui.controller.signal);
    } catch (err) {
      if (err?.name !== 'AbortError') { ui.error = err?.message || String(err); editor.toast?.(`${label} failed: ${ui.error}`, 'error'); }
    } finally {
      ui.busy = '';
      ui.controller = null;
      if (container.isConnected) draw();
    }
  }

  // ------------------------------------------------------------------ views
  const tabs = [['storyboard', '🎞️ Storyboard'], ['script', '📜 Script'], ['board', '🎥 Shot Board'], ['elements', '👤 Elements']];

  const viewStoryboard = () => `
    <p class="addon-field__hint">Plan shots with OpenAI, make each frame with Images 2.6 (your OpenAI key), then place them on the timeline. Use <strong>@Name</strong> to bring in an Element.</p>
    <textarea data-sb="idea" rows="4" placeholder="An idea, a script or a scene… e.g. '@Maya finds a glowing map in her grandmother's attic'" style="width:100%">${esc(ui.idea)}</textarea>
    <label class="cap-row"><span>Style</span><input data-sb="style" value="${esc(ui.style)}" placeholder="e.g. warm 35mm film, golden hour"/></label>
    <details class="ai-local-group" ${ui.look.genre || ui.look.references.length || ui.look.notes ? 'open' : ''}>
      <summary>Look Bible${lb.lookStyle(ui.look) ? ' ✓' : ''}</summary>
      <label class="cap-row"><span>Genre</span><select data-look="genre">${opts(lb.LOOK_GENRES.map((g) => [g, g || '—']), ui.look.genre)}</select></label>
      <label class="cap-row"><span>Film refs</span><input data-look="references" value="${esc(ui.look.references.join(', '))}" placeholder="e.g. Blade Runner, Heat"/></label>
      <textarea data-look="notes" rows="2" placeholder="Visual style, mood, pacing notes…" style="width:100%">${esc(ui.look.notes)}</textarea>
      ${ui.look.palette.length || ui.look.lens ? `<p class="addon-field__hint">Palette: ${esc(ui.look.palette.join(', '))}${ui.look.lens ? ` · ${esc(ui.look.lens)}` : ''}</p>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="mini-btn" data-act="look-expand" ${ui.busy ? 'disabled' : ''}>Rewrite with AI</button>
        <button type="button" class="mini-btn" data-act="look-board" ${ui.busy ? 'disabled' : ''}>Mood board (3 stills)</button>
      </div>
      ${ui.look.moodboard.length ? `<div style="display:flex;gap:4px;margin-top:4px">${ui.look.moodboard.map((u) => `<img src="${esc(u)}" alt="Mood board still" style="width:32%;border-radius:4px"/>`).join('')}</div>` : ''}
      <p class="addon-field__hint">The look is added to every frame prompt.</p>
    </details>
    <div class="cap-row"><span>Shots</span><input data-sb="count" type="number" min="3" max="12" value="${ui.count}" style="width:60px"/>
      <span>Aspect</span><select data-sb="aspect">${opts([['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1']], ui.aspect)}</select></div>
    <label class="cap-row"><span>Frames</span><select data-sb="imageModel">${opts(OPENAI_IMAGE_MODELS, ui.imageModel)}</select></label>
    <button type="button" class="mini-btn cap-primary" data-act="plan" ${ui.busy ? 'disabled' : ''}>Plan shots (OpenAI)</button>
    ${ui.shots.length ? `
      <h4 class="addon-panel__heading">${esc(ui.title || 'Shots')}</h4>
      <ol class="sb-shots" style="padding-left:18px">${ui.shots.map((s, i) => `
        <li class="sb-shot" data-i="${i}" style="margin-bottom:10px">
          <div style="display:flex;gap:8px;align-items:flex-start">
            ${s.clipUrl ? `<video src="${esc(s.clipUrl)}" muted loop playsinline style="width:96px;border-radius:4px"></video>`
              : s.frameUrl ? `<img src="${esc(s.frameUrl)}" alt="" style="width:96px;border-radius:4px"/>` : '<div style="width:96px;height:54px;background:rgba(255,255,255,.06);border-radius:4px"></div>'}
            <div style="flex:1;min-width:0">
              <input data-shot="title" data-i="${i}" value="${esc(s.title)}" style="width:100%;font-weight:600"/>
              <input data-shot="camera" data-i="${i}" value="${esc(s.camera)}" placeholder="Camera" style="width:100%"/>
              <textarea data-shot="prompt" data-i="${i}" rows="2" style="width:100%">${esc(s.prompt)}</textarea>
              <input data-shot="dialogue" data-i="${i}" value="${esc(s.dialogue)}" placeholder="Dialogue (optional)" style="width:100%"/>
              <div style="display:flex;gap:4px"><input data-shot="note" data-i="${i}" value="${esc(s.note || '')}" placeholder="Director note, e.g. 'make it dusk'" style="flex:1;min-width:0"/>
                <button type="button" class="mini-btn" data-act="rewrite" data-i="${i}" ${ui.busy ? 'disabled' : ''}>Rewrite</button></div>
              ${s.proposal ? `<div class="addon-field__hint" style="border:1px solid var(--border,rgba(255,255,255,.15));padding:4px;border-radius:4px">Proposed: ${esc(s.proposal.prompt)}
                <button type="button" class="mini-btn cap-primary" data-act="keep-rewrite" data-i="${i}">Keep</button>
                <button type="button" class="mini-btn" data-act="discard-rewrite" data-i="${i}">Discard</button></div>` : ''}
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input data-shot="duration" data-i="${i}" type="number" min="1" max="15" step="0.5" value="${s.duration}" style="width:60px"/> s
                <button type="button" class="mini-btn" data-act="frame" data-i="${i}" ${ui.busy ? 'disabled' : ''}>${s.frameUrl ? 'Redo frame' : 'Make frame'}</button>
                ${s.frameUrl ? `<button type="button" class="mini-btn" data-act="animate" data-i="${i}" ${ui.busy ? 'disabled' : ''}>Animate (MuAPI)</button>` : ''}
                <button type="button" class="mini-btn" data-act="remove-shot" data-i="${i}" aria-label="Remove shot">✕</button>
              </div>
            </div>
          </div>
        </li>`).join('')}</ol>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="mini-btn" data-act="add-shot">+ Shot</button>
        <button type="button" class="mini-btn" data-act="frames" ${ui.busy ? 'disabled' : ''}>Make all frames</button>
        <select data-sb="videoModel" aria-label="Animation model">${Object.entries(IMAGE_TO_VIDEO_MODELS).map(([id, m]) => `<option value="${id}" ${id === ui.videoModel ? 'selected' : ''}>${esc(m.label)} · ${price(m)}/clip</option>`).join('')}</select>
        <button type="button" class="mini-btn" data-act="animate-all" ${ui.busy ? 'disabled' : ''}>Animate all (MuAPI)</button>
        <button type="button" class="mini-btn cap-primary" data-act="place" ${ui.busy ? 'disabled' : ''}>Place on timeline</button>
      </div>` : ''}`;

  const viewScript = () => `
    <p class="addon-field__hint">Import a screenplay (.fountain, .fdx, .txt, .md) or paste one below.</p>
    <input type="file" data-sb="file" accept=".fountain,.fdx,.txt,.md,text/plain"/>
    <textarea data-sb="scriptText" rows="5" placeholder="INT. KITCHEN - NIGHT …" style="width:100%">${esc(ui.script?.text || '')}</textarea>
    <button type="button" class="mini-btn" data-act="parse">Read script</button>
    ${ui.script ? `
      <h4 class="addon-panel__heading">${ui.script.scenes.length} scene(s)</h4>
      <ol style="padding-left:18px">${ui.script.scenes.map((sc, i) => `
        <li style="margin-bottom:8px"><strong>${esc(sc.heading || 'Opening')}</strong>
          <div class="addon-field__hint">${esc(sceneCharacters(sc).join(', ') || 'No characters')} · ${sc.elements.length} lines</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="mini-btn" data-act="to-storyboard" data-i="${i}">Send to Storyboard</button>
            <button type="button" class="mini-btn" data-act="shotlist" data-i="${i}" ${ui.busy ? 'disabled' : ''}>Shot list (AI)</button>
          </div>
          ${ui.shotlists[i] ? `<table class="chat-table"><thead><tr><th>Shot</th><th>Camera</th><th>Action</th><th>s</th></tr></thead><tbody>${ui.shotlists[i].map((r) => `<tr><td>${esc(r.shot)}</td><td>${esc(r.camera)}</td><td>${esc(r.description)}</td><td>${r.duration}</td></tr>`).join('')}</tbody></table>` : ''}
        </li>`).join('')}</ol>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="mini-btn" data-act="breakdown" ${ui.busy ? 'disabled' : ''}>Breakdown (AI)</button>
        <button type="button" class="mini-btn" data-act="beats" ${ui.busy ? 'disabled' : ''}>Beat sheet (AI)</button>
        <button type="button" class="mini-btn" data-act="cast" ${ui.busy ? 'disabled' : ''}>Add characters as Elements</button>
      </div>
      ${ui.breakdownItems.length ? `<h4 class="addon-panel__heading">Breakdown</h4>
        <ul style="list-style:none;padding:0">${ui.breakdownItems.map((it) => `<li>${it.existing ? '✓' : '＋'} <strong>${esc(it.name)}</strong> <span class="addon-field__hint">${esc(it.category)}${it.existing ? ' · already an Element' : ''}</span></li>`).join('')}</ul>
        ${ui.breakdownItems.some((it) => !it.existing) ? '<button type="button" class="mini-btn cap-primary" data-act="breakdown-create">Create the missing Elements</button>' : ''}` : ''}
      ${ui.beats ? `<ol style="padding-left:18px">${ui.beats.map((b) => `<li><strong>${esc(b.name)}</strong> — ${esc(b.description)} <span class="addon-field__hint">${esc(b.scene)}</span></li>`).join('')}</ol>` : ''}` : ''}`;

  const viewBoard = () => `
    <p class="addon-field__hint">Nine camera angles of one frame, keeping the same people and place (Images 2.6 Sunburst, your OpenAI key). Uses the selected clip at the playhead.</p>
    <input data-sb="boardNote" value="${esc(ui.boardNote)}" placeholder="Optional note, e.g. 'keep the red umbrella'" style="width:100%"/>
    <button type="button" class="mini-btn cap-primary" data-act="board" ${ui.busy ? 'disabled' : ''}>Make Shot Board from selected clip</button>
    ${ui.boardRef ? `<div class="sb-board" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px">${sb.SHOT_BOARD_ANGLES.map(([label], i) => {
      const r = ui.board[i];
      const ok = typeof r === 'string';
      return `<figure style="margin:0">${ok ? `<button type="button" data-act="board-add" data-i="${i}" title="Add to timeline at the playhead" style="padding:0;border:0;background:none;cursor:pointer;width:100%"><img src="${esc(r)}" alt="${esc(label)}" style="width:100%;border-radius:4px"/></button>`
        : `<div style="aspect-ratio:16/9;background:rgba(255,255,255,.06);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px">${r instanceof Error ? '⚠️' : '…'}</div>`}
        <figcaption class="addon-field__hint">${esc(label)}</figcaption></figure>`;
    }).join('')}</div>` : ''}`;

  const viewElements = () => {
    const e = ui.editing;
    return `
    <p class="addon-field__hint">Reusable characters, locations, props and vehicles. Type <strong>@Name</strong> in Storyboard or Shot Board prompts to keep them consistent.</p>
    ${e ? `
      <label class="cap-row"><span>Name</span><input data-el="name" value="${esc(e.name)}"/></label>
      <label class="cap-row"><span>Type</span><select data-el="category">${opts(els.ELEMENT_CATEGORIES, e.category)}</select></label>
      <textarea data-el="description" rows="2" placeholder="Look: age, clothing, colors, materials…" style="width:100%">${esc(e.description)}</textarea>
      <div style="display:flex;gap:4px;flex-wrap:wrap">${(e.images || []).map((u, i) => `<span style="position:relative"><img src="${esc(u)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:4px"/><button type="button" data-act="el-rm-img" data-i="${i}" aria-label="Remove image" style="position:absolute;top:0;right:0" class="mini-btn">✕</button></span>`).join('')}</div>
      <input type="file" data-el="upload" accept="image/*" multiple/>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="mini-btn cap-primary" data-act="el-save">Save</button>
        <button type="button" class="mini-btn" data-act="el-angles" ${ui.busy || !e.name ? 'disabled' : ''}>Generate 4 reference angles (Images 2.6)</button>
        <button type="button" class="mini-btn" data-act="el-cancel">Close</button>
        ${e.id ? '<button type="button" class="mini-btn" data-act="el-delete">Delete</button>' : ''}
      </div>` : `
      <button type="button" class="mini-btn cap-primary" data-act="el-new">+ New element</button>
      <ul style="list-style:none;padding:0">${ui.elements.map((x) => `
        <li style="display:flex;gap:8px;align-items:center;padding:4px 0">
          ${x.images[0] ? `<img src="${esc(x.images[0])}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:4px"/>` : '<span style="width:40px;height:40px;display:inline-block;background:rgba(255,255,255,.06);border-radius:4px"></span>'}
          <span style="flex:1"><strong>@${esc(x.handle)}</strong> <span class="addon-field__hint">${esc(x.category)} · ${x.images.length} image(s)</span></span>
          <button type="button" class="mini-btn" data-act="el-edit" data-id="${esc(x.id)}">Edit</button>
        </li>`).join('') || '<li class="addon-field__hint">No elements yet.</li>'}</ul>`}`;
  };

  function draw() {
    container.innerHTML = `
      <div class="bg-panel storyboard-panel">
        <div role="tablist" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">${tabs.map(([id, l]) => `<button type="button" role="tab" class="mini-btn ${ui.tab === id ? 'active' : ''}" aria-selected="${ui.tab === id}" data-tab="${id}">${l}</button>`).join('')}</div>
        ${ui.busy ? `<div class="cap-progress" role="status"><span data-sb-status>${esc(ui.busy)}</span> <button type="button" class="mini-btn" data-act="cancel">Cancel</button></div>` : ''}
        ${ui.error ? `<p class="addon-field__hint" role="alert" style="color:var(--danger,#ff6b6b)">${esc(ui.error)}</p>` : ''}
        ${ui.tab === 'storyboard' ? viewStoryboard() : ui.tab === 'script' ? viewScript() : ui.tab === 'board' ? viewBoard() : viewElements()}
      </div>`;
  }

  // ------------------------------------------------------------------ actions
  const shot = (i) => ui.shots[Number(i)];
  const fullStyle = () => [ui.style, lb.lookStyle(ui.look)].filter(Boolean).join('. ');
  const makeFrame = async (s, signal) => {
    const { url, model } = await sb.frameForShot(editor, s, { elements: ui.elements, style: fullStyle(), model: ui.imageModel, aspect: ui.aspect, signal });
    s.frameUrl = url;
    s.clipUrl = null;
    if (model !== ui.imageModel) editor.toast?.(`Your key can't use ${ui.imageModel} yet — used ${model}`, 'info');
  };
  const animate = async (s, signal) => { s.clipUrl = await sb.animateShot(s, { model: ui.videoModel, signal, onProgress: (p) => p.elapsedSec && setBusy(`Animating "${s.title}"… ${p.elapsedSec}s`) }); };

  const actions = {
    plan: () => task('Planning shots', async (signal) => {
      const r = await sb.planShots(ui.idea, { shots: ui.count, style: fullStyle(), elements: ui.elements, llm, signal });
      ui.title = r.title;
      ui.shots = r.shots;
    }),
    frame: (b) => task('Making frame', (signal) => makeFrame(shot(b.dataset.i), signal)),
    frames: () => task('Making frames', async (signal) => {
      for (const [i, s] of ui.shots.entries()) {
        if (s.frameUrl) continue;
        setBusy(`Making frame ${i + 1} of ${ui.shots.length}…`);
        await makeFrame(s, signal);
      }
    }),
    animate: (b) => task('Animating', (signal) => animate(shot(b.dataset.i), signal)),
    'animate-all': () => task('Animating', async (signal) => {
      for (const s of ui.shots) if (s.frameUrl && !s.clipUrl) await animate(s, signal);
    }),
    'add-shot': () => { ui.shots.push(...sb.normalizeShots([{ title: `Shot ${ui.shots.length + 1}`, prompt: '', duration: 4 }])); draw(); },
    'remove-shot': (b) => { ui.shots.splice(Number(b.dataset.i), 1); draw(); },
    place: () => task('Placing', async () => {
      const r = sb.placeShots(editor, ui.shots, { captionStyle: defaultCaptionStyle('classic') });
      editor.toast?.(`Placed ${r.clips.length} clip(s) at ${r.start.toFixed(1)}s`, 'success');
    }),
    parse: () => {
      const text = container.querySelector('[data-sb="scriptText"]')?.value || '';
      ui.script = importScript(text);
      ui.beats = null;
      ui.shotlists = {};
      draw();
    },
    'look-expand': () => task('Writing the look bible', async (signal) => {
      ui.look = await lb.expandLook(ui.look, { signal });
      lb.saveLook(ui.look);
    }),
    'look-board': () => task('Making the mood board', async (signal) => {
      ui.look.moodboard = await lb.makeMoodboard(editor, ui.look, { signal });
      lb.saveLook(ui.look);
    }),
    rewrite: (b) => task('Rewriting the shot', async (signal) => {
      const s = shot(b.dataset.i);
      s.proposal = await lb.rewriteShot(s, s.note, { look: ui.look, signal });
    }),
    'keep-rewrite': (b) => { const s = shot(b.dataset.i); if (s?.proposal) { s.prompt = s.proposal.prompt; s.camera = s.proposal.camera; s.note = ''; s.proposal = null; s.frameUrl = null; s.clipUrl = null; draw(); } },
    'discard-rewrite': (b) => { const s = shot(b.dataset.i); if (s) { s.proposal = null; draw(); } },
    breakdown: () => task('Breaking down the script', async (signal) => {
      const { data } = await llm('breakdown', { text: ui.script.text }, { signal });
      ui.breakdown = data;
      ui.breakdownItems = lb.matchBreakdown(data, ui.elements, els.slug);
    }),
    'breakdown-create': () => task('Creating Elements', async () => {
      for (const it of ui.breakdownItems.filter((x) => !x.existing)) await els.saveElement({ name: it.name, category: it.category });
      ui.elements = await els.listElements();
      ui.breakdownItems = lb.matchBreakdown(ui.breakdown, ui.elements, els.slug);
      editor.toast?.('Elements created', 'success');
    }),
    'to-storyboard': (b) => {
      const sc = ui.script.scenes[Number(b.dataset.i)];
      ui.idea = serializeScreenplay({ elements: sc.elements });
      ui.tab = 'storyboard';
      draw();
    },
    shotlist: (b) => task('Writing shot list', async (signal) => {
      const i = Number(b.dataset.i);
      const { data } = await llm('shotlist', { text: serializeScreenplay({ elements: ui.script.scenes[i].elements }) }, { signal });
      ui.shotlists[i] = data?.shots || [];
    }),
    beats: () => task('Writing beat sheet', async (signal) => {
      const { data } = await llm('beatsheet', { text: ui.script.text }, { signal });
      ui.beats = data?.beats || [];
    }),
    cast: () => task('Adding characters', async () => {
      const names = [...new Set(ui.script.scenes.flatMap(sceneCharacters))];
      const have = new Set(ui.elements.map((e) => e.handle.toLowerCase()));
      for (const n of names) {
        const pretty = n.charAt(0) + n.slice(1).toLowerCase();
        if (!have.has(els.slug(pretty).toLowerCase())) await els.saveElement({ name: pretty, category: 'character' });
      }
      ui.elements = await els.listElements();
      editor.toast?.(`${names.length} character(s) in Elements`, 'success');
    }),
    board: () => task('Making Shot Board', async (signal) => {
      const clip = editor.getClip(editor.selectedClipId?.());
      if (!clip || !['video', 'image', 'overlay-image'].includes(clip.type)) throw new Error('Select a video or image clip first');
      const canvas = await frameAtPlayhead(editor, clip, { maxSize: 1536, signal });
      ui.boardRef = await editor.storeBlob(await canvasToBlob(canvas, 'image/png'), 'shotboard-ref.png', { requireRemote: true });
      ui.board = [];
      draw();
      let done = 0;
      const { text } = els.resolveMentions(ui.boardNote, ui.elements);
      await sb.shotBoard(editor, ui.boardRef, {
        note: text, aspect: ui.aspect, signal,
        onShot: (i, r) => { ui.board[i] = r; done += 1; setBusy(`Shot Board ${done} of 9…`); if (container.isConnected) draw(); },
      });
    }),
    'board-add': (b) => {
      const url = ui.board[Number(b.dataset.i)];
      if (typeof url !== 'string') return;
      const t = editor.playheadSec();
      editor.snapshot();
      editor.insertClip({ id: `board-${Date.now().toString(36)}`, type: 'image', name: `Shot Board · ${sb.SHOT_BOARD_ANGLES[Number(b.dataset.i)][0]}`, src: url, fit: 'cover', start: t, end: t + 3 }, 'video');
      editor.commit();
      editor.toast?.('Angle added at the playhead', 'success');
    },
    'el-new': () => { ui.editing = { name: '', category: 'character', description: '', images: [] }; draw(); },
    'el-edit': (b) => { ui.editing = { ...ui.elements.find((x) => x.id === b.dataset.id) }; draw(); },
    'el-cancel': () => { ui.editing = null; draw(); },
    'el-rm-img': (b) => { ui.editing.images.splice(Number(b.dataset.i), 1); draw(); },
    'el-save': () => task('Saving', async () => {
      ui.editing = await els.saveElement(ui.editing);
      ui.elements = await els.listElements();
      ui.editing = null;
    }),
    'el-delete': () => task('Deleting', async () => {
      await els.deleteElement(ui.editing.id);
      ui.elements = await els.listElements();
      ui.editing = null;
    }),
    'el-angles': () => task('Generating reference angles', async (signal) => {
      const saved = await els.saveElement(ui.editing);
      ui.editing = await els.generateReferenceAngles(editor, saved, { signal, onProgress: (p) => p.label && setBusy(`Generating: ${p.label}…`) });
      ui.elements = await els.listElements();
    }),
    cancel: () => ui.controller?.abort(),
  };

  // ------------------------------------------------------------------ events
  const onClick = (e) => {
    const t = e.target.closest('[data-tab]');
    if (t && container.contains(t)) { ui.tab = t.dataset.tab; ui.error = ''; draw(); return; }
    const b = e.target.closest('[data-act]');
    if (b && container.contains(b)) actions[b.dataset.act]?.(b);
  };
  const onInput = (e) => {
    const d = e.target.dataset;
    if (d.sb && ['idea', 'style', 'boardNote'].includes(d.sb)) ui[d.sb] = e.target.value;
    else if (d.sb === 'count') ui.count = Math.max(3, Math.min(12, Number(e.target.value) || 6));
    else if (d.look) {
      ui.look[d.look] = d.look === 'references' ? lb.parseReferences(e.target.value) : e.target.value;
      lb.saveLook(ui.look);
    } else if (d.shot) {
      const s = shot(d.i);
      if (s) s[d.shot] = d.shot === 'duration' ? Math.max(1, Math.min(15, Number(e.target.value) || 4)) : e.target.value;
    } else if (d.el && ui.editing && d.el !== 'upload') ui.editing[d.el] = e.target.value;
  };
  const onChange = async (e) => {
    const d = e.target.dataset;
    if (d.look === 'genre') { ui.look.genre = e.target.value; lb.saveLook(ui.look); }
    else if (d.sb && ['aspect', 'imageModel', 'videoModel'].includes(d.sb)) ui[d.sb] = e.target.value;
    else if (d.el === 'category' && ui.editing) ui.editing.category = e.target.value;
    else if (d.sb === 'file' && e.target.files?.[0]) {
      const f = e.target.files[0];
      ui.script = importScript(await f.text(), f.name);
      ui.beats = null;
      ui.shotlists = {};
      draw();
    } else if (d.el === 'upload' && e.target.files?.length && ui.editing) {
      const files = [...e.target.files];
      task('Uploading images', async () => {
        for (const f of files) ui.editing.images.push(await editor.storeBlob(f, f.name, { requireRemote: true }));
      });
    }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);
  draw();
  els.listElements().then((list) => { ui.elements = list; if (container.isConnected && ui.tab === 'elements') draw(); });
  return {
    destroy() {
      ui.controller?.abort();
      container.removeEventListener('click', onClick);
      container.removeEventListener('input', onInput);
      container.removeEventListener('change', onChange);
    },
  };
}
