import { navigate } from '../lib/router.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { showToast } from '../lib/loading.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { requireEntitlement } from '../lib/clerkEntitlements.js';

// OpenMontage backend is accessed via our Express proxy at /openmontage
const getOpenMontageBase = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') + '/openmontage';
  }
  if (typeof window !== 'undefined' && window.__BACKEND_URL__) {
    return window.__BACKEND_URL__.replace(/\/$/, '') + '/openmontage';
  }
  return '/openmontage';
};

const OPENMONTAGE_BACKEND = getOpenMontageBase();

const STAGES = [
  { id: 'brief', label: 'Brief', short: 'BRIEF' },
  { id: 'research', label: 'Research', short: 'RESEARCH' },
  { id: 'script', label: 'Script', short: 'SCRIPT' },
  { id: 'scene_plan', label: 'Scene Plan', short: 'SCENE PLAN' },
  { id: 'gate', label: 'The Gate', short: 'THE GATE' },
  { id: 'narration', label: 'Narration', short: 'NARRATION' },
  { id: 'music', label: 'Music', short: 'MUSIC' },
  { id: 'compose', label: 'Compose', short: 'COMPOSE' },
  { id: 'render', label: 'Render', short: 'RENDER' },
];

const PIPELINES = [
  { id: 'animated-explainer', name: 'Animated Explainer', description: 'AI-generated explainer with research, narration, visuals, music' },
  { id: 'documentary-montage', name: 'Documentary Montage', description: 'Thematic montage from free stock footage and open archives' },
  { id: 'cinematic', name: 'Cinematic', description: 'Trailer, teaser, and mood-driven edits' },
  { id: 'animation', name: 'Animation', description: 'Motion graphics, kinetic typography, animated sequences' },
  { id: 'avatar-spokesperson', name: 'Avatar Spokesperson', description: 'Avatar-driven presenter videos' },
  { id: 'clip-factory', name: 'Clip Factory', description: 'Batch of ranked short-form clips from one long source' },
  { id: 'hybrid', name: 'Hybrid', description: 'Source footage + AI-generated support visuals' },
  { id: 'localization-dub', name: 'Localization & Dub', description: 'Subtitle, dub, and translate existing video' },
  { id: 'podcast-repurpose', name: 'Podcast Repurpose', description: 'Podcast highlights to video' },
  { id: 'screen-demo', name: 'Screen Demo', description: 'Polished software screen recordings and walkthroughs' },
  { id: 'talking-head', name: 'Talking Head', description: 'Footage-led speaker videos' },
];

const OUTPUT_PROFILES = [
  { id: 'youtube-landscape', name: 'YouTube Landscape', resolution: '1920x1080', aspect: '16:9' },
  { id: 'youtube-shorts', name: 'YouTube Shorts', resolution: '1080x1920', aspect: '9:16' },
  { id: 'instagram-reels', name: 'Instagram Reels', resolution: '1080x1920', aspect: '9:16' },
  { id: 'tiktok', name: 'TikTok', resolution: '1080x1920', aspect: '9:16' },
  { id: 'cinematic', name: 'Cinematic', resolution: '2560x1080', aspect: '21:9' },
];

const SCENE_STATES = ['DONE', 'UNLOCKED', 'QUEUED', 'RENDERING'];

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getStatusStyle(status) {
  const map = {
    DONE: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
    RENDERING: 'text-primary border-primary/30 bg-primary/5',
    QUEUED: 'text-white/60 border-white/10 bg-white/5',
    UNLOCKED: 'text-white/80 border-white/20 bg-white/5',
  };
  return map[status] || map.QUEUED;
}

function formatCredits(total) {
  return `${total} CR ≈ $${(total / 100).toFixed(2)}`;
}

export function OpenMontagePage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center justify-center bg-app-bg relative overflow-x-hidden';
  mountStudioChrome(container, { currentRoute: 'video-agent' });

  const state = {
    stageIndex: 0,
    isProcessing: false,
    currentJobId: null,
    prompt: '',
    referenceVideo: '',
    audience: 'developers & platform teams',
    duration: '60s',
    tone: 'confident, plain-spoken',
    keyMessages: [
      'Detect before your users do',
      'Explain the why, not just the what',
      'One-click resolve from the alert',
    ],
    pipeline: 'animated-explainer',
    profile: 'youtube-landscape',
    scenes: [],
    chatMessages: [
      { from: 'user', text: 'Make the opening more dramatic' },
      { from: 'agent', text: 'Done — SC 01 now opens on a black slate with a hard music hit, narration delayed 1.5s. Want the grade darker too?' },
      { from: 'user', text: 'Replace scene 3 with the product screenshots I uploaded' },
      { from: 'agent', text: 'Swapped SC 03 to dashboard-walkthrough.mp4 — trimmed 0:12 from the 2:14 capture. Cost unchanged.' },
    ],
    decisionLog: [
      { label: 'Voice', choice: 'Warm male tenor — "Calder"', alternatives: 'also considered: female alto · neutral narrator' },
      { label: 'Music — "Minimal Pulse", licensed', choice: '', alternatives: '' },
      { label: 'Grade', choice: 'warm high-contrast', alternatives: '' },
    ],
    credits: { images: 64, narration: 5, music: 15, generatedClip: 125, captions: 0, render: 0, total: 209 },
    renders: [
      { label: '16:9 · LAUNCH', status: 'ready' },
      { label: '1:1 · FEED', status: 'ready' },
      { label: '9:16 · SHORTS', status: 'ready' },
    ],
    approvalStatus: 'pending',
    jobStatus: 'idle',
    completedStages: [],
    research: null,
    script: null,
    scenePlan: null,
    narration: null,
    music: null,
    compose: null,
    renderOutputs: null,
  };

  let pollTimer = null;

  // ── Hero ─────────────────────────────────────────────────────────────
  const hero = document.createElement('div');
  hero.className = 'w-full flex flex-col items-center pt-6 pb-4 px-4 md:px-8';
  const heroBanner = createHeroSection('videoagent', 'h-28 md:h-36 mb-4');
  if (heroBanner) {
    const heroContent = document.createElement('div');
    heroContent.className = 'absolute bottom-0 left-0 right-0 p-6 z-10';
    heroContent.innerHTML = `
      <h1 class="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight mb-1">OpenMontage Studio</h1>
      <p class="text-white/60 text-sm font-medium">Agentic video production — describe your video and we'll build it</p>
    `;
    heroBanner.appendChild(heroContent);
    hero.appendChild(heroBanner);
  }
  container.appendChild(hero);

  // ── Content wrapper ──────────────────────────────────────────────────
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'w-full max-w-7xl relative z-40 px-4 md:px-8 pb-10';

  // Back + service status
  const topBar = document.createElement('div');
  topBar.className = 'mb-6 flex items-center gap-2';
  topBar.innerHTML = `
    <button id="back-btn" class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white/70 hover:text-white">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Back
    </button>
    <span id="service-status" class="text-xs text-muted ml-2"></span>
  `;
  contentWrapper.appendChild(topBar);

  // Stage tracker
  const stageTrack = document.createElement('div');
  stageTrack.className = 'mb-8 overflow-x-auto';
  stageTrack.innerHTML = `
    <div class="flex items-center gap-1 min-w-max">
      ${STAGES.map((s, i) => {
        const isActive = i === state.stageIndex;
        const isCompleted = state.completedStages.includes(s.id);
        return `
          <button data-stage="${s.id}" class="om-stage-btn flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${isActive ? 'bg-white/10 border-white/20 text-white' : isCompleted ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/5 text-white/60 hover:text-white'}">
            <span class="text-[10px] font-black tracking-wider">${isCompleted && !isActive ? '✓ ' : ''}${s.short}</span>
          </button>
        ` + (i < STAGES.length - 1 ? `<span class="text-white/20 text-xs">✦</span>` : '');
      }).join('')}
    </div>
  `;
  contentWrapper.appendChild(stageTrack);

  // Main layout
  const main = document.createElement('div');
  main.className = 'grid grid-cols-1 lg:grid-cols-12 gap-6';

  // Library sidebar
  const librarySidebar = document.createElement('div');
  librarySidebar.className = 'lg:col-span-3 flex flex-col gap-4';
  librarySidebar.innerHTML = `
    <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 shadow-3xl">
      <h3 class="text-[10px] font-black text-white/80 tracking-wide mb-3">LIBRARY</h3>
      <div class="space-y-2">
        <div class="border border-white/5 rounded-xl p-2 bg-white/[0.02]">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-white truncate">Trellis 2.0 Launch</span>
            <span class="text-[9px] font-black text-emerald-400">● IN PRODUCTION</span>
          </div>
          <div class="text-[10px] text-muted">PROD Nº 0042 · V3</div>
          <div class="text-[10px] text-muted">GEN SPEND $0.16</div>
        </div>
        <div class="border border-white/5 rounded-xl p-2 bg-white/[0.02]">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-white truncate">Q3 Sales Enablement</span>
            <span class="text-[9px] font-black text-white/40">DRAFT</span>
          </div>
        </div>
        <div class="border border-white/5 rounded-xl p-2 bg-white/[0.02]">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-white truncate">API Quickstart Tutorial</span>
            <span class="text-[9px] font-black text-white/40">DELIVERED · JUN 30</span>
          </div>
        </div>
      </div>
    </div>
    <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 shadow-3xl">
      <h3 class="text-[10px] font-black text-white/80 tracking-wide mb-3">ASSETS</h3>
      <div class="space-y-2">
        <div class="flex items-center gap-2 py-1">
          <span class="text-xs">📁</span>
          <span class="text-[11px] text-white/80 truncate">Trellis Brand Kit</span>
        </div>
        <div class="flex items-center gap-2 py-1">
          <span class="text-xs">🎬</span>
          <span class="text-[11px] text-white/80 truncate">dashboard-walkthrough.mp4</span>
          <span class="text-[10px] text-muted ml-auto">2:14</span>
        </div>
        <div class="flex items-center gap-2 py-1">
          <span class="text-xs">📁</span>
          <span class="text-[11px] text-white/80 truncate">team-photos/</span>
          <span class="text-[10px] text-muted ml-auto">12 IMG</span>
        </div>
        <div class="flex items-center gap-2 py-1">
          <span class="text-xs">🖼️</span>
          <span class="text-[11px] text-white/80 truncate">trellis-logo.svg</span>
          <span class="text-[10px] text-muted ml-auto">SVG</span>
        </div>
      </div>
      <button class="mt-3 w-full py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all">⊕ ADD ASSETS</button>
    </div>
  `;

  // Main content column
  const contentCol = document.createElement('div');
  contentCol.className = 'lg:col-span-5 flex flex-col gap-6';

  // Stage content card (dynamic)
  const stageContentCard = document.createElement('div');
  stageContentCard.id = 'om-stage-content';
  stageContentCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  stageContentCard.innerHTML = getStageContentHTML(state);
  contentCol.appendChild(stageContentCard);

  // Scene board
  const sceneBoard = document.createElement('div');
  sceneBoard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  sceneBoard.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xs font-black text-white/80 tracking-wide">STORYBOARD — ${state.scenes.length || 0} SCENES</h2>
      <div class="flex items-center gap-2">
        <button id="om-add-scene" class="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all">⊕ Add scene</button>
        <button id="om-regen-scene" class="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all">↻ Regenerate unlocked</button>
      </div>
    </div>
    <p class="text-[10px] text-muted mb-3">DRAG TO REORDER · CLICK ANY CARD TO EDIT DIRECTLY — OR JUST TELL THE AGENT</p>
    <div id="om-scenes" class="space-y-3">
      ${renderSceneCards(state.scenes)}
    </div>
  `;
  contentCol.appendChild(sceneBoard);

  // Renders
  const rendersCard = document.createElement('div');
  rendersCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  rendersCard.innerHTML = `
    <h2 class="text-xs font-black text-white/80 tracking-wide mb-3">RENDERS</h2>
    <div id="om-renders" class="flex flex-wrap gap-2 mb-3">
      ${renderRenders(state.renders)}
    </div>
    <div id="om-provenance" class="hidden pt-3 border-t border-white/5">
      <div class="text-[10px] font-black text-white/60 mb-2">PROVENANCE REPORT</div>
      <div class="text-[10px] text-muted space-y-1">
        <div>SOURCE · <span id="om-prov-source">—</span></div>
        <div>LICENSE · <span id="om-prov-license">—</span></div>
        <div>MODEL · <span id="om-prov-model">—</span></div>
      </div>
    </div>
  `;
  contentCol.appendChild(rendersCard);

  // Right column
  const right = document.createElement('div');
  right.className = 'lg:col-span-4 flex flex-col gap-6';

  // Chat card
  const chatCard = document.createElement('div');
  chatCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] overflow-hidden shadow-3xl flex flex-col';
  chatCard.innerHTML = `
    <div class="px-5 py-4 border-b border-white/10 flex items-center justify-between">
      <div>
        <h3 class="text-xs font-black text-white/80 tracking-wide">PRODUCTION CHAT</h3>
        <p id="om-chat-status" class="text-[10px] text-emerald-400 font-bold mt-0.5">● AGENT ACTIVE</p>
      </div>
      <span class="text-[10px] text-muted">Claude · Opus 4.8 · Effort · High</span>
    </div>
    <div id="om-chat" class="flex-1 p-4 space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
      ${state.chatMessages.map(m => `
        <div class="flex flex-col ${m.from === 'user' ? 'items-end' : 'items-start'}" data-from="${m.from}">
          <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] ${m.from === 'user' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80'}">${escapeHtml(m.text)}</div>
          <span class="text-[10px] text-muted mt-1">${m.from === 'user' ? 'YOU' : 'MONTAGE'}</span>
        </div>
      `).join('')}
    </div>
    <div class="p-3 border-t border-white/10">
      <div class="flex gap-2">
        <input id="om-chat-input" placeholder="Direct the agent…" class="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary/50" />
        <button id="om-chat-send" class="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all">Send</button>
      </div>
    </div>
  `;
  right.appendChild(chatCard);

  // Decision log card
  const decisionCard = document.createElement('div');
  decisionCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  decisionCard.innerHTML = `
    <h3 class="text-xs font-black text-white/80 tracking-wide mb-3">DECISION LOG</h3>
    <div id="om-decisions" class="space-y-3">
      ${renderDecisionLog(state.decisionLog)}
    </div>
  `;
  right.appendChild(decisionCard);

  main.appendChild(librarySidebar);
  main.appendChild(contentCol);
  main.appendChild(right);
  contentWrapper.appendChild(main);

  container.appendChild(contentWrapper);

  // ── Element refs ─────────────────────────────────────────────────────
  const promptEl = container.querySelector('#om-prompt');
  const generateBtn = container.querySelector('#om-generate');
  const backBtn = container.querySelector('#back-btn');
  const approveBtn = container.querySelector('#om-approve');
  const reviseBtn = container.querySelector('#om-revise');
  const chatInput = container.querySelector('#om-chat-input');
  const chatSend = container.querySelector('#om-chat-send');
  const chatBox = container.querySelector('#om-chat');
  const serviceStatus = container.querySelector('#service-status');
  const keyStatus = container.querySelector('#om-key-status');
  const stageContent = container.querySelector('#om-stage-content');
  const scenesEl = container.querySelector('#om-scenes');
  const rendersEl = container.querySelector('#om-renders');
  const decisionsEl = container.querySelector('#om-decisions');
  const chatStatusEl = container.querySelector('#om-chat-status');

  // ── API helpers ──────────────────────────────────────────────────────
  async function api(path, options = {}) {
    const res = await fetch(`${OPENMONTAGE_BACKEND}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenMontage ${res.status}: ${text || res.statusText}`);
    }
    return res.json().catch(() => ({}));
  }

  async function fetchProductionState() {
    if (!state.currentJobId) return;
    try {
      const data = await api(`/api/productions/${encodeURIComponent(state.currentJobId)}`);
      if (data.stage) {
        const idx = STAGES.findIndex(s => s.id === data.stage);
        if (idx >= 0) state.stageIndex = idx;
      }
      if (data.completedStages) state.completedStages = data.completedStages;
      if (data.status) state.jobStatus = data.status;
      if (data.scenes) state.scenes = data.scenes;
      if (data.chatMessages) state.chatMessages = data.chatMessages;
      if (data.decisionLog) state.decisionLog = data.decisionLog;
      if (data.credits) state.credits = data.credits;
      if (data.renders) state.renders = data.renders;
      if (data.approvalStatus) state.approvalStatus = data.approvalStatus;
      if (data.research) state.research = data.research;
      if (data.script) state.script = data.script;
      if (data.scenePlan) state.scenePlan = data.scenePlan;
      if (data.narration) state.narration = data.narration;
      if (data.music) state.music = data.music;
      if (data.compose) state.compose = data.compose;
      if (data.renderOutputs) state.renderOutputs = data.renderOutputs;
      refreshUI();
    } catch (err) {
      console.warn('[OpenMontagePage] poll failed:', err.message);
    }
  }

  async function sendChatMessage() {
    const text = (chatInput && chatInput.value || '').trim();
    if (!text || !state.currentJobId) return;
    appendChat('user', text);
    chatInput.value = '';
    try {
      await api(`/api/productions/${encodeURIComponent(state.currentJobId)}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });
      setTimeout(() => fetchProductionState(), 1200);
    } catch (err) {
      showToast('Chat failed: ' + err.message, 'error');
    }
  }

  function startPolling() {
    stopPolling();
    if (!state.currentJobId) return;
    pollTimer = setInterval(() => {
      fetchProductionState();
      if (['completed', 'failed', 'cancelled'].includes(state.jobStatus)) {
        stopPolling();
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  // ── UI refresh ───────────────────────────────────────────────────────
  function refreshUI() {
    const buttons = stageTrack.querySelectorAll('.om-stage-btn');
    buttons.forEach((btn, i) => {
      const isActive = i === state.stageIndex;
      const isCompleted = state.completedStages.includes(STAGES[i].id);
      btn.className = 'om-stage-btn flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ' + (isActive ? 'bg-white/10 border-white/20 text-white' : isCompleted ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/5 text-white/60 hover:text-white');
      btn.innerHTML = `<span class="text-[10px] font-black tracking-wider">${isCompleted && !isActive ? '✓ ' : ''}${STAGES[i].short}</span>`;
    });

    if (stageContent) {
      stageContent.innerHTML = getStageContentHTML(state);
      wireStageContentEvents();
    }

    if (scenesEl) scenesEl.innerHTML = renderSceneCards(state.scenes);
    if (rendersEl) rendersEl.innerHTML = renderRenders(state.renders);
    if (decisionsEl) decisionsEl.innerHTML = renderDecisionLog(state.decisionLog);

    if (chatBox) {
      chatBox.innerHTML = state.chatMessages.map(m => `
        <div class="flex flex-col ${m.from === 'user' ? 'items-end' : 'items-start'}" data-from="${m.from}">
          <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] ${m.from === 'user' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80'}">${escapeHtml(m.text)}</div>
          <span class="text-[10px] text-muted mt-1">${m.from === 'user' ? 'YOU' : 'MONTAGE'}</span>
        </div>
      `).join('');
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    if (approveBtn) {
      approveBtn.disabled = state.approvalStatus === 'approved';
      approveBtn.textContent = state.approvalStatus === 'approved' ? 'Approved ✓' : 'Approve — go produce';
    }
    if (chatStatusEl) {
      chatStatusEl.textContent = state.jobStatus === 'idle' ? '● AGENT ACTIVE' : `● ${state.jobStatus.toUpperCase()}`;
      chatStatusEl.className = 'text-[10px] font-bold mt-0.5 ' + (state.jobStatus === 'failed' ? 'text-red-400' : 'text-emerald-400');
    }
  }

  // ── Stage content renderer ───────────────────────────────────────────
  function getStageContentHTML(s) {
    const idx = s.stageIndex;
    const stageId = STAGES[idx]?.id;

    if (stageId === 'brief') return renderBriefContent(s);
    if (stageId === 'research') return renderResearchContent(s);
    if (stageId === 'script') return renderScriptContent(s);
    if (stageId === 'scene_plan') return renderScenePlanContent(s);
    if (stageId === 'gate') return renderGateContent(s);
    if (stageId === 'narration') return renderNarrationContent(s);
    if (stageId === 'music') return renderMusicContent(s);
    if (stageId === 'compose') return renderComposeContent(s);
    if (stageId === 'render') return renderRenderContent(s);
    return renderBriefContent(s);
  }

  function wireStageContentEvents() {
    const stagePrompt = container.querySelector('#om-prompt');
    const stageAudience = container.querySelector('#om-audience');
    const stageDuration = container.querySelector('#om-duration');
    const stageGenerate = container.querySelector('#om-generate');
    const stageApprove = container.querySelector('#om-approve');
    const stageRevise = container.querySelector('#om-revise');
    const stageReference = container.querySelector('#om-reference-video');
    const stageChatInput = container.querySelector('#om-chat-input');
    const stageChatSend = container.querySelector('#om-chat-send');

    if (stageGenerate) stageGenerate.onclick = () => submitProduction();
    if (stageApprove) stageApprove.onclick = () => approveProduction();
    if (stageRevise) stageRevise.onclick = () => reviseProduction();
    if (stageChatSend && stageChatInput) {
      stageChatSend.onclick = () => sendChatMessage();
      stageChatInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendChatMessage();
        }
      };
    }
  }

  function renderBriefContent(s) {
    const assets = [
      { name: 'brand-kit/', type: 'folder', icon: '📁' },
      { name: 'dashboard.mp4', type: 'video', icon: '🎬' },
      { name: 'team-photos/', type: 'folder', icon: '📁' },
      { name: 'trellis-logo.svg', type: 'image', icon: '🖼️' },
    ];
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-black text-white/80 tracking-wide">BRIEF</h2>
        <span class="text-[10px] text-muted">${s.duration} · ${s.tone}</span>
      </div>
      <div class="mb-4">
        <label class="block text-[10px] font-bold text-white/60 mb-1 tracking-wide">REFERENCE VIDEO (OPTIONAL)</label>
        <input id="om-reference-video" value="${escapeHtml(s.referenceVideo)}" placeholder="Paste a YouTube, Reel, or TikTok URL..." class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
      </div>
      <textarea id="om-prompt" rows="3" placeholder="Make a 60-second launch video for our monitoring tool — use the brand kit and the dashboard recording. Developer audience." class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 resize-none mb-3">${escapeHtml(s.prompt)}</textarea>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label class="block text-[10px] font-bold text-white/60 mb-1 tracking-wide">AUDIENCE</label>
          <input id="om-audience" value="${escapeHtml(s.audience)}" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-white/60 mb-1 tracking-wide">DURATION</label>
          <input id="om-duration" value="${escapeHtml(s.duration)}" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
        </div>
      </div>
      <div class="mb-4">
        <label class="block text-[10px] font-bold text-white/60 mb-1 tracking-wide">PIPELINE</label>
        <select id="om-pipeline" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50">
          ${PIPELINES.map(p => `<option value="${p.id}" ${s.pipeline === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="mb-4">
        <label class="block text-[10px] font-bold text-white/60 mb-1 tracking-wide">OUTPUT PROFILE</label>
        <select id="om-profile" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50">
          ${OUTPUT_PROFILES.map(p => `<option value="${p.id}" ${s.profile === p.id ? 'selected' : ''}>${p.name} (${p.aspect})</option>`).join('')}
        </select>
      </div>
      <div class="mb-4">
        <label class="block text-[10px] font-bold text-white/60 mb-1 tracking-wide">ASSETS</label>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          ${assets.map(a => `
            <div class="border border-white/5 rounded-xl p-2 bg-white/[0.02] flex items-center gap-2">
              <span class="text-lg">${a.icon}</span>
              <div class="min-w-0">
                <div class="text-[11px] font-bold text-white truncate">${escapeHtml(a.name)}</div>
                <div class="text-[10px] text-muted">${a.type}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <span class="text-[10px] font-bold text-white/60 tracking-wide">KEY MESSAGES</span>
        ${s.keyMessages.map((m, i) => `
          <span class="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white/80">${i + 1} · ${escapeHtml(m)}</span>
        `).join('')}
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button id="om-attach" class="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          Add asset
        </button>
        <button id="om-generate" class="flex-1 py-2.5 btn-primary-modern font-black rounded-xl hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Generate Video
        </button>
      </div>
      <p id="om-key-status" class="text-[11px] text-muted mt-2"></p>
      <p id="om-production-status" class="text-[11px] text-muted mt-1 hidden"></p>
    `;
  }

  function renderResearchContent(s) {
    if (!s.research) {
      return `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xs font-black text-white/80 tracking-wide">RESEARCH</h2>
          <span class="text-[10px] text-muted">${s.jobStatus === 'running' ? 'Agent is researching…' : 'Waiting to start'}</span>
        </div>
        <div class="text-xs text-muted space-y-2">
          <p>Research runs live web search across YouTube, Reddit, news sites, and academic sources before writing a single word of script.</p>
          ${s.jobStatus === 'running' ? '<p class="text-emerald-400">Gathering data points, audience questions, trending angles, and visual references…</p>' : ''}
        </div>
      `;
    }
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-black text-white/80 tracking-wide">RESEARCH</h2>
        <span class="text-[10px] text-emerald-400">FINDINGS RECORDED IN THE DECISION LOG</span>
      </div>
      <div class="space-y-3">
        ${(s.research.findings || []).map(f => `
          <div class="border border-white/5 rounded-xl p-3 bg-white/[0.02]">
            <div class="text-[11px] font-bold text-white mb-1">${escapeHtml(f.title || f.heading || 'Finding')}</div>
            <p class="text-[11px] text-white/70">${escapeHtml(f.body || f.summary || '')}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderScriptContent(s) {
    if (!s.script) {
      return `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xs font-black text-white/80 tracking-wide">SCRIPT</h2>
          <span class="text-[10px] text-muted">${s.jobStatus === 'running' ? 'Writing screenplay…' : 'Waiting for research'}</span>
        </div>
        <div class="text-xs text-muted">A screenplay, not a caption. The agent writes scene headings, action, V.O., and B-roll notes.</div>
      `;
    }
    const pages = s.script.pages || [];
    const voLines = pages.reduce((acc, p) => acc + (p.voLines || 0), 0);
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-black text-white/80 tracking-wide">SCRIPT</h2>
        <span class="text-[10px] text-muted">${s.script.readTime || ''} READ TIME · ${voLines} VO LINES</span>
      </div>
      <div class="space-y-3 font-mono text-xs">
        ${pages.map((p, i) => `
          <div class="border border-white/5 rounded-xl p-3 bg-white/[0.02]">
            <div class="text-[10px] font-black text-white/60 mb-1">SC ${String(i + 1).padStart(2, '0')} · ${escapeHtml(p.heading || '')}</div>
            ${p.body ? `<p class="text-[11px] text-white/80 whitespace-pre-wrap mb-1">${escapeHtml(p.body)}</p>` : ''}
            ${p.bRoll ? `<p class="text-[10px] text-muted">[B-ROLL — ${escapeHtml(p.bRoll)}]</p>` : ''}
            ${p.vo ? `<p class="text-[10px] text-emerald-400/80 mt-1">V.O. — ${escapeHtml(p.vo)}</p>` : ''}
          </div>
        `).join('')}
      </div>
      <p class="text-[10px] text-muted mt-2">B-ROLL NOTED PER LINE</p>
    `;
  }

  function renderScenePlanContent(s) {
    if (!s.scenePlan) {
      return `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xs font-black text-white/80 tracking-wide">SCENE PLAN</h2>
          <span class="text-[10px] text-muted">${s.jobStatus === 'running' ? 'Planning scenes…' : 'Waiting for script'}</span>
        </div>
        <div class="text-xs text-muted">A medium chosen for each scene. Draft sketches before any premium spend.</div>
      `;
    }
    const scenes = s.scenePlan.scenes || [];
    const grouped = scenes.reduce((acc, sc) => {
      const key = sc.type || 'OTHER';
      if (!acc[key]) acc[key] = [];
      acc[key].push(sc);
      return acc;
    }, {});
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-black text-white/80 tracking-wide">SCENE PLAN</h2>
        <span class="text-[10px] text-muted">MIXED</span>
      </div>
      <div class="space-y-3">
        ${Object.entries(grouped).map(([type, group]) => {
          const indices = group.map(sc => scenes.indexOf(sc) + 1);
          const ranges = indices.length === 1 ? `SC ${String(indices[0]).padStart(2, '0')}` : `SC ${String(indices[0]).padStart(2, '0')}–${String(indices[indices.length - 1]).padStart(2, '0')}`;
          const cost = group.reduce((sum, sc) => sum + (Number(sc.cost) || 0), 0);
          return `
            <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <span class="text-[11px] font-bold text-white">${ranges} · ${escapeHtml(type)}</span>
              </div>
              <span class="text-[11px] font-black text-white">${cost} CR</span>
            </div>
          `;
        }).join('')}
      </div>
      <p class="text-[10px] text-muted mt-2">Your own assets, your library, stock, or generated — proposed scene by scene, and yours to change.</p>
    `;
  }

  function renderGateContent(s) {
    const credits = s.credits || {};
    const total = credits.total || 0;
    const labels = { images: '8 standard images', narration: 'narration · 60s', music: 'music · "Focused Build"', generatedClip: '1 generated clip · 5s', captions: 'captions', render: 'stock · render' };
    const entries = Object.entries(credits).filter(([k]) => k !== 'total');
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-black text-white/80 tracking-wide">THE GATE</h2>
        <span id="om-gate-status" class="text-[10px] ${s.approvalStatus === 'pending' ? 'text-amber-400' : 'text-emerald-400'} font-bold">${s.approvalStatus === 'pending' ? 'AWAITING APPROVAL' : s.approvalStatus === 'approved' ? 'APPROVED' : 'REVISION REQUESTED'}</span>
      </div>
      <div class="space-y-2 mb-4">
        ${entries.map(([key, value]) => {
          const label = labels[key] || key;
          return `
            <div class="flex items-center justify-between py-2 border-b border-white/5">
              <span class="text-xs text-white/70">${label}</span>
              <span class="text-xs font-black text-white">${value} CR</span>
            </div>
          `;
        }).join('')}
      </div>
      <div class="flex items-center justify-between mb-4">
        <span class="text-xs font-bold text-white">EST. TOTAL</span>
        <span class="text-sm font-black text-white">${formatCredits(total)}</span>
      </div>
      <div class="flex items-center gap-2">
        <button id="om-approve" class="flex-1 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black rounded-xl hover:bg-emerald-500/20 transition-all text-sm ${s.approvalStatus === 'approved' ? 'opacity-50 cursor-not-allowed' : ''}">${s.approvalStatus === 'approved' ? 'Approved ✓' : 'Approve — go produce'}</button>
        <button id="om-revise" class="px-4 py-2.5 bg-white/5 border border-white/10 text-white/70 font-bold rounded-xl hover:bg-white/10 transition-all text-sm">Revise</button>
      </div>
    `;
  }

  function renderNarrationContent(s) {
    if (!s.narration) {
      return `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xs font-black text-white/80 tracking-wide">NARRATION</h2>
          <span class="text-[10px] text-muted">${s.jobStatus === 'running' ? 'Generating narration…' : 'Waiting for gate approval'}</span>
        </div>
        <div class="text-xs text-muted">A voice you can give notes to. Select a sentence and attach notes to that span.</div>
      `;
    }
    const bars = Array.from({ length: 40 }, () => Math.random() * 100);
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-black text-white/80 tracking-wide">NARRATION</h2>
        <span class="text-[10px] text-muted">${s.narration.duration || ''} · ${s.narration.credits || 0} CR</span>
      </div>
      <div class="space-y-3">
        <div class="border border-white/5 rounded-xl p-3 bg-white/[0.02]">
          <div class="text-[11px] font-bold text-white mb-1">${escapeHtml(s.narration.voice || 'Voice')} — ${escapeHtml(s.narration.gender || '')} · ${escapeHtml(s.narration.language || 'EN')}</div>
          <p class="text-[11px] text-white/70 italic mb-2">"…${escapeHtml((s.narration.sample || '').slice(0, 120))}…"</p>
          <div class="flex items-end gap-[2px] h-8">
            ${bars.map(h => `<div class="flex-1 bg-primary/40 rounded-full" style="height: ${h}%"></div>`).join('')}
          </div>
        </div>
        ${(s.narration.lines || []).map((line, i) => `
          <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span class="text-[11px] text-white/80">${i + 1}. ${escapeHtml(line.text)}</span>
            <button class="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all">+ Note</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderMusicContent(s) {
    if (!s.music) {
      return `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xs font-black text-white/80 tracking-wide">MUSIC</h2>
          <span class="text-[10px] text-muted">${s.jobStatus === 'running' ? 'Choosing music…' : 'Waiting for gate approval'}</span>
        </div>
        <div class="text-xs text-muted">Music chosen for the cut. Beat markers you can cut against.</div>
      `;
    }
    const beats = s.music.beats || [];
    const totalBeats = Math.max(beats.length, 8);
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-black text-white/80 tracking-wide">MUSIC</h2>
        <span class="text-[10px] text-muted">${s.music.credits || 0} CR</span>
      </div>
      <div class="space-y-3">
        <div class="border border-white/5 rounded-xl p-3 bg-white/[0.02]">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-white">"${escapeHtml(s.music.title || 'Untitled')}"</span>
            <span class="text-[10px] text-muted">${escapeHtml(s.music.license || '')}</span>
          </div>
          <div class="text-[10px] text-white/60">${s.music.bpm || ''} BPM · ${escapeHtml(s.music.energy || '')} · ${escapeHtml(s.music.duration || '')}</div>
        </div>
        <div class="relative h-8 bg-white/5 rounded-lg overflow-hidden">
          <div class="absolute inset-0 flex items-end gap-[2px] px-1 pb-1">
            ${beats.map(b => `
              <div class="flex-1 bg-primary/60 rounded-t" style="height: ${b.intensity || 50}%"></div>
            `).join('')}
            ${Array.from({ length: totalBeats - beats.length }, () => `<div class="flex-1 bg-white/5 rounded-t" style="height: 10%"></div>`).join('')}
          </div>
          ${beats.map(b => `
            <div class="absolute bottom-0 w-px bg-white/20" style="left: ${((beats.indexOf(b) + 1) / totalBeats) * 100}%; height: 100%"></div>
          `).join('')}
        </div>
        <p class="text-[10px] text-muted">BEAT MARKERS YOU CAN CUT AGAINST</p>
      </div>
    `;
  }

  function renderComposeContent(s) {
    if (!s.compose) {
      return `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xs font-black text-white/80 tracking-wide">COMPOSE</h2>
          <span class="text-[10px] text-muted">${s.jobStatus === 'running' ? 'Assembling…' : 'Waiting for assets'}</span>
        </div>
        <div class="text-xs text-muted">Assembled to brand rules. Watch a draft before render.</div>
      `;
    }
    const checks = s.compose.checks || [];
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-black text-white/80 tracking-wide">COMPOSE</h2>
        <span class="text-[10px] text-emerald-400">REVIEWED</span>
      </div>
      <div class="space-y-2">
        ${checks.map(c => `
          <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span class="text-xs text-white/70">${escapeHtml(c.label || c.name || 'Check')}</span>
            <span class="text-[10px] font-black ${c.passed ? 'text-emerald-400' : 'text-red-400'}">${c.passed ? 'PASS' : 'FAIL'}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderRenderContent(s) {
    if (!s.renderOutputs) {
      return `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xs font-black text-white/80 tracking-wide">RENDER</h2>
          <span class="text-[10px] text-muted">${s.jobStatus === 'running' ? 'Rendering…' : 'Waiting for compose'}</span>
        </div>
        <div class="text-xs text-muted">The formats you need. Yours to keep. Rendered on your machine, no watermark.</div>
      `;
    }
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-black text-white/80 tracking-wide">RENDER</h2>
        <span class="text-[10px] text-emerald-400">COMPLETE</span>
      </div>
      <div class="space-y-3">
        ${(s.renderOutputs.formats || []).map(f => `
          <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span class="text-xs font-bold text-white">${escapeHtml(f.label || f.aspect || 'Render')}</span>
            <span class="text-[10px] text-emerald-400">${escapeHtml(f.status || 'ready')}</span>
          </div>
        `).join('')}
        ${s.renderOutputs.provenance ? `
          <div class="mt-3 pt-3 border-t border-white/5">
            <div class="text-[10px] font-black text-white/60 mb-2">PROVENANCE REPORT</div>
            <div class="text-[10px] text-muted space-y-1">
              <div>SOURCE · ${escapeHtml(s.renderOutputs.provenance.source || '—')}</div>
              <div>LICENSE · ${escapeHtml(s.renderOutputs.provenance.license || '—')}</div>
              <div>MODEL · ${escapeHtml(s.renderOutputs.provenance.model || '—')}</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── Scene board renderer ─────────────────────────────────────────────
  function renderSceneCards(scenes) {
    if (!scenes || scenes.length === 0) {
      return '<div class="text-xs text-muted">No scenes yet.</div>';
    }
    const thumbColors = ['from-gray-700 to-gray-600', 'from-blue-900 to-blue-800', 'from-purple-900 to-purple-800', 'from-emerald-900 to-emerald-800', 'from-amber-900 to-amber-800', 'from-rose-900 to-rose-800'];
    return scenes.map((sc, i) => {
      const status = sc.status || 'QUEUED';
      const thumb = thumbColors[i % thumbColors.length];
      return `
        <div class="border border-white/10 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all overflow-hidden" data-scene-index="${i}" draggable="true">
          <div class="flex items-start gap-3 p-3 md:p-4">
            <div class="flex flex-col items-center gap-1 pt-1 cursor-grab active:cursor-grabbing">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-white/30"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
              <span class="text-[10px] font-black text-white/60">${String(i + 1).padStart(2, '0')}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-white truncate">${escapeHtml(sc.label || sc.title || 'Untitled')}</span>
                <span class="text-[10px] font-black px-2 py-0.5 rounded-lg border ${getStatusStyle(status)} ml-2">${status}</span>
              </div>
              <div class="flex items-center gap-3 mb-3">
                <span class="text-[11px] text-white/60">${escapeHtml(sc.type || '')}</span>
                <span class="text-[11px] text-muted">${escapeHtml(sc.duration || sc.time || '')}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-black text-white">${escapeHtml(sc.cost || '$0.00')}</span>
                <button class="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all">↻ Regenerate</button>
              </div>
            </div>
            <div class="w-16 h-10 rounded-lg bg-gradient-to-br ${thumb} opacity-60 shrink-0"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderRenders(renders) {
    if (!renders || renders.length === 0) {
      return '<div class="text-xs text-muted">No renders yet.</div>';
    }
    return renders.map(r => `
      <span class="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/80">${escapeHtml(r.label || r.aspect || 'Render')} <span class="text-emerald-400 ml-1">${escapeHtml(r.status || 'ready')}</span></span>
    `).join('');
  }

  function renderDecisionLog(decisions) {
    if (!decisions || decisions.length === 0) {
      return '<div class="text-xs text-muted">No decisions yet.</div>';
    }
    return decisions.map(d => `
      <div class="border-b border-white/5 pb-3 last:border-0 last:pb-0">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-white">${escapeHtml(d.label)}</span>
          <span class="text-[10px] text-muted">${escapeHtml(d.version || '3▴')}</span>
        </div>
        <p class="text-[11px] text-white/70">${escapeHtml(d.choice || '—')}</p>
        ${d.alternatives ? `<p class="text-[10px] text-muted mt-1">${escapeHtml(d.alternatives)}</p>` : ''}
      </div>
    `).join('');
  }

  function appendChat(from, text) {
    if (!chatBox) return;
    const row = document.createElement('div');
    row.className = 'flex flex-col ' + (from === 'user' ? 'items-end' : 'items-start');
    row.setAttribute('data-from', from);
    row.innerHTML = `
      <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] ${from === 'user' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80'}">${escapeHtml(text)}</div>
      <span class="text-[10px] text-muted mt-1">${from === 'user' ? 'YOU' : 'MONTAGE'}</span>
    `;
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // ── Actions ──────────────────────────────────────────────────────────
  async function submitProduction() {
    const prompt = (promptEl && promptEl.value || '').trim();
    if (!prompt) {
      showToast('Please enter a production brief', 'error');
      return;
    }
    if (!(await requireEntitlement())) return;
    if (!OPENMONTAGE_BACKEND) {
      showToast('OpenMontage service not configured', 'error');
      return;
    }

    state.prompt = prompt;
    state.referenceVideo = (container.querySelector('#om-reference-video')?.value || '').trim();
    state.audience = (container.querySelector('#om-audience')?.value || state.audience).trim();
    state.duration = (container.querySelector('#om-duration')?.value || state.duration).trim();
    state.pipeline = (container.querySelector('#om-pipeline')?.value || state.pipeline);
    state.profile = (container.querySelector('#om-profile')?.value || state.profile);
    state.isProcessing = true;
    const currentGenerateBtn = container.querySelector('#om-generate');
    if (currentGenerateBtn) currentGenerateBtn.disabled = true;

    const productionStatus = container.querySelector('#om-production-status');
    if (productionStatus) {
      productionStatus.textContent = 'Starting production…';
      productionStatus.classList.remove('hidden');
    }

    try {
      const data = await api('/api/productions', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          referenceVideo: state.referenceVideo,
          pipeline: state.pipeline,
          profile: state.profile,
          action: 'start',
          audience: state.audience,
          duration: state.duration,
          tone: state.tone,
          keyMessages: state.keyMessages,
        }),
      });
      state.currentJobId = data.jobId || data.id || null;
      if (!state.currentJobId) throw new Error('Missing job id');
      showToast('Production started', 'success');
      state.jobStatus = 'running';
      startPolling();
    } catch (err) {
      console.error('[OpenMontagePage] production failed:', err);
      showToast('Production failed: ' + err.message, 'error');
      state.isProcessing = false;
      const currentGenerateBtn = container.querySelector('#om-generate');
      if (currentGenerateBtn) currentGenerateBtn.disabled = false;
      if (productionStatus) productionStatus.classList.add('hidden');
    }
  }

  async function approveProduction() {
    if (!state.currentJobId) return;
    if (state.approvalStatus === 'approved') return;
    try {
      await api(`/api/productions/${encodeURIComponent(state.currentJobId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved: true }),
      });
      state.approvalStatus = 'approved';
      showToast('Approved — production continuing', 'success');
      refreshUI();
    } catch (err) {
      showToast('Approval failed: ' + err.message, 'error');
    }
  }

  async function reviseProduction() {
    if (!state.currentJobId) return;
    try {
      await api(`/api/productions/${encodeURIComponent(state.currentJobId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved: false, note: 'Revise requested from studio' }),
      });
      state.approvalStatus = 'revised';
      showToast('Revise requested — prompt the agent in chat', 'info');
      refreshUI();
    } catch (err) {
      showToast('Revision request failed: ' + err.message, 'error');
    }
  }

  // ── Event wiring ─────────────────────────────────────────────────────
  if (backBtn) backBtn.onclick = () => navigate('render');
  if (approveBtn) approveBtn.onclick = () => approveProduction();
  if (reviseBtn) reviseBtn.onclick = () => reviseProduction();
  if (chatSend && chatInput) {
    chatSend.onclick = () => sendChatMessage();
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  // Stage tracker clicks
  stageTrack.querySelectorAll('.om-stage-btn').forEach(btn => {
    btn.onclick = () => {
      const stageId = btn.getAttribute('data-stage');
      const idx = STAGES.findIndex(s => s.id === stageId);
      if (idx >= 0) {
        state.stageIndex = idx;
        refreshUI();
      }
    };
  });

  // Scene drag-to-reorder
  let draggedSceneIndex = null;
  const scenesContainer = container.querySelector('#om-scenes');
  if (scenesContainer) {
    scenesContainer.addEventListener('dragstart', (e) => {
      const card = e.target.closest('[data-scene-index]');
      if (!card) return;
      draggedSceneIndex = Number(card.getAttribute('data-scene-index'));
      card.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    scenesContainer.addEventListener('dragend', (e) => {
      const card = e.target.closest('[data-scene-index]');
      if (card) card.style.opacity = '1';
      draggedSceneIndex = null;
    });
    scenesContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      const card = e.target.closest('[data-scene-index]');
      if (!card || draggedSceneIndex === null) return;
      const targetIndex = Number(card.getAttribute('data-scene-index'));
      if (targetIndex !== draggedSceneIndex) {
        const items = [...scenesContainer.querySelectorAll('[data-scene-index]')];
        const draggedItem = items[draggedSceneIndex];
        const targetItem = items[targetIndex];
        if (draggedItem && targetItem) {
          const rect = targetItem.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (e.clientY < mid) {
            scenesContainer.insertBefore(draggedItem, targetItem);
          } else {
            scenesContainer.insertBefore(draggedItem, targetItem.nextSibling);
          }
        }
      }
    });
    scenesContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const cards = [...scenesContainer.querySelectorAll('[data-scene-index]')];
      const newOrder = cards.map(c => Number(c.getAttribute('data-scene-index'))).filter(i => !isNaN(i));
      if (newOrder.length !== state.scenes.length) return;
      const reordered = newOrder.map(i => state.scenes[i]);
      state.scenes = reordered;
      refreshUI();
    });
  }

  // Add asset button triggers file input
  const attachBtn = container.querySelector('#om-attach');
  if (attachBtn) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    fileInput.onchange = () => {
      if (fileInput.files && fileInput.files.length > 0) {
        showToast(`${fileInput.files.length} asset(s) attached`, 'success');
      }
    };
    container.appendChild(fileInput);
    attachBtn.onclick = () => fileInput.click();
  }

  // ── Status indicators ────────────────────────────────────────────────
  function updateServiceStatus() {
    if (!serviceStatus) return;
    if (!OPENMONTAGE_BACKEND) {
      serviceStatus.textContent = 'OpenMontage service not configured — set VITE_BACKEND_URL';
      serviceStatus.className = 'text-xs text-red-400 ml-2';
    } else {
      serviceStatus.textContent = `OpenMontage: ${OPENMONTAGE_BACKEND}`;
      serviceStatus.className = 'text-xs text-emerald-400 ml-2';
    }
  }

  function updateKeyStatus() {
    if (!keyStatus) return;
    const hasOpenAI = !!((typeof window !== 'undefined' && window.__OPENAI_KEY__) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_KEY));
    keyStatus.textContent = hasOpenAI ? 'OpenAI key detected ✓' : 'No OpenAI key — some agents will use local fallbacks';
  }

  updateServiceStatus();
  updateKeyStatus();

  // Initial key status display
  const keyStatusEl = container.querySelector('#om-key-status');
  if (keyStatusEl && keyStatus) {
    keyStatusEl.textContent = keyStatus.textContent;
  }

  return container;
}

export default OpenMontagePage;
