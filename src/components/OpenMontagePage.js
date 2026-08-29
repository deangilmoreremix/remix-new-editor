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
  { id: 'research', label: 'Research', short: 'RESEARCH' },
  { id: 'proposal', label: 'Proposal', short: 'PROPOSAL' },
  { id: 'script', label: 'Script', short: 'SCRIPT' },
  { id: 'scene_plan', label: 'Scene Plan', short: 'SCENE PLAN' },
  { id: 'assets', label: 'Assets', short: 'ASSETS' },
  { id: 'edit', label: 'Edit', short: 'EDIT' },
  { id: 'compose', label: 'Compose', short: 'COMPOSE' },
  { id: 'publish', label: 'Publish', short: 'PUBLISH' },
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

function getStageStatusText(stageId, s) {
  if (stageId === 'script' && s.approvalStatus === 'pending') return 'awaiting your approval';
  if (stageId === 'scene_plan' && s.approvalStatus === 'pending') return 'awaiting your approval';
  if (stageId === 'assets') return `${s.scenes.filter(sc => sc.status === 'DONE').length || 0} scenes done`;
  if (stageId === 'edit') return 'editing';
  if (stageId === 'compose') return 'composing';
  if (stageId === 'publish') return 'publishing';
  if (stageId === 'research') return 'researching';
  if (stageId === 'proposal') return 'proposing';
  return '';
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
    projectTitle: 'SIGNAL IN THE STATIC',
    pipelineLabel: 'cinematic pipeline',
    styleLabel: 'clean-professional',
    scenes: [],
    chatMessages: [
      { from: 'user', text: 'Make the opening more dramatic' },
      { from: 'agent', text: 'Done — SC 01 now opens on a black slate with a hard music hit, narration delayed 1.5s. Want the grade darker too?' },
      { from: 'user', text: 'Replace scene 3 with the product screenshots I uploaded' },
      { from: 'agent', text: 'Swapped SC 03 to dashboard-walkthrough.mp4 — trimmed 0:12 from the 2:14 capture. Cost unchanged.' },
    ],
    decisionLog: [
      { label: 'RENDER_RUNTIME_SELECTION', choice: 'compose → remotion', alternatives: 'also considered: HyperFrames' },
      { label: 'PROVIDER_SELECTION', choice: 'image generation — flux_image', alternatives: 'Strongest cinematic realism for night exteriors. also considered: get-image-1' },
    ],
    activityLog: [
      { time: '07:17:35 AM', event: 'flux_image sc3', status: 'running', cost: '$0.84' },
      { time: '07:17:35 AM', event: 'flux_image sc2', status: 'done', cost: '$0.84' },
      { time: '07:17:35 AM', event: 'flux_image sc1', status: 'done', cost: '$0.84' },
    ],
    credits: { images: 64, narration: 5, music: 15, generatedClip: 125, captions: 0, render: 0, total: 209 },
    generationSpend: 0.08,
    renders: [
      { label: 'final.mp4', status: 'ready', duration: '0:22', size: '0.0 MB' },
    ],
    approvalStatus: 'pending',
    jobStatus: 'idle',
    completedStages: [],
    research: null,
    script: {
      title: 'SIGNAL IN THE STATIC',
      duration: '0:22',
      sections: 4,
      pages: [
        { heading: 'S1 — A RADIO TOWER AGAINST A VIOLET SKY', body: 'The signal arrived at 3:14 a.m.', time: '0:00 - 0:05' },
        { heading: 'S2 — ROWS OF RECEIVERS, ONE GLOWING', body: 'Nobody was listening. Except her.', time: '0:05 - 0:10' },
        { heading: 'S3 — STATIC RESOLVING INTO A PATTERN', body: 'Noise, she realized, was a language.', time: '0:10 - 0:16' },
        { heading: 'S4 — THE PATTERN PROJECTED ON A WALL', body: 'And it was asking a question.', time: '0:16 - 0:22' },
      ],
      approved: false,
    },
    scenePlan: null,
    narration: null,
    music: null,
    compose: null,
    renderOutputs: null,
  };

  let pollTimer = null;

  // ── Backlot Header ────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'w-full flex flex-col items-center pt-6 pb-4 px-4 md:px-8';
  header.innerHTML = `
    <div class="w-full max-w-7xl flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-white">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 3v18M3 9h18"/>
          </svg>
          <span class="text-[9px] font-black text-white/90 tracking-[0.2em] uppercase">Backlot</span>
        </div>
        <h1 class="text-base sm:text-lg font-black text-white tracking-tight">${escapeHtml(state.projectTitle)}</h1>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-white/80">${escapeHtml(state.pipelineLabel)}</span>
        <span class="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-white/80">${escapeHtml(state.styleLabel)}</span>
        <span class="text-[10px] text-white/40">${state.scenes.length || 0} scenes · ${escapeHtml(state.duration)}</span>
        <span class="flex items-center gap-1.5 text-[10px] font-black text-amber-400">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          LIVE
        </span>
        <span class="text-[10px] text-white/50 font-bold">$${state.generationSpend.toFixed(2)} / $4.00</span>
        <span class="text-[9px] text-white/30 font-medium tracking-wide">GENERATION SPEND</span>
      </div>
    </div>
  `;
  container.appendChild(header);

  // ── Content wrapper ──────────────────────────────────────────────────
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'w-full max-w-7xl relative z-40 px-4 md:px-8 pb-10';

  // Top controls row — Backlot exact style
  const topBar = document.createElement('div');
  topBar.className = 'mb-5 flex items-center justify-between';
  topBar.innerHTML = `
    <button id="back-btn" class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white/70 hover:text-white">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Back
    </button>
    <div class="flex items-center gap-3">
      <span class="text-[11px] text-white/40 font-medium tracking-wide">scrub the whole run</span>
      <button id="om-replay" class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white/70 hover:text-white">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span class="text-[11px] font-black tracking-wide">REPLAY RUN</span>
      </button>
    </div>
  `;
  contentWrapper.appendChild(topBar);

  // Stage tracker — Backlot exact style
  const stageTrack = document.createElement('div');
  stageTrack.className = 'mb-5 overflow-x-auto';
  stageTrack.innerHTML = `
    <div class="flex items-center gap-0 min-w-max">
      ${STAGES.map((s, i) => {
        const isActive = i === state.stageIndex;
        const isCompleted = state.completedStages.includes(s.id);
        const statusText = isActive ? getStageStatusText(s.id, state) : '';
        return `
          <div class="flex items-center gap-0">
            <button data-stage="${s.id}" class="om-stage-btn flex flex-col items-center gap-1 px-3 py-2 transition-all ${isActive ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-white/25 hover:text-white/50'}">
              <span class="text-[10px] font-black tracking-wider">${isCompleted && !isActive ? '✓ ' : ''}${s.short}</span>
              ${statusText ? `<span class="text-[9px] font-medium ${isActive ? 'text-amber-400' : 'text-white/30'}">${statusText}</span>` : ''}
            </button>
            ${i < STAGES.length - 1 ? `<span class="text-white/10 text-[10px] px-0.5">·</span>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
  contentWrapper.appendChild(stageTrack);

  // Creative gate banner
  const gateBanner = document.createElement('div');
  gateBanner.id = 'om-gate-banner';
  gateBanner.className = 'hidden mb-6 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl';
  gateBanner.innerHTML = `
    <div class="flex items-center gap-3">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-amber-400 shrink-0">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div class="flex-1">
        <p class="text-[11px] font-bold text-amber-400/90">The script stage is waiting for your review. The agent is paused at this gate — reply <span class="underline decoration-amber-400/50">in chat</span> to approve or request changes.</p>
      </div>
    </div>
  `;
  contentWrapper.appendChild(gateBanner);

  // Replay timeline scrubber — Backlot exact style
  const replayTimeline = document.createElement('div');
  replayTimeline.id = 'om-replay-timeline';
  replayTimeline.className = 'hidden mb-5 p-3 bg-white/[0.02] border border-white/5 rounded-xl';
  replayTimeline.innerHTML = `
    <div class="flex items-center gap-3">
      <button id="om-replay-play" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <div class="flex-1 relative h-6 bg-white/5 rounded-lg overflow-hidden cursor-pointer" id="om-timeline-track">
        <div class="absolute inset-y-0 left-0 w-0 bg-white/10 rounded-lg"></div>
        <div class="absolute inset-0 flex items-center px-2">
          ${Array.from({ length: 24 }, (_, i) => `<span class="w-1 h-1 rounded-full ${i % 6 === 0 ? 'bg-white/20' : 'bg-white/5'}"></span>`).join('')}
        </div>
      </div>
      <span class="text-[10px] text-white/40 font-mono w-10 text-right">0:00</span>
    </div>
  `;
  contentWrapper.appendChild(replayTimeline);

  // Main layout — Backlot 3-column board
  const main = document.createElement('div');
  main.className = 'grid grid-cols-1 lg:grid-cols-12 gap-6';

  // Library sidebar — Backlot style
  const librarySidebar = document.createElement('div');
  librarySidebar.className = 'lg:col-span-2 flex flex-col gap-4';
  librarySidebar.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-white">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 3v18M3 9h18"/>
        </svg>
        <span class="text-[9px] font-black text-white/90 tracking-[0.2em] uppercase">Backlot</span>
      </div>
      <span class="text-[10px] text-white/40">4 projects</span>
    </div>
    <div class="space-y-3">
      <div class="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer">
        <div class="aspect-video bg-gradient-to-br from-gray-800 to-gray-700 relative flex items-center justify-center">
          <span class="text-[10px] font-black text-white/30 tracking-wide">NO MEDIA YET</span>
          <span class="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-md text-[9px] font-black text-emerald-400 tracking-wide">● LIVE · SCRIPT</span>
        </div>
        <div class="p-3">
          <div class="text-[11px] font-bold text-white mb-1">${escapeHtml(state.projectTitle)}</div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-0.5 bg-white/5 rounded text-[9px] font-bold text-white/60">${escapeHtml(state.pipelineLabel)}</span>
            <span class="text-[9px] text-white/40">just now</span>
          </div>
          <div class="flex items-center gap-1">
            ${Array.from({ length: 8 }, (_, i) => `<span class="w-1.5 h-1.5 rounded-full ${i < 3 ? 'bg-emerald-400' : i === 3 ? 'bg-amber-400' : 'bg-white/10'}"></span>`).join('')}
          </div>
        </div>
      </div>
      <div class="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer">
        <div class="aspect-video bg-gradient-to-br from-gray-800 to-gray-700 relative flex items-center justify-center">
          <span class="text-[10px] font-black text-white/30 tracking-wide">NO MEDIA YET</span>
          <span class="absolute top-2 left-2 px-2 py-0.5 bg-amber-500/15 border border-amber-500/25 rounded-md text-[9px] font-black text-amber-400 tracking-wide">◆ AWAITING YOU</span>
        </div>
        <div class="p-3">
          <div class="text-[11px] font-bold text-white mb-1">THE SLOW ORCHARD</div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-0.5 bg-white/5 rounded text-[9px] font-bold text-white/60">cinematic</span>
            <span class="text-[9px] text-white/40">just now</span>
          </div>
          <div class="flex items-center gap-1">
            ${Array.from({ length: 8 }, (_, i) => `<span class="w-1.5 h-1.5 rounded-full ${i < 2 ? 'bg-amber-400' : 'bg-white/10'}"></span>`).join('')}
          </div>
        </div>
      </div>
      <div class="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer">
        <div class="aspect-video bg-gradient-to-br from-blue-900/40 to-purple-900/40 relative flex items-center justify-center">
          <div class="flex items-end gap-0.5 h-8">
            ${Array.from({ length: 12 }, () => `<div class="w-1 bg-white/20 rounded-t" style="height: ${20 + Math.random() * 60}%"></div>`).join('')}
          </div>
          <span class="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-md text-[9px] font-black text-emerald-400 tracking-wide">● LIVE · ASSETS</span>
        </div>
        <div class="p-3">
          <div class="text-[11px] font-bold text-white mb-1">SIGNAL IN THE STATIC</div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-0.5 bg-white/5 rounded text-[9px] font-bold text-white/60">cinematic</span>
            <span class="px-2 py-0.5 bg-white/5 rounded text-[9px] font-bold text-white/60">4 scenes</span>
            <span class="text-[9px] text-white/40">just now</span>
          </div>
          <div class="flex items-center gap-1">
            ${Array.from({ length: 8 }, (_, i) => `<span class="w-1.5 h-1.5 rounded-full ${i < 5 ? 'bg-emerald-400' : 'bg-white/10'}"></span>`).join('')}
          </div>
        </div>
      </div>
      <div class="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer">
        <div class="aspect-video bg-gradient-to-br from-amber-900/40 to-orange-900/40 relative flex items-center justify-center">
          <div class="flex items-end gap-0.5 h-8">
            ${Array.from({ length: 12 }, () => `<div class="w-1 bg-white/20 rounded-t" style="height: ${20 + Math.random() * 60}%"></div>`).join('')}
          </div>
          <span class="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-md text-[9px] font-black text-emerald-400 tracking-wide">● LIVE</span>
        </div>
        <div class="p-3">
          <div class="text-[11px] font-bold text-white mb-1">THE LAST LIGHTHOUSE</div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-0.5 bg-white/5 rounded text-[9px] font-bold text-white/60">cinematic</span>
            <span class="px-2 py-0.5 bg-white/5 rounded text-[9px] font-bold text-white/60">5 scenes</span>
            <span class="px-2 py-0.5 bg-white/5 rounded text-[9px] font-bold text-white/60">1 renders</span>
            <span class="text-[9px] text-white/40">just now</span>
          </div>
          <div class="flex items-center gap-1">
            ${Array.from({ length: 8 }, (_, i) => `<span class="w-1.5 h-1.5 rounded-full ${i < 6 ? 'bg-emerald-400' : 'bg-white/10'}"></span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Main content column — stage content + storyboard + player
  const contentCol = document.createElement('div');
  contentCol.className = 'lg:col-span-7 flex flex-col gap-6';

  // Stage content card (dynamic) — Backlot screenplay viewer when in script stage
  const stageContentCard = document.createElement('div');
  stageContentCard.id = 'om-stage-content';
  stageContentCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  stageContentCard.innerHTML = getStageContentHTML(state);
  contentCol.appendChild(stageContentCard);

  // Storyboard filmstrip
  const storyboardCard = document.createElement('div');
  storyboardCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  storyboardCard.innerHTML = renderStoryboardFilmstrip(state);
  contentCol.appendChild(storyboardCard);

  // Renders / player
  const rendersCard = document.createElement('div');
  rendersCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  rendersCard.innerHTML = renderPlayerCard(state);
  contentCol.appendChild(rendersCard);

  // Right column — Decisions + Activity
  const right = document.createElement('div');
  right.className = 'lg:col-span-3 flex flex-col gap-6';

  // Decisions panel
  const decisionsPanel = document.createElement('div');
  decisionsPanel.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  decisionsPanel.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-[10px] font-black text-white/80 tracking-wide">DECISIONS</h3>
      <span class="text-[10px] text-white/40 font-mono">decision_log.json</span>
    </div>
    <div id="om-decisions" class="space-y-3">
      ${renderDecisionLog(state.decisionLog)}
    </div>
  `;
  right.appendChild(decisionsPanel);

  // Activity panel
  const activityPanel = document.createElement('div');
  activityPanel.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  activityPanel.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-[10px] font-black text-white/80 tracking-wide">ACTIVITY</h3>
      <span class="text-[10px] text-white/40 font-mono">events.json</span>
    </div>
    <div id="om-activity" class="space-y-2">
      ${renderActivityLog(state.activityLog)}
    </div>
  `;
  right.appendChild(activityPanel);

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
  const activityEl = container.querySelector('#om-activity');
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
      if (data.activityLog) state.activityLog = data.activityLog;
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
      const statusText = isActive ? getStageStatusText(STAGES[i].id, state) : '';
      btn.className = 'om-stage-btn flex flex-col items-center gap-1 px-2 py-2 transition-all ' + (isActive ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-white/40 hover:text-white/70');
      btn.innerHTML = `
        <span class="text-[10px] font-black tracking-wider">${isCompleted && !isActive ? '✓ ' : ''}${STAGES[i].short}</span>
        ${statusText ? `<span class="text-[9px] font-medium ${isActive ? 'text-amber-400' : 'text-white/40'}">${statusText}</span>` : ''}
      `;
    });

    // Gate banner visibility
    if (gateBanner) {
      const showGate = state.stageIndex === STAGES.findIndex(s => s.id === 'script') && state.approvalStatus === 'pending';
      gateBanner.classList.toggle('hidden', !showGate);
    }

    if (stageContent) {
      stageContent.innerHTML = getStageContentHTML(state);
      wireStageContentEvents();
    }

    if (scenesEl) scenesEl.innerHTML = renderStoryboardFilmstrip(state);
    if (rendersEl) rendersEl.innerHTML = renderPlayerCard(state);
    if (decisionsEl) decisionsEl.innerHTML = renderDecisionLog(state.decisionLog);
    if (activityEl) activityEl.innerHTML = renderActivityLog(state.activityLog);

    if (chatBox) {
      chatBox.innerHTML = state.chatMessages.map(m => `
        <div class="flex flex-col ${m.from === 'user' ? 'items-end' : 'items-start'}" data-from="${m.from}">
          <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] ${m.from === 'user' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80'}">${escapeHtml(m.text)}</div>
          <span class="text-[10px] text-white/40 mt-1">${m.from === 'user' ? 'YOU' : 'MONTAGE'}</span>
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

    if (stageId === 'research') return renderResearchContent(s);
    if (stageId === 'proposal') return renderProposalContent(s);
    if (stageId === 'script') return renderScriptContent(s);
    if (stageId === 'scene_plan') return renderScenePlanContent(s);
    if (stageId === 'assets') return renderAssetsContent(s);
    if (stageId === 'edit') return renderEditContent(s);
    if (stageId === 'compose') return renderComposeContent(s);
    if (stageId === 'publish') return renderPublishContent(s);
    return renderResearchContent(s);
  }

  function renderProposalContent(s) {
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">PROPOSAL</h2>
        <span class="text-[10px] text-white/40 font-medium tracking-wide">${s.jobStatus === 'running' ? 'Generating proposal…' : 'Waiting for research'}</span>
      </div>
      <div class="text-[11px] text-white/50 space-y-2">
        <p>The agent synthesizes research into 2-3 differentiated concepts with honest tool paths, cost estimates, and sample previews.</p>
      </div>
    `;
  }

  function renderAssetsContent(s) {
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">ASSETS</h2>
        <span class="text-[10px] text-amber-400">${s.scenes.filter(sc => sc.status === 'DONE').length || 0} SCENES DONE</span>
      </div>
      <div class="text-[11px] text-white/50 space-y-2">
        <p>Asset generation is scene-by-scene. Each scene gets a contact sheet with takes, prompts, per-asset cost, and quality scores for your approval.</p>
      </div>
    `;
  }

  function renderEditContent(s) {
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">EDIT</h2>
        <span class="text-[10px] text-amber-400">EDITING</span>
      </div>
      <div class="text-[11px] text-white/50 space-y-2">
        <p>The agent assembles approved assets into a timeline, applies transitions, and prepares the composition.</p>
      </div>
    `;
  }

  function renderPublishContent(s) {
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">PUBLISH</h2>
        <span class="text-[10px] text-amber-400">PUBLISHING</span>
      </div>
      <div class="text-[11px] text-white/50 space-y-2">
        <p>Final render, quality checks, and delivery. Your video is rendered on your machine, no watermark.</p>
      </div>
    `;
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



  function renderResearchContent(s) {
    if (!s.research) {
      return `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">RESEARCH</h2>
          <span class="text-[10px] text-white/40 font-medium tracking-wide">${s.jobStatus === 'running' ? 'Agent is researching…' : 'Waiting to start'}</span>
        </div>
        <div class="text-[11px] text-white/50 space-y-2">
          <p>Research runs live web search across YouTube, Reddit, news sites, and academic sources before writing a single word of script.</p>
          ${s.jobStatus === 'running' ? '<p class="text-amber-400">Gathering data points, audience questions, trending angles, and visual references…</p>' : ''}
        </div>
      `;
    }
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">RESEARCH</h2>
        <span class="text-[10px] text-emerald-400 font-medium tracking-wide">FINDINGS RECORDED IN THE DECISION LOG</span>
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
          <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">SCRIPT</h2>
          <span class="text-[10px] text-white/40 font-medium tracking-wide">${s.jobStatus === 'running' ? 'Writing screenplay…' : 'Waiting for research'}</span>
        </div>
        <div class="text-[11px] text-white/50">A screenplay, not a caption. The agent writes scene headings, action, V.O., and B-roll notes.</div>
      `;
    }
    const pages = s.script.pages || [];
    const sections = s.script.sections || pages.length;
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">${escapeHtml(s.script.title || 'SCRIPT')}</h2>
        <div class="flex items-center gap-3">
          <span class="text-[10px] text-white/40 font-medium tracking-wide">script · ${s.script.duration || ''} · ${sections} sections</span>
          ${s.script.approved ? '<span class="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] font-black text-emerald-400 rotate-[-2deg]">APPROVED</span>' : ''}
        </div>
      </div>
      <div class="space-y-4 font-mono text-[11px]">
        ${pages.map((p, i) => `
          <div class="flex items-start gap-4">
            <span class="text-[10px] font-black text-white/40 pt-1 w-16 shrink-0">${escapeHtml(p.time || '')}</span>
            <div class="flex-1 min-w-0">
              <div class="text-[11px] font-black text-white mb-1">${escapeHtml(p.heading || `SC ${String(i + 1).padStart(2, '0')}`)}</div>
              ${p.body ? `<p class="text-[11px] text-white/80 whitespace-pre-wrap">${escapeHtml(p.body)}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
        <span class="text-[10px] text-white/40 font-medium">${pages.length > 4 ? '— 1 MORE SECTIONS' : ''}</span>
        <button id="om-expand-script" class="flex items-center gap-1 text-[10px] font-bold text-white/60 hover:text-white transition-all">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          EXPAND SCRIPT
        </button>
      </div>
    `;
  }

  function renderScenePlanContent(s) {
    if (!s.scenePlan) {
      return `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">SCENE PLAN</h2>
          <span class="text-[10px] text-white/40 font-medium tracking-wide">${s.jobStatus === 'running' ? 'Planning scenes…' : 'Waiting for script'}</span>
        </div>
        <div class="text-[11px] text-white/50">A medium chosen for each scene. Draft sketches before any premium spend.</div>
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
        <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">SCENE PLAN</h2>
        <span class="text-[10px] text-white/40 font-medium tracking-wide">MIXED</span>
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
      <p class="text-[10px] text-white/40 font-medium mt-2">Your own assets, your library, stock, or generated — proposed scene by scene, and yours to change.</p>
    `;
  }











  // Storyboard filmstrip — Backlot exact style
  function renderStoryboardFilmstrip(s) {
    const scenes = s.scenes || [];
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">Storyboard</h2>
        <span class="text-[10px] text-white/40 font-medium tracking-wide">${scenes.length || 0} SCENES · ${escapeHtml(s.duration)} · CARD WIDTH ∝ DURATION</span>
      </div>
      <div class="relative">
        <div class="flex items-center gap-1 mb-4">
          ${Array.from({ length: Math.max(scenes.length * 4, 16) }, (_, i) => `<span class="w-1.5 h-1.5 rounded-full ${i % 4 === 0 ? 'bg-white/20' : 'bg-white/5'}"></span>`).join('')}
        </div>
        <div class="flex gap-3 overflow-x-auto pb-2">
          ${scenes.map((sc, i) => {
            const status = sc.status || 'QUEUED';
            const isGenerating = status === 'RENDERING';
            const hasAsset = status === 'DONE' || sc.asset;
            const model = sc.model || 'flux-1.1-pro';
            const cost = sc.cost || '$0.84';
            const quality = sc.quality || '0.84';
            return `
              <div class="flex flex-col gap-2 min-w-[140px] max-w-[180px] flex-1">
                <div class="relative aspect-video bg-white/5 rounded-xl overflow-hidden border border-white/10 ${isGenerating ? 'animate-pulse' : ''}">
                  ${hasAsset ? `
                    <div class="absolute inset-0 bg-gradient-to-br ${['from-gray-700 to-gray-600', 'from-blue-900 to-blue-800', 'from-purple-900 to-purple-800', 'from-emerald-900 to-emerald-800', 'from-amber-900 to-amber-800', 'from-rose-900 to-rose-800'][i % 6]} opacity-80"></div>
                  ` : isGenerating ? `
                    <div class="absolute inset-0 flex items-center justify-center">
                      <div class="text-[10px] font-black text-white/50 tracking-wide animate-pulse">GENERATING</div>
                    </div>
                  ` : `
                    <div class="absolute inset-0 flex items-center justify-center border-2 border-dashed border-white/10 rounded-xl">
                      <div class="text-center px-2">
                        <div class="text-[10px] font-black text-white/30 tracking-wide mb-1">no asset yet</div>
                        <div class="text-[9px] text-white/30">${escapeHtml(sc.label || sc.title || '')}</div>
                      </div>
                    </div>
                  `}
                  ${sc.hero ? '<span class="absolute top-2 right-2 text-[9px] font-black text-amber-400 bg-black/40 px-1.5 py-0.5 rounded tracking-wide">★ HERO</span>' : ''}
                </div>
                <div class="space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-black text-white/50 tracking-wide">SC ${String(i + 1).padStart(2, '0')}</span>
                    <span class="text-[10px] text-white/40 font-mono">${escapeHtml(sc.duration || sc.time || '0:06')}</span>
                  </div>
                  <div class="text-[10px] text-white/40 font-medium tracking-wide">${escapeHtml(model)} · ${escapeHtml(cost)} · q ${escapeHtml(quality)}</div>
                  <div class="flex flex-wrap gap-1">
                    ${(sc.tags || []).map(t => `<span class="px-1.5 py-0.5 bg-white/5 rounded text-[9px] text-white/50 font-medium tracking-wide">${escapeHtml(t)}</span>`).join('')}
                  </div>
                  ${sc.notes ? `<p class="text-[9px] text-white/40 italic tracking-wide">${escapeHtml(sc.notes)}</p>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ── Player / renders card ─────────────────────────────────────────────
  function renderPlayerCard(s) {
    const render = s.renders && s.renders[0];
    return `
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-[10px] font-black text-white/80 tracking-[0.15em] uppercase">Renders</h2>
        <span class="text-[10px] text-white/40 font-medium tracking-wide">${s.renders && s.renders.length ? '1 VERSION' : 'NO VERSIONS'}</span>
      </div>
      <div class="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
        <div class="aspect-video bg-white/5 flex items-center justify-center relative">
          ${render ? `
            <div class="absolute inset-0 flex items-center justify-center">
              <button class="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <div class="flex items-center gap-3">
                <span class="text-[10px] text-white/50 font-mono">0:00</span>
                <div class="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div class="h-full w-0 bg-white/60 rounded-full"></div>
                </div>
                <span class="text-[10px] text-white/50 font-mono">${render.duration || '0:22'}</span>
              </div>
            </div>
            <div class="absolute top-3 right-3 flex items-center gap-2">
              <button class="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
              <button class="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              </button>
              <button class="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
          ` : `
            <div class="text-[10px] text-white/40 font-medium tracking-wide">No render yet</div>
          `}
        </div>
        <div class="p-3 flex items-center justify-between">
          <span class="text-[10px] text-white/50 font-bold tracking-wide">${render ? escapeHtml(render.label) : ''}</span>
          <span class="text-[10px] text-white/40 font-mono">${render ? escapeHtml(render.size || '0.0 MB') : ''}</span>
        </div>
      </div>
    `;
  }

  // ── Activity log ──────────────────────────────────────────────────────
  function renderActivityLog(activities) {
    if (!activities || activities.length === 0) {
      return '<div class="text-[11px] text-white/40">No activity yet.</div>';
    }
    return activities.map(a => `
      <div class="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
        <span class="text-[10px] text-white/40 w-20 shrink-0 font-mono">${escapeHtml(a.time || '')}</span>
        <span class="text-[10px] font-bold text-white/80 flex-1">${escapeHtml(a.event || '')}</span>
        <span class="flex items-center gap-1 text-[10px] font-black ${a.status === 'done' ? 'text-emerald-400' : a.status === 'running' ? 'text-amber-400' : 'text-white/60'}">
          ${a.status === 'running' ? '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>' : a.status === 'done' ? '✓' : '○'}
          ${escapeHtml(a.status || '')}
        </span>
        <span class="text-[10px] font-black text-white">${escapeHtml(a.cost || '')}</span>
      </div>
    `).join('');
  }


  function renderDecisionLog(decisions) {
    if (!decisions || decisions.length === 0) {
      return '<div class="text-[11px] text-white/40">No decisions yet.</div>';
    }
    return decisions.map(d => `
      <div class="border-b border-white/5 pb-3 last:border-0 last:pb-0">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-white">${escapeHtml(d.label)}</span>
          <span class="text-[10px] text-white/40 font-mono">${escapeHtml(d.version || '3▴')}</span>
        </div>
        <p class="text-[11px] text-white/70">${escapeHtml(d.choice || '—')}</p>
        ${d.alternatives ? `<p class="text-[10px] text-white/40 font-medium mt-1">${escapeHtml(d.alternatives)}</p>` : ''}
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
      <span class="text-[10px] text-white/40 mt-1">${from === 'user' ? 'YOU' : 'MONTAGE'}</span>
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

  // Replay button — toggle timeline scrubber visibility
  const replayBtn = container.querySelector('#om-replay');
  const replayTimelineEl = container.querySelector('#om-replay-timeline');
  const timelineTrack = container.querySelector('#om-timeline-track');
  const timelineFill = timelineTrack ? timelineTrack.querySelector('div') : null;
  const timelineTime = replayTimelineEl ? replayTimelineEl.querySelector('span') : null;

  let replayPlaying = false;
  let replayProgress = 0;
  let replayInterval = null;

  function updateReplayUI(progress) {
    if (timelineFill) timelineFill.style.width = `${progress}%`;
    if (timelineTime) {
      const totalSeconds = 22; // approximate total duration
      const current = Math.floor((progress / 100) * totalSeconds);
      const mins = Math.floor(current / 60);
      const secs = current % 60;
      timelineTime.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    }
  }

  if (replayBtn && replayTimelineEl) {
    replayBtn.onclick = () => {
      const isHidden = replayTimelineEl.classList.contains('hidden');
      replayTimelineEl.classList.toggle('hidden', !isHidden);
      if (isHidden) {
        replayProgress = 0;
        updateReplayUI(0);
      }
      if (replayInterval) {
        clearInterval(replayInterval);
        replayInterval = null;
        replayPlaying = false;
      }
    };
  }

  if (timelineTrack) {
    timelineTrack.onclick = (e) => {
      const rect = timelineTrack.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const progress = Math.max(0, Math.min(100, (x / rect.width) * 100));
      replayProgress = progress;
      updateReplayUI(progress);
    };
  }

  const replayPlayBtn = container.querySelector('#om-replay-play');
  if (replayPlayBtn) {
    replayPlayBtn.onclick = () => {
      if (replayPlaying) {
        clearInterval(replayInterval);
        replayInterval = null;
        replayPlaying = false;
        return;
      }
      replayPlaying = true;
      if (replayProgress >= 100) replayProgress = 0;
      replayInterval = setInterval(() => {
        replayProgress += 1.5;
        if (replayProgress >= 100) {
          replayProgress = 100;
          clearInterval(replayInterval);
          replayInterval = null;
          replayPlaying = false;
        }
        updateReplayUI(replayProgress);
      }, 100);
    };
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
