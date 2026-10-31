// Vibe Motion's motion-graphics mode, ported from upstream Open-Generative-AI's
// VibeMotionStudio.jsx: describe an animated graphic and generate it, or switch
// to Edit and remix an earlier generation. Results live in a grid with a
// Remix action; the last 30 are kept in localStorage.

import { muapi } from '../../lib/muapi.js';
import { apiKeyManager } from '../../lib/apiKeyManager.js';
import { requireEntitlement } from '../../lib/clerkEntitlements.js';
import { AuthModal } from '../AuthModal.js';
import { showToast } from '../../lib/loading.js';
import { createPromptComposer, createPill, createSegmented, openComposerPopover, ICONS } from '../studio/promptComposer.js';
import { createResultsGallery } from '../studio/resultsGallery.js';
import { createEmptyState } from '../studio/emptyState.js';
import { notifyGeneration } from '../studio/generationNotifications.js';

const PERSIST_KEY = 'vibe_motion_history';
const ASPECT_RATIOS = ['16:9', '9:16', '1:1'];
const DURATION_OPTIONS = [5, 6, 8, 10, 12, 15, 20, 25, 30];

// The backend refuses to edit generations whose animation code wasn't saved.
const STALE_EDIT = /animation code|does not have saved|Original generation does not/i;

export const formatElapsed = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function MotionGraphicsPanel() {
  const root = document.createElement('div');
  root.className = 'w-full flex flex-col items-center relative pb-4';
  root.dataset.motionPanel = '';

  let history = [];
  try {
    // canEdit is only an in-memory hint; never trust a persisted false.
    history = (JSON.parse(localStorage.getItem(PERSIST_KEY) || '[]') || []).map(({ canEdit, ...rest }) => rest);
  } catch { /* ignore */ }
  let editMode = false;
  let editSourceId = null;
  let aspectRatio = '16:9';
  let duration = 6;
  let generating = false;
  let timer = null;

  const persist = () => {
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify(history.slice(0, 30).map(({ canEdit, ...rest }) => rest))); } catch { /* ignore */ }
  };

  const toCard = (h) => ({
    id: h.id,
    url: h.url,
    prompt: h.prompt,
    model: h.mode === 'edit' ? 'Edit' : 'Vibe Motion',
    aspect_ratio: [h.aspectRatio, h.duration ? `${h.duration}s` : ''].filter(Boolean).join(' · '),
    requestId: h.requestId,
  });

  const emptyState = createEmptyState({
    heading: 'Start creating with',
    highlight: 'Vibe Motion Studio',
    subtitle: 'Generate animated motion graphics from a text prompt — kinetic typography, data charts, logo reveals, and more.',
    samples: [],
  });
  const gallery = createResultsGallery({
    kind: 'video',
    historyType: 'video',
    filenamePrefix: 'vibe-motion',
    extraActions: (item) => (item.requestId ? [{ label: 'Remix this generation', onSelect: () => startEdit(item.requestId) }] : []),
    onDelete: (item) => { history = history.filter((h) => h.id !== item.id); persist(); },
  });
  const area = document.createElement('div');
  area.className = 'w-full flex flex-col items-center pb-6';
  area.append(emptyState, gallery.root);

  const composer = createPromptComposer({
    placeholder: 'Describe the motion graphic — \'Animated sales dashboard with glowing bar charts and rising numbers\'',
    textareaFirst: true,
    onSubmit: () => run(),
    positionClass: 'sticky bottom-4 z-30 w-full max-w-[95%] lg:max-w-4xl mx-auto animate-fade-in-up',
  });

  // Generate | Edit
  const modeToggle = createSegmented([{ value: 'generate', label: 'Generate' }, { value: 'edit', label: 'Edit' }], 'generate', (v) => {
    if (v === 'edit') {
      const first = editSources()[0];
      if (!first) { modeToggle.setValue('generate'); showToast('Generate a motion graphic first, then you can edit it.', 'info'); return; }
      editMode = true;
      editSourceId = editSourceId || first.requestId;
    } else {
      editMode = false;
      editSourceId = null;
    }
    syncMode();
  });

  const banner = document.createElement('div');
  banner.className = 'hidden items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary';
  const bannerText = document.createElement('span');
  const cancelEdit = document.createElement('button');
  cancelEdit.type = 'button';
  cancelEdit.className = 'font-bold underline shrink-0';
  cancelEdit.textContent = 'Cancel Edit Mode';
  cancelEdit.onclick = () => { modeToggle.setValue('generate'); editMode = false; editSourceId = null; composer.setPrompt(''); syncMode(); };
  banner.append(bannerText, cancelEdit);

  const arPill = createPill({ label: aspectRatio, icon: 'aspect', title: 'Aspect ratio' });
  arPill.addEventListener('click', () => openComposerPopover(arPill, {
    title: 'Aspect Ratio',
    items: ASPECT_RATIOS.map((ar) => ({ label: ar, selected: ar === aspectRatio, onSelect: () => { aspectRatio = ar; arPill.setLabel(ar); } })),
  }));
  const durPill = createPill({ label: `${duration}s`, icon: 'duration', title: 'Duration' });
  durPill.addEventListener('click', () => openComposerPopover(durPill, {
    title: 'Duration',
    items: DURATION_OPTIONS.map((d) => ({ label: `${d}s`, selected: d === duration, onSelect: () => { duration = d; durPill.setLabel(`${d}s`); } })),
  }));
  const sourcePill = createPill({ label: 'Pick source…', title: 'Source generation' });
  sourcePill.classList.add('hidden');
  sourcePill.addEventListener('click', () => openComposerPopover(sourcePill, {
    title: 'Source Generation',
    items: editSources().map((h) => ({
      label: (h.prompt || 'No prompt').slice(0, 48),
      description: `${h.aspectRatio || ''} · ${h.duration || ''}s`,
      selected: h.requestId === editSourceId,
      onSelect: () => { editSourceId = h.requestId; syncMode(); },
    })),
  }));

  const hint = document.createElement('span');
  hint.className = 'hidden md:inline text-[10px] text-white/30';
  hint.textContent = 'Ctrl+Enter to run';

  composer.controls.append(modeToggle, arPill, durPill, sourcePill, hint);
  composer.panel.insertBefore(banner, composer.textarea);

  const loader = document.createElement('div');
  loader.className = 'hidden w-full max-w-4xl rounded-2xl border border-white/10 bg-[#111]/80 py-12 flex-col items-center justify-center gap-4';
  loader.innerHTML = `
    <div class="relative w-20 h-20 flex items-center justify-center">
      <div class="absolute inset-0 rounded-full border-2 border-violet-500/30 animate-ping"></div>
      <div class="absolute inset-2 rounded-full border-2 border-t-primary border-primary/20 animate-spin"></div>
    </div>
    <p class="text-xs font-bold uppercase tracking-widest text-white/60" data-loader-text>Generating motion graphics…</p>
    <span class="text-[11px] font-mono text-white/40 px-3 py-1 rounded-full bg-white/5 border border-white/10" data-elapsed>0:00</span>`;
  area.insertBefore(loader, gallery.root);

  root.append(area, composer.root);

  function editSources() { return history.filter((h) => h.requestId && h.canEdit !== false); }

  function startEdit(requestId) {
    editMode = true;
    editSourceId = requestId;
    modeToggle.setValue('edit');
    composer.setPrompt('');
    syncMode();
    composer.textarea.focus();
  }

  function syncMode() {
    const source = editSources().find((h) => h.requestId === editSourceId);
    banner.classList.toggle('hidden', !editMode);
    banner.classList.toggle('flex', editMode);
    bannerText.textContent = editMode
      ? (source ? `Editing: ${(source.prompt || '').slice(0, 70)}` : 'Select a source generation from the gallery')
      : '';
    sourcePill.classList.toggle('hidden', !editMode);
    sourcePill.setLabel(source ? 'Source set' : 'Pick source…');
    composer.textarea.placeholder = editMode
      ? 'Describe what to change — \'change background to dark navy, make bars gold, add particles…\''
      : 'Describe the motion graphic — \'Animated sales dashboard with glowing bar charts and rising numbers\'';
    // Remix while editing, Generate otherwise (leave the spinner / Retry alone).
    if (!generating && composer.action.textContent.trim() !== '↻ Retry') {
      composer.action.innerHTML = `${editMode ? 'Remix' : 'Generate'} ${ICONS.sparkle}`;
    }
  }

  function syncGallery() {
    gallery.setItems(history.map(toCard));
    emptyState.classList.toggle('hidden', history.length > 0 || generating);
  }

  async function run() {
    if (generating) return;
    const text = composer.getPrompt();
    composer.clearError();
    if (!text) { composer.showError(editMode ? 'Describe the change you want to make.' : 'Describe the motion graphic you want first.'); return; }
    if (editMode && !editSourceId) { composer.showError('Pick the generation you want to edit.'); return; }
    if (!(await requireEntitlement())) return;
    if (!apiKeyManager.getMuapiKey()) { AuthModal(() => run()); return; }

    generating = true;
    const wasEdit = editMode;
    const sourceId = editSourceId;
    composer.setGenerating(true);
    emptyState.classList.add('hidden');
    loader.classList.remove('hidden');
    loader.classList.add('flex');
    loader.querySelector('[data-loader-text]').textContent = wasEdit ? 'Remixing motion graphics…' : 'Generating motion graphics…';
    let seconds = 0;
    const elapsed = loader.querySelector('[data-elapsed]');
    elapsed.textContent = formatElapsed(0);
    timer = setInterval(() => { seconds += 1; elapsed.textContent = formatElapsed(seconds); }, 1000);
    const notifyId = `vibe-motion:${Date.now()}`;
    notifyGeneration({ phase: 'start', id: notifyId, studio: 'effects', label: 'Vibe Motion' });
    let failed = null;
    try {
      const base = { aspect_ratio: aspectRatio, duration_seconds: duration };
      const result = wasEdit
        ? await muapi.runMotionGraphicsEdit({ ...base, request_id: sourceId, edit_prompt: text })
        : await muapi.runMotionGraphics({ ...base, prompt: text });
      const url = result?.output?.video || result?.url || result?.outputs?.[0];
      if (!url) throw new Error('No video URL returned by API');
      const requestId = result?.id || result?.request_id;
      history = [{
        id: requestId || String(Date.now()), requestId, url, prompt: text, aspectRatio, duration,
        mode: wasEdit ? 'edit' : 'generate', sourceId: wasEdit ? sourceId : null, timestamp: new Date().toISOString(), canEdit: true,
      }, ...history].slice(0, 30);
      persist();
      if (wasEdit) { modeToggle.setValue('generate'); editMode = false; editSourceId = null; }
      composer.setPrompt('');
    } catch (err) {
      const raw = err?.message || '';
      if (STALE_EDIT.test(raw)) {
        failed = "This generation can't be remixed — the animation code wasn't saved server-side. Generate a new motion graphic first, then remix that result.";
        modeToggle.setValue('generate');
        editMode = false;
        editSourceId = null;
      } else {
        failed = raw || 'Vibe Motion generation failed';
      }
      showToast(failed, 'error', 5000);
    } finally {
      generating = false;
      clearInterval(timer);
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      notifyGeneration(failed
        ? { phase: 'error', id: notifyId, studio: 'effects', label: 'Vibe Motion', message: failed }
        : { phase: 'success', id: notifyId, studio: 'effects', label: 'Vibe Motion' });
      composer.setGenerating(false);
      syncMode();
      if (failed) composer.setRetry();
      syncGallery();
    }
  }

  syncMode();
  syncGallery();
  root.cleanup = () => clearInterval(timer);
  return root;
}
