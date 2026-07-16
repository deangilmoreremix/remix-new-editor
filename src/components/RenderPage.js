import { navigate } from '../lib/router.js';
import { showToast } from '../lib/loading.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { escapeHtml } from '../lib/security.js';
import { getVideoMetadata, downloadFrame, copyToClipboard, saveDraft, saveTemplate, duplicateTemplate, listTemplates, listDrafts, sendToStoryboard } from '../lib/editor/renderActions.js';
import { enqueueRender, listRenderQueue, subscribe, removeFromRenderQueue, startProcessor } from '../lib/editor/renderQueueStore.js';

import { generateSubtitles, generateHighlights, generateVoiceover, createShorts, runAiAutoEdit } from '../lib/editor/renderAiActions.js';

// Repository endpoints
const REPO_ENDPOINTS = {
  'open-higgsfield': { label: 'Open Higgsfield', status: 'connected', description: 'Core generation and render orchestration engine.' },
  'smartvideo': { label: 'SmartVideo', status: 'connected', description: 'Primary orchestration layer for render workflows.' },
  director: { label: 'Director', status: 'connected', description: 'Prompt-based cinematic editing and agentic scene direction.' },
  vimax: { label: 'ViMax', status: 'connected', description: 'Enhancement, optimization, and cinematic finishing passes.' },
  rendiv: { label: 'Rendiv', status: 'connected', description: 'Render/export pipeline for final outputs and format variants.' },
  ltx: { label: 'LTX-Desktop', status: 'connected', description: 'Subtitles, dubbing, clips, and post-processing utilities.' },
  yucut: { label: 'chatvideo-yucut', status: 'connected', description: 'Shorts, highlights, scene extraction, and social cutdowns.' },
};

// Preset configurations
const PRESET_CONFIG = {
  'Luxury Brand Grade': { key: 'luxury-brand-grade', colorProfile: 'luxury-gloss', pacing: 'measured', musicMood: 'elegant', captionStyle: 'minimal-premium', exportProfile: '4k-master', finish: 'soft-bloom' },
  'Documentary Contrast': { key: 'documentary-contrast', colorProfile: 'documentary-neutral', pacing: 'grounded', musicMood: 'honest', captionStyle: 'editorial-clean', exportProfile: 'hq-delivery', finish: 'contrast-lift' },
  'Film Trailer Punch': { key: 'film-trailer-punch', colorProfile: 'trailer-high-impact', pacing: 'aggressive', musicMood: 'dramatic', captionStyle: 'bold-trailer', exportProfile: 'trailer-master', finish: 'cinematic-punch' },
  'Emotional Story Tone': { key: 'emotional-story-tone', colorProfile: 'warm-story', pacing: 'emotive', musicMood: 'inspirational', captionStyle: 'soft-story', exportProfile: 'story-delivery', finish: 'warm-glow' },
};

const ACTION_TILES = [
  { title: 'Create Shorts', desc: 'Vertical cuts for Shorts, Reels, and TikTok.', icon: '🎬', accent: 'from-fuchsia-500/16 via-violet-500/8 to-indigo-500/14', iconBg: 'bg-fuchsia-500/16', iconBorder: 'border-fuchsia-400/25' },
  { title: 'Generate Highlights', desc: 'Pull standout scenes into shareable cuts.', icon: '✨', accent: 'from-cyan-500/16 via-sky-500/8 to-indigo-500/14', iconBg: 'bg-cyan-500/16', iconBorder: 'border-cyan-400/25' },
  { title: 'Add Subtitles', desc: 'Styled captions for social and cinematic delivery.', icon: '💬', accent: 'from-amber-500/14 via-orange-500/7 to-rose-500/12', iconBg: 'bg-amber-500/16', iconBorder: 'border-amber-400/25' },
  { title: 'Dub / Voiceover', desc: 'Narration, multilingual dubbing, and alt voice tracks.', icon: '🎙️', accent: 'from-emerald-500/14 via-teal-500/8 to-cyan-500/12', iconBg: 'bg-emerald-500/16', iconBorder: 'border-emerald-400/25' },
  { title: 'Trailer Cut', desc: 'Build a teaser or fast-paced trailer version.', icon: '🎞️', accent: 'from-rose-500/16 via-pink-500/8 to-fuchsia-500/12', iconBg: 'bg-rose-500/16', iconBorder: 'border-rose-400/25' },
  { title: 'Social Resize', desc: 'Reframe for feed, story, reel, and ad formats.', icon: '📱', accent: 'from-indigo-500/16 via-violet-500/8 to-blue-500/12', iconBg: 'bg-indigo-500/16', iconBorder: 'border-indigo-400/25' },
];

const PHASE_MAP = {
  'AI Auto-Edit': 3, 'Agentic Editor': 4, 'Full Editor': 4,
  'Create Shorts': 3, 'Generate Highlights': 3, 'Add Subtitles': 3,
  'Dub / Voiceover': 3, 'Export Variations': 2, 'Trailer Cut': 2,
  'Social Resize': 2, 'Remix Scene': 2, 'Export Video': 2,
  'Download Frame': 1, 'Queue Render': 1, 'Copy Prompt': 1,
  'Duplicate Render': 1, 'Save as Template': 1, 'Send to Storyboard': 1,
  'Publish / Deliver': 2,
};



const QUICK_ACTIONS = ['Trailer Cut', 'Social Resize', 'Remix Scene', 'Copy Prompt', 'Duplicate Render', 'Save as Template', 'Send to Storyboard', 'Publish / Deliver'];
const ACTION_BUTTONS = ['Export Video', 'Download Frame', 'Queue Render', 'Trailer Cut', 'Social Resize', 'Remix Scene'];

export function RenderPage() {
  const container = document.createElement('div');
  container.className = 'min-h-screen w-full bg-[#0a0a0b] p-4 text-white md:p-8 overflow-y-auto custom-scrollbar';

  const style = document.createElement('style');
  style.textContent = `
    .render-page button:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(255,255,255,0.4), 0 0 0 4px rgba(0,0,0,0.6); }
    @media (prefers-reduced-motion: reduce) { .render-page .animate-spin, .render-page .animate-pulse { animation: none !important; } }
  `;
  container.appendChild(style);
  container.classList.add('render-page');

  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('videoId') || 'vid_preview';
  const videoUrl = urlParams.get('videoUrl') || '';
  const videoTitle = urlParams.get('prompt') || 'Generated Video Prompt Title';
  const rawAssetId = urlParams.get('asset');
  let resolvedVideoUrl = videoUrl;
  let resolvedVideoId = videoId;
  let resolvedTitle = videoTitle;

  async function resolveAsset(assetId) {
    if (!assetId) {
      return { url: videoUrl, id: videoId, title: videoTitle };
    }
    try {
      const mod = await import('../lib/assets/assetStore.js');
      const asset = mod.assetStore && typeof mod.assetStore.findById === 'function'
        ? mod.assetStore.findById(assetId)
        : null;
      if (asset && typeof asset === 'object') {
        return { url: asset.url || asset.src, id: asset.id, title: asset.title || videoTitle };
      }
    } catch (err) {
      console.warn('[RenderPage] Could not resolve asset, falling back to URL params:', err);
    }
    return { url: videoUrl, id: videoId, title: videoTitle };
  }

  async function initAssetResolve() {
    const resolved = await resolveAsset(rawAssetId);
    resolvedVideoUrl = resolved.url;
    resolvedVideoId = resolved.id;
    resolvedTitle = resolved.title;
    currentVideoUrl = resolvedVideoUrl;
    if (headerDiv) {
      const titleEl = headerDiv.querySelector('.text-xl');
      const idEl = headerDiv.querySelector('.text-white\\/70');
      if (titleEl) titleEl.textContent = resolvedTitle;
      if (idEl) idEl.textContent = `ID: ${resolvedVideoId}`;
    }
    if (videoElement && resolvedVideoUrl) {
      videoElement.src = resolvedVideoUrl;
      videoElement.load();
    }
    updateStatsFromMeta();
  }

  let selectedPreset = 'Luxury Brand Grade';
  let activeAction = 'Export Video';

  const inner = document.createElement('div');
  inner.className = 'w-full';

  let videoElement = null;
  let currentVideoUrl = videoUrl;
  let videoMeta = null;

  async function updateStatsFromMeta() {
    const resolved = currentVideoUrl || videoUrl;
    videoMeta = await getVideoMetadata(resolved);
    renderStats();
    if (videoMeta) {
      const resolutionEl = container.querySelector('#statResolution');
      if (resolutionEl) resolutionEl.textContent = `${videoMeta.width} × ${videoMeta.height}`;
    }
  }

  function renderStats() {
    const durationEl = container.querySelector('#statDuration');
    const estimatedEl = container.querySelector('#statEstimated');
    if (durationEl && videoMeta) {
      const mins = Math.floor(videoMeta.duration / 60);
      const secs = Math.floor(videoMeta.duration % 60);
      durationEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    } else if (durationEl) {
      durationEl.textContent = '--:--';
    }
    if (estimatedEl && videoMeta) {
      estimatedEl.textContent = `${Math.max(1, Math.round(videoMeta.duration / 5))}:00`;
    } else if (estimatedEl) {
      estimatedEl.textContent = '--:--';
    }
  }

  function getOutputSettings() {
    const formatEl = container.querySelector('#outputFormat');
    const frameRateEl = container.querySelector('#frameRate');
    const qualityEl = container.querySelector('#quality');
    return {
      format: formatEl ? formatEl.value : 'mp4',
      frameRate: frameRateEl ? frameRateEl.value : '24',
      quality: qualityEl ? parseInt(qualityEl.value, 10) : 82,
    };
  }

   function getSavedItems() {
    const drafts = Array.isArray(listDrafts()) ? listDrafts() : [];
    const templates = Array.isArray(listTemplates()) ? listTemplates() : [];
    return [
      ...drafts.filter(d => d && typeof d === 'object').map(d => d.label || d.title || 'Untitled draft'),
      ...templates.filter(t => t && typeof t === 'object').map(t => t.label || t.title || 'Untitled template'),
    ];
  }

   function renderSavedItems() {
    const savedList = sidebar.querySelector('#savedPanel');
    if (!savedList) {
      renderSavedItemsPanel();
      return;
    }
    savedList.innerHTML = '';
    getSavedItems().forEach(item => {
      const row = document.createElement('div');
      row.className = 'rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/75';
      row.textContent = item;
      savedList.appendChild(row);
    });
  }

  const hero = document.createElement('div');
  hero.className = 'relative mb-8 overflow-hidden rounded-[28px] md:mb-10';
  const heroBanner = createHeroSection('render', 'h-44 md:h-60');
  if (heroBanner) {
    heroBanner.classList.add('rounded-[28px]');
    const heroOverlay = document.createElement('div');
    heroOverlay.className = 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 md:p-8 z-10';
    heroOverlay.innerHTML = `
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="mb-3 text-xs uppercase tracking-[0.28em] text-white/70">AI Film Studio</p>
          <h1 class="text-3xl font-black tracking-tight md:text-5xl text-white">Video Render</h1>
          <p class="mt-2 max-w-2xl text-sm text-white/60 md:text-base">Review, refine, and process your generated video with a cinematic render workflow.</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button id="saveDraftBtn" class="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-100 shadow-lg shadow-black/20 transition hover:bg-white/10">Save Draft</button>
          <button id="startRenderBtn" class="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-xl transition hover:opacity-90">Start Render</button>
        </div>
      </div>
    `;
    heroBanner.appendChild(heroOverlay);
    hero.appendChild(heroBanner);
  } else {
    // Fallback if hero image not found
    hero.className = 'relative mb-8 h-44 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#17181b_0%,#0c0d10_45%,#1b2230_100%)] md:mb-10 md:h-60';
    hero.innerHTML = `
      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 md:p-8">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p class="mb-3 text-xs uppercase tracking-[0.28em] text-white/70">AI Film Studio</p>
            <h1 class="text-3xl font-black tracking-tight md:text-5xl">Video Render</h1>
            <p class="mt-2 max-w-2xl text-sm text-white/60 md:text-base">Review, refine, and process your generated video with a cinematic render workflow.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button id="saveDraftBtn" class="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-100 shadow-lg shadow-black/20 transition hover:bg-white/10">Save Draft</button>
            <button id="startRenderBtn" class="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-xl transition hover:opacity-90">Start Render</button>
          </div>
        </div>
      </div>
    `;
  }
  inner.appendChild(hero);

  // Main grid
  const mainGrid = document.createElement('div');
  mainGrid.className = 'grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]';

  // Left section
  const leftSection = document.createElement('section');
  leftSection.className = 'rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_60px_rgba(99,102,241,0.08)] backdrop-blur-xl md:p-6';

  // Video title and status
  const headerDiv = document.createElement('div');
  headerDiv.className = 'mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between';
  headerDiv.innerHTML = `
    <div>
      <div class="truncate text-xl font-black md:text-2xl">${escapeHtml(videoTitle)}</div>
      <div class="mt-1 text-sm text-white/70">ID: ${escapeHtml(videoId)}</div>
    </div>
    <div class="flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
      <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
      Processing preview updated
    </div>
  `;
  leftSection.appendChild(headerDiv);

  // Connected pipeline info
  const pipelineInfo = document.createElement('div');
  pipelineInfo.className = 'mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4';
  pipelineInfo.innerHTML = `
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.22em] text-white/70">Connected Pipeline</p>
        <h3 class="mt-2 text-lg font-black" id="statusLabel">Exporting master video</h3>
        <p class="mt-1 text-sm text-white/70">Rendiv</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
        Preset: <span class="font-semibold text-white" id="presetLabel">${escapeHtml(selectedPreset)}</span>
      </div>
    </div>
  `;
  leftSection.appendChild(pipelineInfo);

  // Video preview area
  const previewArea = document.createElement('div');
  previewArea.className = 'relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-black shadow-[0_0_120px_rgba(16,185,129,0.18),0_0_90px_rgba(99,102,241,0.14)] md:min-h-[460px]';
  const bgRadial1 = document.createElement('div');
  bgRadial1.className = 'absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),transparent_38%),radial-gradient(circle_at_50%_58%,rgba(16,185,129,0.20),transparent_34%)]';
  previewArea.appendChild(bgRadial1);
  const bgRadial2 = document.createElement('div');
  bgRadial2.className = 'absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,198,0.24),transparent_28%),radial-gradient(circle_at_50%_78%,rgba(16,185,129,0.24),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.09),transparent_24%)]';
  previewArea.appendChild(bgRadial2);

  const videoEl = document.createElement('video');
  videoEl.id = 'previewVideo';
  videoEl.controls = true;
  videoEl.playsInline = true;
  videoEl.className = 'relative aspect-video w-[88%] max-w-3xl overflow-hidden rounded-2xl border border-emerald-400/12 bg-[linear-gradient(135deg,#101114_0%,#191b20_50%,#0c0d10_100%)] shadow-[0_25px_80px_rgba(0,0,0,0.5),0_0_110px_rgba(16,185,129,0.20),0_0_70px_rgba(99,102,241,0.12)]';
  previewArea.appendChild(videoEl);

  const previewBadge = document.createElement('div');
  previewBadge.id = 'previewBadge';
  previewBadge.className = 'absolute left-4 top-4 rounded-full border border-emerald-400/18 bg-black/45 px-3 py-1 text-xs text-emerald-100/80 shadow-[0_0_24px_rgba(16,185,129,0.14)] backdrop-blur';
  previewBadge.textContent = `${selectedPreset} · Ready`;
  previewArea.appendChild(previewBadge);

  const actionBadgeEl = document.createElement('div');
  actionBadgeEl.id = 'actionBadge';
  actionBadgeEl.className = 'absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs text-white/75 backdrop-blur';
  actionBadgeEl.textContent = activeAction;
  previewArea.appendChild(actionBadgeEl);

  leftSection.appendChild(previewArea);

  videoElement = videoEl;
  if (videoElement && resolvedVideoUrl) {
    videoElement.src = resolvedVideoUrl;
    videoElement.load();
    videoElement.addEventListener('loadedmetadata', () => updateStatsFromMeta());
    videoElement.addEventListener('error', () => {
      showToast('Could not load video preview');
      videoMeta = null;
      renderStats();
    });
  }

  // Stats row
  const statsRow = document.createElement('div');
  statsRow.className = 'mt-5 grid grid-cols-1 gap-4 md:grid-cols-3';
  statsRow.innerHTML = `
    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p class="text-xs uppercase tracking-[0.2em] text-white/70">Duration</p><p class="mt-2 text-lg font-semibold" id="statDuration">--:--</p></div>
    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p class="text-xs uppercase tracking-[0.2em] text-white/70">Resolution</p><p class="mt-2 text-lg font-semibold" id="statResolution">1920 × 1080</p></div>
    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p class="text-xs uppercase tracking-[0.2em] text-white/70">Estimated Time</p><p class="mt-2 text-lg font-semibold" id="statEstimated">--:--</p></div>
  `;
  leftSection.appendChild(statsRow);

  // Action buttons row
  const actionBtnsRow = document.createElement('div');
  actionBtnsRow.className = 'mt-5 flex flex-wrap gap-3';
  actionBtnsRow.id = 'actionButtonsRow';
  ACTION_BUTTONS.forEach(action => {
    const btn = document.createElement('button');
    btn.className = `rounded-2xl px-5 py-3 text-sm font-medium transition ${action === 'Export Video' ? 'bg-white text-black shadow-xl hover:opacity-90' : 'border border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]'}`;
    btn.textContent = action;
    btn.onclick = () => dispatchAction(action);
    btn.setAttribute('aria-pressed', String(action === activeAction));
    actionBtnsRow.appendChild(btn);
  });
  leftSection.appendChild(actionBtnsRow);

  // Action tiles section
  const actionTilesSection = document.createElement('div');
  actionTilesSection.className = 'mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 md:p-6';
  actionTilesSection.innerHTML = `
    <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div><p class="text-xs uppercase tracking-[0.24em] text-white/70">Repurpose & Enhance</p><h3 class="mt-2 text-xl font-black">Action Tiles</h3></div>
      <p class="max-w-xl text-sm text-white/70">Compact action modules with cinematic glow and color accents.</p>
    </div>
  `;

  const tilesGrid = document.createElement('div');
  tilesGrid.className = 'grid grid-cols-1 gap-3 md:grid-cols-2';
  ACTION_TILES.forEach(tile => {
    const tileBtn = document.createElement('button');
    tileBtn.className = `group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.028))] px-4 py-4 text-left shadow-[0_14px_34px_rgba(0,0,0,0.26)] transition hover:-translate-y-0.5 hover:bg-white/[0.06]`;
    tileBtn.innerHTML = `
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100 ${tile.accent}"></div>
      <div class="pointer-events-none absolute inset-[1px] rounded-[15px] border border-white/6"></div>
      <div class="relative z-10 flex items-start gap-4">
        <div class="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xl shadow-[0_0_18px_rgba(99,102,241,0.14)] transition group-hover:scale-[1.03] ${tile.iconBg} ${tile.iconBorder}">${tile.icon}</div>
        <div class="min-w-0 flex-1">
          <div class="text-base font-black leading-tight text-white">${tile.title}</div>
          <div class="mt-1 text-sm leading-6 text-white/55">${tile.desc}</div>
          <div class="mt-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70"><span>Open Tool</span><span class="text-sm">→</span></div>
        </div>
      </div>
    `;
    tileBtn.onclick = () => dispatchAction(tile.title);
    tilesGrid.appendChild(tileBtn);
  });
  actionTilesSection.appendChild(tilesGrid);
  leftSection.appendChild(actionTilesSection);

  // Quick actions
  const quickActionsDiv = document.createElement('div');
  quickActionsDiv.className = 'mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4';
  quickActionsDiv.innerHTML = '<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p class="text-xs uppercase tracking-[0.24em] text-white/70">Quick Utilities</p><h3 class="mt-2 text-lg font-black">Post-Render Commands</h3></div></div>';
  const quickBtnsDiv = document.createElement('div');
  quickBtnsDiv.className = 'flex flex-wrap gap-2 mt-3 md:mt-0';
  QUICK_ACTIONS.forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/[0.08] transition';
    btn.textContent = action;
    btn.onclick = () => dispatchAction(action);
    quickBtnsDiv.appendChild(btn);
  });
  quickActionsDiv.querySelector('div').appendChild(quickBtnsDiv);
  leftSection.appendChild(quickActionsDiv);

  // Presets section
  const presetsDiv = document.createElement('div');
  presetsDiv.className = 'mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4';
  presetsDiv.innerHTML = '<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p class="text-xs uppercase tracking-[0.24em] text-white/70">Look & Finish</p><h3 class="mt-2 text-lg font-black">Cinematic Presets</h3></div></div>';
  const presetsBtnsDiv = document.createElement('div');
  presetsBtnsDiv.className = 'flex flex-wrap gap-2 mt-3 md:mt-0';
  presetsBtnsDiv.id = 'presetsContainer';
  Object.keys(PRESET_CONFIG).forEach(preset => {
    const btn = document.createElement('button');
    btn.className = `rounded-full border px-3 py-2 text-xs font-semibold transition ${preset === selectedPreset ? 'border-white bg-white text-black' : 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]'}`;
    btn.textContent = preset;
    btn.onclick = () => selectPreset(preset);
    btn.setAttribute('aria-pressed', String(preset === selectedPreset));
    presetsBtnsDiv.appendChild(btn);
  });
  presetsDiv.querySelector('div').appendChild(presetsBtnsDiv);

  // Preset details
  const presetDetails = document.createElement('div');
  presetDetails.className = 'mt-4 grid grid-cols-1 gap-3 md:grid-cols-3';
  presetDetails.id = 'presetDetails';
  const activePreset = PRESET_CONFIG[selectedPreset];
  presetDetails.innerHTML = `
    <div class="rounded-2xl border border-white/10 bg-black/20 p-3"><p class="text-[11px] uppercase tracking-[0.18em] text-white/70">Color Profile</p><p class="mt-2 text-sm font-semibold text-white">${activePreset.colorProfile}</p></div>
    <div class="rounded-2xl border border-white/10 bg-black/20 p-3"><p class="text-[11px] uppercase tracking-[0.18em] text-white/70">Pacing</p><p class="mt-2 text-sm font-semibold text-white">${activePreset.pacing}</p></div>
    <div class="rounded-2xl border border-white/10 bg-black/20 p-3"><p class="text-[11px] uppercase tracking-[0.18em] text-white/70">Export Profile</p><p class="mt-2 text-sm font-semibold text-white">${activePreset.exportProfile}</p></div>
  `;
  presetsDiv.appendChild(presetDetails);
  leftSection.appendChild(presetsDiv);

  mainGrid.appendChild(leftSection);

  // Right sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'h-fit rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_55px_rgba(99,102,241,0.08)] backdrop-blur-xl md:p-6';
  sidebar.innerHTML = `
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-black tracking-tight">RENDER QUEUE</h2>
      <button id="savedToggleBtn" class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/[0.08] transition">Saved</button>
    </div>
  `;

  let queueUnsubscribe = null;
  let showSavedItems = false;
  let stopBackgroundProcessor = null;

  function renderSavedItemsPanel() {
    const existing = sidebar.querySelector('#savedPanel');
    if (existing) existing.remove();
    const panel = document.createElement('div');
    panel.id = 'savedPanel';
    panel.className = 'space-y-3 overflow-y-auto pr-1 max-h-[400px]';
    getSavedItems().forEach(item => {
      const row = document.createElement('div');
      row.className = 'rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/75';
      row.textContent = item;
      panel.appendChild(row);
    });
    sidebar.appendChild(panel);
  }

  function renderQueue() {
    const existing = sidebar.querySelector('#queuePanel');
    if (existing) existing.remove();
    const panel = document.createElement('div');
    panel.id = 'queuePanel';
    panel.className = 'space-y-3 overflow-y-auto pr-1 max-h-[400px]';
    const queue = Array.isArray(listRenderQueue()) ? listRenderQueue() : [];
    const validEntries = queue.filter(entry => entry && typeof entry === 'object');
    if (!validEntries.length) {
      const empty = document.createElement('p');
      empty.className = 'text-sm text-white/70';
      empty.textContent = 'No jobs in queue';
      panel.appendChild(empty);
    } else {
      validEntries.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'rounded-2xl border border-white/10 bg-white/[0.03] p-3';
        const label = entry.label || entry.action || 'Render job';
        row.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-white truncate">${escapeHtml(label)}</p>
            <button id="remove-queue-${entry.id || 'unknown'}" class="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-wider text-white/60 hover:bg-white/[0.08] transition">Remove</button>
          </div>
        `;
        const btn = row.querySelector('button');
        if (btn && entry.id) {
          btn.addEventListener('click', () => removeFromRenderQueue(entry.id));
        }
        panel.appendChild(row);
      });
    }
    sidebar.appendChild(panel);
  }

  function updateSidebarView() {
    const queuePanel = sidebar.querySelector('#queuePanel');
    const savedPanel = sidebar.querySelector('#savedPanel');
    if (showSavedItems) {
      if (queuePanel) queuePanel.remove();
      renderSavedItemsPanel();
    } else {
      if (savedPanel) savedPanel.remove();
      renderQueue();
    }
  }

   queueUnsubscribe = subscribe(() => renderQueue());
   renderQueue();
   stopBackgroundProcessor = startProcessor(5000);

  // Progress section
  const progressSection = document.createElement('div');
  progressSection.className = 'mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4';
  progressSection.innerHTML = `
    <div class="mb-4 flex items-center gap-3"><div class="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" id="progressSpinner" hidden></div><div class="font-black" id="progressStatus" role="status">Exporting master video</div></div>
    <div class="mb-4"><div class="flex items-center justify-between text-xs"><span class="text-white/70">Progress</span><span class="font-bold text-emerald-200" id="progressPercent" aria-live="polite" aria-atomic="true">0%</span></div>
    <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div class="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#60a5fa)]" id="progressBar" style="width: 0%"></div></div></div>
    <div class="space-y-2 text-sm" id="progressSteps">
      <div class="flex items-center gap-3 text-emerald-200"><div class="h-2.5 w-2.5 rounded-full bg-emerald-400"></div><span class="font-semibold">Scene Detection</span></div>
      <div class="flex items-center gap-3 text-emerald-200"><div class="h-2.5 w-2.5 rounded-full bg-emerald-400"></div><span class="font-semibold">Highlight Detection</span></div>
      <div class="flex items-center gap-3 text-emerald-200"><div class="h-2.5 w-2.5 rounded-full bg-emerald-400"></div><span class="font-semibold">Clip Generation</span></div>
      <div class="flex items-center gap-3 text-emerald-200"><div class="h-2.5 w-2.5 rounded-full bg-emerald-400"></div><span class="font-semibold">Subtitles</span></div>
      <div class="flex items-center gap-3 text-indigo-300"><div class="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-400"></div><span class="font-semibold">Final Export</span></div>
    </div>
  `;
  sidebar.appendChild(progressSection);

  // Output settings
  const outputSettings = document.createElement('div');
  outputSettings.className = 'mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4';
  outputSettings.innerHTML = `
    <div><label class="mb-2 block text-sm text-white/70" for="outputFormat">Output Format</label><select id="outputFormat" class="w-full rounded-2xl border border-white/10 bg-[#111118] px-4 py-3 text-sm text-zinc-200 outline-none"><option value="mp4">MP4 (H.264)</option><option value="webm">WebM (VP9)</option><option value="mov">MOV (ProRes)</option></select></div>
    <div><label class="mb-2 block text-sm text-white/70" for="frameRate">Frame Rate</label><select id="frameRate" class="w-full rounded-2xl border border-white/10 bg-[#111118] px-4 py-3 text-sm text-zinc-200 outline-none"><option value="24">24 FPS Cinematic</option><option value="30">30 FPS Standard</option><option value="60">60 FPS Smooth</option></select></div>
    <div><label class="mb-2 block text-sm text-white/70" for="quality">Quality</label><input id="quality" type="range" min="1" max="100" value="82" class="w-full accent-white"><p class="mt-2 text-xs text-white/70" id="qualityLabel">High quality master export</p></div>
  `;
  sidebar.appendChild(outputSettings);

  // Repo handlers
  const repoSection = document.createElement('div');
  repoSection.className = 'mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4';
  repoSection.innerHTML = '<p class="text-xs uppercase tracking-[0.22em] text-white/70">Repo Handlers</p><div class="mt-3 space-y-2" id="repoHandlers"></div>';
  const repoHandlers = repoSection.querySelector('#repoHandlers');
  ['open-higgsfield', 'rendiv'].forEach(repoKey => {
    const repo = REPO_ENDPOINTS[repoKey];
    if (!repo) return;
    repoHandlers.innerHTML += `
      <div class="rounded-xl border border-white/10 bg-black/20 p-3">
        <div class="flex items-center justify-between gap-3">
          <div><p class="text-sm font-semibold text-white">${repo.label}</p><p class="mt-1 text-xs text-white/70">${repo.description}</p></div>
          <span class="rounded-full border border-emerald-400/25 bg-emerald-500/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">${repo.status}</span>
        </div>
      </div>
    `;
  });
  sidebar.appendChild(repoSection);

  mainGrid.appendChild(sidebar);
  inner.appendChild(mainGrid);
  container.appendChild(inner);

  // Resolve frequently-used progress controls once. These are referenced by the
  // async AI/export action handlers, so they must exist in this (RenderPage) scope.
  const spinner = container.querySelector('#progressSpinner');
  const progressStatus = container.querySelector('#progressStatus');
  let activeExportCleanup = null;

  container.querySelector('#quality')?.addEventListener('input', (e) => {
    const qualityLabel = container.querySelector('#qualityLabel');
    const val = parseInt(e.target.value, 10);
    if (qualityLabel) {
      qualityLabel.textContent = val >= 85 ? 'High quality master export' : val >= 60 ? 'Standard quality' : 'Low quality draft';
    }
  });

  const savedToggleBtn = container.querySelector('#savedToggleBtn');
  if (savedToggleBtn) {
    savedToggleBtn.addEventListener('click', () => {
      showSavedItems = !showSavedItems;
      updateSidebarView();
    });
  }

  const saveDraftBtn = container.querySelector('#saveDraftBtn');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', () => {
      saveDraft({ videoId: resolvedVideoId, videoUrl: resolvedVideoUrl, title: resolvedTitle, preset: selectedPreset, outputSettings: getOutputSettings() });
      renderSavedItems();
      showToast('Draft saved');
    });
  }
  const startRenderBtn = container.querySelector('#startRenderBtn');
  if (startRenderBtn) {
    startRenderBtn.addEventListener('click', () => dispatchAction('Export Video'));
  }

  void initAssetResolve();

  // Real video export: draw the actual source frames to a canvas and record
  // them with MediaRecorder. The previous worker only recorded a blank canvas,
  // so exports contained no video. This runs on the main thread where we can
  // play the <video> and capture its frames.
  function pickExportMimeType() {
    const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || '';
  }

  const ASPECT_DIMS = {
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
    '16:9': { width: 1920, height: 1080 },
  };

  function seekVideo(video, time) {
    return new Promise((resolve, reject) => {
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
      video.addEventListener('seeked', onSeeked);
      try { video.currentTime = time; } catch (e) { reject(e); }
    });
  }

  async function captureRealVideo({ videoUrl, action, settings = {}, timeRange, effects, onProgress }) {
    const supported = typeof MediaRecorder !== 'undefined'
      && typeof HTMLCanvasElement !== 'undefined'
      && typeof HTMLCanvasElement.prototype.captureStream === 'function';
    if (!supported) throw new Error('Video export is not supported in this browser');

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.src = videoUrl;

    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('Video source timed out')), 30000);
      video.addEventListener('loadedmetadata', () => { clearTimeout(t); res(); }, { once: true });
      video.addEventListener('error', () => { clearTimeout(t); rej(new Error('Could not load video source')); }, { once: true });
    });

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    let cw = vw;
    let ch = vh;
    if (action === 'social-resize' && settings.aspectRatio && ASPECT_DIMS[settings.aspectRatio]) {
      cw = ASPECT_DIMS[settings.aspectRatio].width;
      ch = ASPECT_DIMS[settings.aspectRatio].height;
    }

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    const mimeType = pickExportMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    const finished = new Promise((res, rej) => {
      recorder.onstop = () => res(new Blob(chunks, { type: mimeType || 'video/webm' }));
      recorder.onerror = (e) => rej(e.error || new Error('Recording failed'));
    });

    let durationMs;
    if (action === 'trailer-cut' && timeRange) {
      durationMs = Math.max(500, (timeRange.end - timeRange.start) * 1000);
    } else if (typeof settings.duration === 'number' && settings.duration > 0) {
      durationMs = settings.duration * 1000;
    } else {
      durationMs = (video.duration || 5) * 1000;
    }

    if (action === 'trailer-cut' && timeRange) {
      try { await seekVideo(video, Math.max(0, timeRange.start)); } catch { /* best effort */ }
    }

    let rafId = null;
    const startTs = performance.now();
    function drawFrame() {
      try {
        if (effects && (effects.brightness != null || effects.contrast != null)) {
          const parts = [];
          if (effects.brightness != null) parts.push(`brightness(${Math.round(effects.brightness * 100)}%)`);
          if (effects.contrast != null) parts.push(`contrast(${Math.round(effects.contrast * 100)}%)`);
          ctx.filter = parts.join(' ');
        } else {
          ctx.filter = 'none';
        }
        ctx.drawImage(video, 0, 0, cw, ch);
        ctx.filter = 'none';
      } catch { /* frame not ready yet */ }
      const elapsed = performance.now() - startTs;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      if (onProgress) onProgress(pct);
      if (elapsed < durationMs) {
        rafId = requestAnimationFrame(drawFrame);
      } else {
        cleanup();
        try { recorder.stop(); } catch { /* already stopped */ }
      }
    }
    function cleanup() {
      if (rafId) cancelAnimationFrame(rafId);
      try { video.pause(); } catch { /* ignore */ }
      video.removeAttribute('src');
      video.load();
    }

    activeExportCleanup = cleanup;

    try { await video.play(); } catch { /* autoplay may be blocked; frames still drawn via rAF */ }

    recorder.start(100);
    drawFrame();

    const blob = await finished;
    const isMp4 = (mimeType || '').includes('mp4');
    return {
      blob,
      url: URL.createObjectURL(blob),
      mime: mimeType || 'video/webm',
      ext: isMp4 ? 'mp4' : 'webm',
    };
  }

  async function runExportWorker(payload, statusLabel, actionName, onDone) {
    const progressBar = container.querySelector('#progressBar');
    const progressPercent = container.querySelector('#progressPercent');
    const progressStatus = container.querySelector('#progressStatus');

    if (progressStatus) progressStatus.textContent = statusLabel;
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';

    try {
      const result = await captureRealVideo({
        videoUrl: payload.videoUrl,
        action: payload.action,
        settings: payload.settings || {},
        timeRange: payload.timeRange,
        effects: payload.effects,
        onProgress: (pct) => {
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (progressPercent) progressPercent.textContent = `${pct}%`;
        },
      });
      if (onDone) onDone(result);
    } finally {
      if (activeExportCleanup) {
        activeExportCleanup();
        activeExportCleanup = null;
      }
    }
  }

  const ACTION_HANDLERS = {
    'Download Frame': async () => {
      if (!videoElement || !videoElement.src) { showToast('Load a video first'); return; }
      await downloadFrame(videoElement, { filename: `${resolvedVideoId}_frame.png` });
      showToast('Frame downloaded');
    },
    'Queue Render': async () => {
      const entry = enqueueRender({
        videoId: resolvedVideoId,
        videoUrl: resolvedVideoUrl,
        title: resolvedTitle,
        label: resolvedTitle || 'Render',
        action: 'Render',
        preset: selectedPreset,
        outputSettings: getOutputSettings(),
      });
      showToast(`Queued: ${entry.id.slice(0, 12)}…`);
      renderQueue();
    },
    'Copy Prompt': async () => {
      const ok = await copyToClipboard(resolvedTitle);
      showToast(ok ? 'Prompt copied to clipboard' : 'Copy failed — please copy manually');
    },
    'Duplicate Render': async () => {
      const templates = (Array.isArray(listTemplates()) ? listTemplates() : [])
        .filter(t => t && typeof t === 'object' && t.id);
      const last = templates[templates.length - 1];
      if (!last) { showToast('Nothing to duplicate yet — save a template first'); return; }
      const copy = duplicateTemplate(last.id);
      if (!copy) { showToast('Could not duplicate template'); return; }
      renderSavedItems();
      showToast('Render duplicated');
    },
    'Save as Template': async () => {
      saveTemplate({ videoId: resolvedVideoId, videoUrl: resolvedVideoUrl, title: resolvedTitle, preset: selectedPreset, outputSettings: getOutputSettings() });
      renderSavedItems();
      showToast('Saved as template');
    },
    'Save Draft': async () => {
      saveDraft({ videoId: resolvedVideoId, videoUrl: resolvedVideoUrl, title: resolvedTitle, preset: selectedPreset, outputSettings: getOutputSettings() });
      renderSavedItems();
      showToast('Draft saved');
    },
    'Send to Storyboard': async () => {
      sendToStoryboard(resolvedVideoId, resolvedVideoUrl);
    },
    'Export Video': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      await runExportWorker(
        { action: 'export-video', videoUrl: resolvedVideoUrl, settings: getOutputSettings() },
        'Exporting master video',
        'Export Video',
        (result) => {
          const a = document.createElement('a');
          a.href = result.url;
          a.download = `${resolvedVideoId || 'export'}_master.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(result.url), 1000);
          showToast('Video exported successfully');
        }
      );
    },
    'Export Variations': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      const formats = [
        { label: 'MP4 (H.264)', format: 'mp4', ext: 'mp4' },
        { label: 'MP4 (H.265)', format: 'mp4', ext: 'mp4' },
        { label: 'WebM (VP9)', format: 'webm', ext: 'webm' },
      ];
      for (const fmt of formats) {
        await new Promise((resolve, reject) => {
          runExportWorker(
            { action: 'export-video', videoUrl: resolvedVideoUrl, settings: getOutputSettings() },
            `Exporting ${fmt.label}`,
            'Export Variations',
            (result) => {
              const a = document.createElement('a');
              a.href = result.url;
              a.download = `${resolvedVideoId || 'export'}_${fmt.label.toLowerCase().replace(/[() ]/g, '')}.${fmt.ext}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(result.url), 1000);
              resolve();
            }
          ).then(() => {}, reject);
        });
      }
      showToast('All variations exported');
    },
    'Trailer Cut': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      await runExportWorker(
        { action: 'trailer-cut', videoUrl: resolvedVideoUrl, timeRange: { start: 0, end: 30 } },
        'Building trailer cut',
        'Trailer Cut',
        (result) => {
          const a = document.createElement('a');
          a.href = result.url;
          a.download = `${resolvedVideoId || 'export'}_trailer.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(result.url), 1000);
          showToast('Trailer cut exported');
        }
      );
    },
    'Social Resize': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      const aspects = ['9:16', '1:1', '4:5'];
      for (const aspect of aspects) {
        await new Promise((resolve, reject) => {
          runExportWorker(
            { action: 'social-resize', videoUrl: resolvedVideoUrl, settings: { aspectRatio: aspect } },
            `Exporting ${aspect}`,
            'Social Resize',
            (result) => {
              const a = document.createElement('a');
              a.href = result.url;
              a.download = `${resolvedVideoId || 'export'}_${aspect.replace(':', 'x')}.mp4`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(result.url), 1000);
              resolve();
            }
          ).then(() => {}, reject);
        });
      }
      showToast('Social variants exported');
    },
    'Remix Scene': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      await runExportWorker(
        { action: 'remix-scene', videoUrl: resolvedVideoUrl, effects: { brightness: 1.1, contrast: 1.2 } },
        'Remixing scene',
        'Remix Scene',
        (result) => {
          const a = document.createElement('a');
          a.href = result.url;
          a.download = `${resolvedVideoId || 'export'}_remix.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(result.url), 1000);
          showToast('Remix exported');
        }
      );
    },
    'Publish / Deliver': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      const formats = ['mp4', 'webm'];
      const outputs = [];
      for (const fmt of formats) {
        await new Promise((resolve, reject) => {
          runExportWorker(
            { action: 'export-video', videoUrl: resolvedVideoUrl, settings: { ...getOutputSettings(), format: fmt } },
            `Packaging ${fmt}`,
            'Publish / Deliver',
            (result) => {
              outputs.push({ format: fmt, url: result.url });
              setTimeout(() => URL.revokeObjectURL(result.url), 1000);
              resolve();
            }
          ).then(() => {}, reject);
        });
      }
      const manifest = {
        videoId: resolvedVideoId,
        title: resolvedTitle,
        exportedAt: new Date().toISOString(),
        files: outputs.map((o) => ({ format: o.format, url: o.url })),
      };
      console.log('Delivery manifest:', manifest);
      showToast('Delivery package ready');
    },
    // ── Phase 4 handlers ───────────────────────────────────────────────────────
    'Agentic Editor': async () => {
      navigate('edit', { videoId: resolvedVideoId, videoUrl: resolvedVideoUrl });
    },
    'Full Editor': async () => {
      navigate('timeline', { videoId: resolvedVideoId, videoUrl: resolvedVideoUrl });
    },
    // ── Phase 3 AI handlers ────────────────────────────────────────────────────
    'Add Subtitles': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      if (spinner) spinner.hidden = false;
      if (progressStatus) progressStatus.textContent = 'Generating subtitles...';
      try {
        const result = await generateSubtitles(resolvedVideoUrl);
        if (result.error || !result.url) {
          showToast('Subtitles unavailable — Director/VideoDB not reachable');
          return;
        }
        // Director returns a real subtitled-video URL (burned-in captions).
        const link = document.createElement('a');
        link.href = result.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.className = 'mt-3 inline-block rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100/90';
        link.textContent = `Open subtitled video (${result.url})`;
        const badge = container.querySelector('#previewBadge');
        if (badge) {
          badge.after(link);
        }
        const segCount = (result.segments || []).length;
        showToast(`Subtitles generated — ${segCount} segments. Subtitled video ready.`);
      } catch (err) {
        console.error('[RenderPage] Add Subtitles failed:', err);
        showToast('Service unavailable — please check configuration');
      } finally {
        if (spinner) spinner.hidden = true;
      }
    },
    'Generate Highlights': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      if (spinner) spinner.hidden = false;
      if (progressStatus) progressStatus.textContent = 'Detecting highlights...';
      try {
        const scenes = await generateHighlights(resolvedVideoUrl);
        if (!scenes || scenes.length === 0) {
          showToast('No highlight scenes detected');
          return;
        }
        const sceneList = scenes
          .map(
            (s, i) =>
              `  ${i + 1}. ${s.type || 'Scene'} @ ${s.startTime.toFixed(1)}s–${s.endTime.toFixed(1)}s (confidence: ${(s.confidence * 100).toFixed(0)}%)`
          )
          .join('\n');
        console.log('[RenderPage] Highlight scenes:\n' + sceneList);
        showToast(`${scenes.length} highlight scenes found — check console for details`);
      } catch (err) {
        console.error('[RenderPage] Generate Highlights failed:', err);
        showToast('Service unavailable — please check configuration');
      } finally {
        if (spinner) spinner.hidden = true;
      }
    },
    'Dub / Voiceover': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      const script = window.prompt('Enter voiceover script:');
      if (!script || !script.trim()) { showToast('Script is required for voiceover'); return; }
      if (spinner) spinner.hidden = false;
      if (progressStatus) progressStatus.textContent = 'Generating voiceover...';
      try {
        const narratedUrl = await generateVoiceover(script.trim(), resolvedVideoUrl);
        if (!narratedUrl) {
          showToast('Voiceover unavailable — Director/VideoDB not reachable');
          return;
        }
        // Director returns a narrated VIDEO (voiceover burned onto the footage).
        const video = document.createElement('video');
        video.src = narratedUrl;
        video.controls = true;
        video.crossOrigin = 'anonymous';
        video.className = 'mt-3 w-full rounded-2xl border border-white/10 bg-black/30';
        const badge = container.querySelector('#previewBadge');
        if (badge) {
          const wrapper = document.createElement('div');
          wrapper.className = 'mt-3';
          wrapper.appendChild(document.createTextNode('🎙️ Narrated video: '));
          wrapper.appendChild(video);
          badge.after(wrapper);
        }
        showToast('Voiceover generated — use the player below to preview');
      } catch (err) {
        console.error('[RenderPage] Dub / Voiceover failed:', err);
        showToast('Service unavailable — please check configuration');
      } finally {
        if (spinner) spinner.hidden = true;
      }
    },
    'Create Shorts': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      if (spinner) spinner.hidden = false;
      if (progressStatus) progressStatus.textContent = 'Planning short clips...';
      try {
        const shortPlan = await createShorts(resolvedVideoUrl);
        if (!shortPlan) {
          showToast('Could not generate short — no suitable scenes found');
          return;
        }
        console.log('[RenderPage] Short plan:', shortPlan);
        const previewBadgeEl = document.querySelector('#previewBadge');
        if (previewBadgeEl) {
          const shortBadge = document.createElement('div');
          shortBadge.className = 'mt-3 rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 px-4 py-3 text-xs text-fuchsia-100/80';
          shortBadge.innerHTML =
            `Short: ${shortPlan.aspectRatio} · ` +
            `${shortPlan.startTime.toFixed(1)}s – ${shortPlan.endTime.toFixed(1)}s · ` +
            `${shortPlan.duration.toFixed(1)}s duration · ` +
            `${shortPlan.scenes.length} scene(s)`;
          previewBadgeEl.after(shortBadge);
        }
        showToast(`Short planned: ${shortPlan.aspectRatio}, ${shortPlan.duration.toFixed(1)}s`);
      } catch (err) {
        console.error('[RenderPage] Create Shorts failed:', err);
        showToast('Service unavailable — please check configuration');
      } finally {
        if (spinner) spinner.hidden = true;
      }
    },
    'AI Auto-Edit': async () => {
      if (!resolvedVideoUrl) { showToast('Load a video first'); return; }
      if (spinner) spinner.hidden = false;
      if (progressStatus) progressStatus.textContent = 'Running AI auto-edit...';
      try {
        const plan = await runAiAutoEdit(resolvedVideoUrl, { captionStyle: selectedPreset });
        const sceneCount = (plan.scenes || []).length;
        const highlightCount = (plan.highlights || []).length;
        const subtitleCount = (plan.subtitles?.segments || []).length;
        console.log('[RenderPage] AI Auto-Edit plan:', plan);
        const editPlan = plan.plan && !plan.plan.error ? plan.plan : null;
        if (editPlan) {
          const badge = container.querySelector('#previewBadge');
          if (badge) {
            const planBadge = document.createElement('div');
            planBadge.className = 'mt-3 rounded-2xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-100/90';
            planBadge.innerHTML =
              `Auto-Edit plan: ${editPlan.summary} · ` +
              `${editPlan.sceneOrder.length} scenes · ` +
              `${editPlan.highlightCount} highlights · ` +
              `export: ${editPlan.recommendedExportProfile}`;
            badge.after(planBadge);
          }
          showToast(`AI Auto-Edit plan ready — ${editPlan.sceneOrder.length} scenes sequenced`);
        } else {
          showToast(
            `AI Auto-Edit complete: ${sceneCount} scenes, ${highlightCount} highlights, ${subtitleCount} subtitles`
          );
        }
      } catch (err) {
        console.error('[RenderPage] AI Auto-Edit failed:', err);
        showToast('Service unavailable — please check configuration');
      } finally {
        if (spinner) spinner.hidden = true;
      }
    },
  };

  // Action handler
  async function dispatchAction(action) {
    activeAction = action;
    const previewBadge = container.querySelector('#previewBadge');
    const handler = ACTION_HANDLERS[action];
    if (handler) {
      if (previewBadge) previewBadge.textContent = `${selectedPreset} · ${action}`;
      if (spinner) spinner.hidden = false;
      // Reflect the active action on the primary action buttons.
      if (actionBtnsRow) {
        actionBtnsRow.querySelectorAll('button').forEach(b => {
          const isActive = b.textContent === action;
          b.setAttribute('aria-pressed', String(isActive));
          b.className = `rounded-2xl px-5 py-3 text-sm font-medium transition ${isActive ? 'bg-white text-black shadow-xl hover:opacity-90' : 'border border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]'}`;
        });
      }
      try { await handler(); }
      catch (err) { console.error(`[RenderPage] Action "${action}" failed:`, err); showToast(`${action} failed: ${err.message}`); }
      finally {
        if (spinner) spinner.hidden = true;
        if (progressStatus) progressStatus.textContent = 'Ready';
        if (previewBadge) previewBadge.textContent = `${selectedPreset} · Ready`;
      }
      return;
    }
    const phase = PHASE_MAP[action];
    if (phase) {
      if (previewBadge) previewBadge.textContent = `${selectedPreset} · ${action}`;
      const phaseLabel = phase === 2 ? 'Phase 2' : phase === 3 ? 'Phase 3' : 'Phase 4';
      if (progressStatus) progressStatus.textContent = `${action} — ${phaseLabel}: coming soon`;
      showToast(`${action} — ${phaseLabel}: coming soon`);
      return;
    }
    console.warn(`[RenderPage] Unknown action: ${action}`);
  }

  // Preset selector
  function selectPreset(preset) {
    selectedPreset = preset;
    const presetLabel = container.querySelector('#presetLabel');
    const previewBadge = container.querySelector('#previewBadge');
    const presetDetailsEl = container.querySelector('#presetDetails');

    if (presetLabel) presetLabel.textContent = preset;
    if (previewBadge) previewBadge.textContent = `${preset} · Ready`;

    // Update preset buttons
    const presetsContainer = container.querySelector('#presetsContainer');
    if (presetsContainer) {
      presetsContainer.querySelectorAll('button').forEach(btn => {
        if (btn.textContent === preset) {
          btn.className = 'rounded-full border border-white bg-white text-black px-3 py-2 text-xs font-semibold transition';
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.className = 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/[0.08] transition';
          btn.setAttribute('aria-pressed', 'false');
        }
      });
    }

    // Update preset details
    const config = PRESET_CONFIG[preset];
    if (presetDetailsEl && config) {
      presetDetailsEl.innerHTML = `
        <div class="rounded-2xl border border-white/10 bg-black/20 p-3"><p class="text-[11px] uppercase tracking-[0.18em] text-white/70">Color Profile</p><p class="mt-2 text-sm font-semibold text-white">${config.colorProfile}</p></div>
        <div class="rounded-2xl border border-white/10 bg-black/20 p-3"><p class="text-[11px] uppercase tracking-[0.18em] text-white/70">Pacing</p><p class="mt-2 text-sm font-semibold text-white">${config.pacing}</p></div>
        <div class="rounded-2xl border border-white/10 bg-black/20 p-3"><p class="text-[11px] uppercase tracking-[0.18em] text-white/70">Export Profile</p><p class="mt-2 text-sm font-semibold text-white">${config.exportProfile}</p></div>
      `;
    }

    showToast(`Preset: ${preset}`);
  }

  // Cleanup function
  container.cleanup = () => {
    if (videoElement) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
      videoElement = null;
    }
    if (queueUnsubscribe) {
      queueUnsubscribe();
      queueUnsubscribe = null;
    }
    if (stopBackgroundProcessor) {
      stopBackgroundProcessor();
      stopBackgroundProcessor = null;
    }
    if (activeExportCleanup) {
      activeExportCleanup();
      activeExportCleanup = null;
    }
  };

  return container;
}
