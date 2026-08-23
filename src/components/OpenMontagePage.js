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

export function OpenMontagePage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center justify-center bg-app-bg relative overflow-x-hidden';
  mountStudioChrome(container, { currentRoute: 'video-agent' });

  const state = {
    stageIndex: 0,
    isProcessing: false,
    currentJobId: null,
    prompt: '',
    audience: 'developers & platform teams',
    duration: '60s',
    tone: 'confident, plain-spoken',
    messages: [
      'Detect before your users do',
      'Explain the why, not just the what',
      'One-click resolve from the alert',
    ],
    scenes: [],
    chatMessages: [
      { from: 'user', text: 'Make the opening more dramatic' },
      { from: 'agent', text: 'Done — SC 01 now opens on a black slate with a hard music hit, narration delayed 1.5s. Want the grade darker too?' },
      { from: 'user', text: 'Replace scene 3 with the product screenshots I uploaded' },
      { from: 'agent', text: 'Swapped SC 03 to dashboard-walkthrough.mp4 — trimmed 0:12 from the 2:14 capture. Cost unchanged.' },
    ],
    decisionLog: [
      { label: 'Voice', choice: 'Warm male tenor — “Calder”', alternatives: 'also considered: female alto · neutral narrator' },
      { label: 'Music — “Minimal Pulse”, licensed', choice: '', alternatives: '' },
      { label: 'Grade', choice: 'warm high-contrast', alternatives: '' },
    ],
    credits: {
      images: 64,
      narration: 5,
      music: 15,
      generatedClip: 125,
      captions: 0,
      render: 0,
      total: 209,
    },
    renders: [
      { label: '16:9 · LAUNCH', status: 'ready' },
      { label: '1:1 · FEED', status: 'ready' },
      { label: '9:16 · SHORTS', status: 'ready' },
    ],
  };

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

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'w-full max-w-7xl relative z-40 px-4 md:px-8 pb-10';

  // Back + service status
  const topBar = document.createElement('div');
  topBar.className = 'mb-6 flex items-center gap-2';
  topBar.innerHTML = `
    <button id="back-btn" class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white/70 hover:text-white">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
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
      ${STAGES.map((s, i) => `
        <button data-stage="${s.id}" class="om-stage-btn flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${i === state.stageIndex ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/5 text-white/60 hover:text-white'}">
          <span class="text-[10px] font-black tracking-wider">${s.short}</span>
        </button>
        ${i < STAGES.length - 1 ? `<div class="w-6 h-px bg-white/10"></div>` : ''}
      `).join('')}
    </div>
  `;
  contentWrapper.appendChild(stageTrack);

  // Main layout
  const main = document.createElement('div');
  main.className = 'grid grid-cols-1 lg:grid-cols-12 gap-6';

  // Left column
  const left = document.createElement('div');
  left.className = 'lg:col-span-8 flex flex-col gap-6';

  // Brief card
  const briefCard = document.createElement('div');
  briefCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  briefCard.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xs font-black text-white/80 tracking-wide">BRIEF</h2>
      <span class="text-[10px] text-muted">${state.duration} · ${state.tone}</span>
    </div>
    <textarea id="om-prompt" rows="3" placeholder="Make a 60-second launch video for our monitoring tool — use the brand kit and the dashboard recording. Developer audience." class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 resize-none mb-3">${state.prompt}</textarea>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
      <div>
        <label class="block text-[10px] font-bold text-white/60 mb-1 tracking-wide">AUDIENCE</label>
        <input id="om-audience" value="${state.audience}" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
      </div>
      <div>
        <label class="block text-[10px] font-bold text-white/60 mb-1 tracking-wide">DURATION</label>
        <input id="om-duration" value="${state.duration}" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <span class="text-[10px] font-bold text-white/60 tracking-wide">KEY MESSAGES</span>
      ${state.messages.map((m, i) => `
        <span class="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white/80">${i + 1} · ${m}</span>
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
  `;
  left.appendChild(briefCard);

  // Gate card
  const gateCard = document.createElement('div');
  gateCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  gateCard.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xs font-black text-white/80 tracking-wide">THE GATE</h2>
      <span class="text-[10px] text-muted">Nothing spends until you approve</span>
    </div>
    <div class="space-y-2 mb-4">
      ${Object.entries(state.credits).filter(([k]) => k !== 'total').map(([key, value]) => {
        const labels = { images: '8 standard images', narration: 'narration · 60s', music: 'music · “Focused Build”', generatedClip: '1 generated clip · 5s', captions: 'captions', render: 'stock · render' };
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
      <span class="text-sm font-black text-white">${state.credits.total} CR ≈ $${(state.credits.total / 100).toFixed(2)}</span>
    </div>
    <div class="flex items-center gap-2">
      <button id="om-approve" class="flex-1 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black rounded-xl hover:bg-emerald-500/20 transition-all text-sm">Approve — go produce</button>
      <button id="om-revise" class="px-4 py-2.5 bg-white/5 border border-white/10 text-white/70 font-bold rounded-xl hover:bg-white/10 transition-all text-sm">Revise</button>
    </div>
  `;
  left.appendChild(gateCard);

  // Scene board
  const sceneBoard = document.createElement('div');
  sceneBoard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  sceneBoard.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xs font-black text-white/80 tracking-wide">STORYBOARD — 6 SCENES · 1:24 TOTAL</h2>
      <button id="om-add-scene" class="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all">⊕ Add scene</button>
    </div>
    <div id="om-scenes" class="space-y-3">
      ${buildSceneCards()}
    </div>
  `;
  left.appendChild(sceneBoard);

  // Renders
  const rendersCard = document.createElement('div');
  rendersCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-3xl';
  rendersCard.innerHTML = `
    <h2 class="text-xs font-black text-white/80 tracking-wide mb-3">RENDERS</h2>
    <div class="flex flex-wrap gap-2">
      ${state.renders.map(r => `
        <span class="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/80">${r.label} <span class="text-emerald-400 ml-1">${r.status}</span></span>
      `).join('')}
    </div>
  `;
  left.appendChild(rendersCard);

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
        <p class="text-[10px] text-emerald-400 font-bold mt-0.5">● AGENT ACTIVE</p>
      </div>
      <span class="text-[10px] text-muted">Claude · Opus 4.8 · Effort · High</span>
    </div>
    <div id="om-chat" class="flex-1 p-4 space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
      ${state.chatMessages.map(m => `
        <div class="flex flex-col ${m.from === 'user' ? 'items-end' : 'items-start'}">
          <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] ${m.from === 'user' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80'}">${m.text}</div>
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
    <div class="space-y-3">
      ${state.decisionLog.map(d => `
        <div class="border-b border-white/5 pb-3 last:border-0 last:pb-0">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-white">${d.label}</span>
            <span class="text-[10px] text-muted">3▴</span>
          </div>
          <p class="text-[11px] text-white/70">${d.choice || '—'}</p>
          ${d.alternatives ? `<p class="text-[10px] text-muted mt-1">${d.alternatives}</p>` : ''}
        </div>
      `).join('')}
    </div>
  `;
  right.appendChild(decisionCard);

  main.appendChild(left);
  main.appendChild(right);
  contentWrapper.appendChild(main);

  container.appendChild(contentWrapper);

  // Helpers
  function buildSceneCards() {
    const scenes = [
      { label: 'BLACK SLATE — TITLE SET', status: 'DONE', time: '0:06', type: 'MOTION GFX', cost: '$0.00' },
      { label: 'SC 01Cold open', status: 'DONE', time: '0:16', type: 'OFFICE B-ROLL, QUICK CUTS', cost: '$0.00' },
      { label: 'SC 02The problem', status: 'DONE', time: '0:14', type: 'STOCK', cost: '$0.00' },
      { label: 'SC 03The reveal', status: 'DONE', time: '0:18', type: 'USER ASSET', cost: '$0.00' },
      { label: 'SC 04Playbooks', status: 'RENDERING', time: '0:20', type: 'GENERATED', cost: '$0.16' },
      { label: 'SC 05Health scores', status: 'QUEUED', time: '0:10', type: 'MOTION GFX', cost: '$0.00' },
    ];
    const statusStyles = {
      DONE: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
      RENDERING: 'text-primary border-primary/30 bg-primary/5',
      QUEUED: 'text-white/60 border-white/10 bg-white/5',
      UNLOCKED: 'text-white/80 border-white/20 bg-white/5',
    };
    return scenes.map((s, i) => `
      <div class="border border-white/10 rounded-2xl p-3 md:p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-black text-white/60">SC ${String(i).padStart(2, '0')}</span>
            <span class="text-xs font-bold text-white">${s.label}</span>
          </div>
          <span class="text-[10px] font-black px-2 py-0.5 rounded-lg border ${statusStyles[s.status] || statusStyles.QUEUED}">${s.status}</span>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-[11px] text-white/60">${s.type}</span>
            <span class="text-[11px] text-muted">${s.time}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-black text-white">${s.cost}</span>
            <button class="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all">↻ Regenerate</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Element refs
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

  function appendChat(from, text) {
    if (!chatBox) return;
    const row = document.createElement('div');
    row.className = 'flex flex-col ' + (from === 'user' ? 'items-end' : 'items-start');
    row.innerHTML = `
      <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] ${from === 'user' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80'}">${text}</div>
      <span class="text-[10px] text-muted mt-1">${from === 'user' ? 'YOU' : 'MONTAGE'}</span>
    `;
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

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
    state.isProcessing = true;
    if (generateBtn) generateBtn.disabled = true;

    try {
      const res = await fetch(`${OPENMONTAGE_BACKEND}/api/productions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, pipeline: 'animated-explainer', profile: 'youtube-landscape', action: 'start' }),
      });
      if (!res.ok) throw new Error(`OpenMontage backend returned ${res.status}`);
      const data = await res.json();
      state.currentJobId = data.jobId || data.id || null;
      showToast('Production started', 'success');
    } catch (err) {
      console.error('[OpenMontagePage] production failed:', err);
      showToast('Production failed: ' + err.message, 'error');
      state.isProcessing = false;
      if (generateBtn) generateBtn.disabled = false;
    }
  }

  if (backBtn) backBtn.onclick = () => navigate('render');
  if (generateBtn) generateBtn.onclick = () => submitProduction();
  if (approveBtn) {
    approveBtn.onclick = () => {
      showToast('Approved — production continuing', 'success');
    };
  }
  if (reviseBtn) {
    reviseBtn.onclick = () => {
      showToast('Revise requested — prompt the agent in chat', 'info');
    };
  }
  if (chatSend && chatInput) {
    chatSend.onclick = () => {
      const text = chatInput.value.trim();
      if (!text) return;
      appendChat('user', text);
      chatInput.value = '';
      setTimeout(() => appendChat('agent', 'Acknowledged — updating the production plan.'), 600);
    };
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatSend.click();
      }
    });
  }

  updateServiceStatus();
  updateKeyStatus();

  return container;
}

export default OpenMontagePage;
