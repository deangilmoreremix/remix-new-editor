import { mountStudioChrome } from '../lib/studioChrome.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { showToast } from '../lib/loading.js';
import { AICaptionAssistant } from './modals/AICaptionAssistant.jsx';
import { generateContentIdeas } from '../lib/contentIdeasEngine.js';

const SVG_AI_ASSIST = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/><path d="M5 16l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/><path d="M19 11l0.5 1.5 1.5 0.5-1.5 0.5-0.5 1.5-0.5-1.5-1.5-0.5 1.5-0.5 0.5-1.5z"/></svg>';
const SVG_SPIN = '<svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-opacity="0.3"/><path d="M21 12a9 9 0 00-9-9"/></svg>';
const SVG_CALENDAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const SVG_LIGHTBULB = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/></svg>';

const CALENDAR_TABS = ['Calendar', 'Schedule', 'Analytics'];

export function SmartVideoScheduler() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-hidden relative';

  mountStudioChrome(container, { currentRoute: 'smart-video-scheduler', title: 'Smart Video Scheduler' });

  let activeTab = 'Calendar';
  let scheduledVideos = [];
  let aiPanelOpen = false;
  let aiLoading = false;
  let contentIdeas = [];

  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col flex-1 overflow-hidden';

  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pt-6 pb-4 shrink-0';

  const hero = createHeroSection('smart-video-scheduler', 'h-28 md:h-40 mb-4');
  if (hero) {
    const heroText = document.createElement('div');
    heroText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10 flex items-end justify-between';
    heroText.innerHTML = '<div><h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-1">Smart Video Scheduler</h1><p class="text-white/60 text-sm max-w-md">AI-powered content calendar and scheduling studio</p></div>';
    hero.appendChild(heroText);
    topBar.appendChild(hero);
  }

  const aiAssistBtn = document.createElement('button');
  aiAssistBtn.type = 'button';
  aiAssistBtn.className = 'absolute top-8 right-4 md:right-8 z-20 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-lg hover:shadow-violet-500/25 hover:scale-105 transition-all';
  aiAssistBtn.innerHTML = `${SVG_AI_ASSIST} AI Assist`;
  aiAssistBtn.onclick = () => {
    aiPanelOpen = !aiPanelOpen;
    renderAIPanel();
  };
  topBar.appendChild(aiAssistBtn);

  wrapper.appendChild(topBar);

  const tabBar = document.createElement('div');
  tabBar.className = 'px-4 md:px-8 pb-2 shrink-0 flex items-center gap-1';
  const tabButtons = {};

  CALENDAR_TABS.forEach((tab) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = tab;
    btn.className = tab === activeTab
      ? 'px-4 py-2 rounded-lg text-xs font-bold bg-white text-black shadow transition-all'
      : 'px-4 py-2 rounded-lg text-xs font-bold text-gray-500 hover:text-white hover:bg-white/10 transition-all';
    btn.onclick = () => {
      activeTab = tab;
      Object.entries(tabButtons).forEach(([key, b]) => {
        b.className = key === activeTab
          ? 'px-4 py-2 rounded-lg text-xs font-bold bg-white text-black shadow transition-all'
          : 'px-4 py-2 rounded-lg text-xs font-bold text-gray-500 hover:text-white hover:bg-white/10 transition-all';
      });
      renderTabContent();
    };
    tabButtons[tab] = btn;
    tabBar.appendChild(btn);
  });

  wrapper.appendChild(tabBar);

  const contentArea = document.createElement('div');
  contentArea.className = 'flex-1 overflow-y-auto px-4 md:px-8 pb-24';
  wrapper.appendChild(contentArea);

  container.appendChild(wrapper);

  const calendarControls = document.createElement('div');
  calendarControls.className = 'flex items-center gap-3 mb-4 flex-wrap';

  const generateIdeasBtn = document.createElement('button');
  generateIdeasBtn.type = 'button';
  generateIdeasBtn.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 hover:border-amber-400/50';
  generateIdeasBtn.innerHTML = `${SVG_LIGHTBULB} Generate Content Ideas`;
  generateIdeasBtn.onclick = async () => {
    if (aiLoading) return;
    aiLoading = true;
    generateIdeasBtn.innerHTML = `${SVG_SPIN} Generating...`;
    generateIdeasBtn.disabled = true;
    try {
      const ideas = await generateContentIdeas(30);
      contentIdeas = ideas;
      showToast('Generated 30 content ideas!', 'success');
      renderTabContent();
    } catch (err) {
      console.error('[SmartVideoScheduler] generateContentIdeas failed:', err);
      showToast(err.message || 'Failed to generate ideas', 'error');
    } finally {
      aiLoading = false;
      generateIdeasBtn.innerHTML = `${SVG_LIGHTBULB} Generate Content Ideas`;
      generateIdeasBtn.disabled = false;
    }
  };

  const scheduleBtn = document.createElement('button');
  scheduleBtn.type = 'button';
  scheduleBtn.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold btn-secondary-modern transition-all';
  scheduleBtn.innerHTML = `${SVG_CALENDAR} Schedule Video`;
  scheduleBtn.onclick = () => {
    showToast('Schedule feature coming soon', 'info');
  };

  function renderTabContent() {
    contentArea.innerHTML = '';
    calendarControls.innerHTML = '';

    if (activeTab === 'Calendar') {
      calendarControls.appendChild(generateIdeasBtn);
      calendarControls.appendChild(scheduleBtn);
      contentArea.appendChild(calendarControls);

      if (contentIdeas.length > 0) {
        const ideasGrid = document.createElement('div');
        ideasGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4';

        contentIdeas.forEach((idea, idx) => {
          const card = document.createElement('div');
          card.className = 'bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-white/20 transition-all';
          const dayNum = idx + 1;
          card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider">Day ${dayNum}</span>
              <span class="text-[10px] text-muted">${idea.category || 'Content'}</span>
            </div>
            <h3 class="text-sm font-bold text-white mb-1">${idea.title || 'Untitled Idea'}</h3>
            <p class="text-xs text-muted line-clamp-2">${idea.description || ''}</p>
          `;
          ideasGrid.appendChild(card);
        });

        contentArea.appendChild(ideasGrid);
      } else {
        const emptyState = document.createElement('div');
        emptyState.className = 'flex flex-col items-center justify-center py-16 text-center';
        emptyState.innerHTML = `
          <div class="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h3 class="text-sm font-bold text-white mb-1">No content ideas yet</h3>
          <p class="text-xs text-muted max-w-xs">Click "Generate Content Ideas" to create 30 days of AI-powered video content suggestions</p>
        `;
        contentArea.appendChild(emptyState);
      }
    } else if (activeTab === 'Schedule') {
      const emptySchedule = document.createElement('div');
      emptySchedule.className = 'flex flex-col items-center justify-center py-16 text-center';
      emptySchedule.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h3 class="text-sm font-bold text-white mb-1">Schedule</h3>
        <p class="text-xs text-muted max-w-xs">Your scheduled videos will appear here</p>
      `;
      contentArea.appendChild(emptySchedule);
    } else if (activeTab === 'Analytics') {
      const emptyAnalytics = document.createElement('div');
      emptyAnalytics.className = 'flex flex-col items-center justify-center py-16 text-center';
      emptyAnalytics.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <h3 class="text-sm font-bold text-white mb-1">Analytics</h3>
        <p class="text-xs text-muted max-w-xs">Performance metrics will appear here after publishing</p>
      `;
      contentArea.appendChild(emptyAnalytics);
    }
  }

  let aiPanelEl = null;
  let aiCaptionAssistant = null;

  function renderAIPanel() {
    if (aiPanelEl) {
      aiPanelEl.remove();
      aiPanelEl = null;
    }

    if (!aiPanelOpen) return;

    aiPanelEl = document.createElement('div');
    aiPanelEl.className = 'fixed bottom-6 right-6 z-50';

    const panelContainer = document.createElement('div');
    panelContainer.className = 'bg-[#141416] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 w-[380px] max-h-[520px] overflow-hidden flex flex-col ai-panel-animate-in';

    const panelHeader = document.createElement('div');
    panelHeader.className = 'flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0';
    panelHeader.innerHTML = `<div class="flex items-center gap-2">${SVG_AI_ASSIST}<span class="text-sm font-bold text-white">AI Caption Assistant</span></div>`;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors';
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick = () => {
      aiPanelOpen = false;
      renderAIPanel();
    };
    panelHeader.appendChild(closeBtn);
    panelContainer.appendChild(panelHeader);

    const panelBody = document.createElement('div');
    panelBody.className = 'flex-1 overflow-y-auto p-4';
    panelContainer.appendChild(panelBody);

    aiPanelEl.appendChild(panelContainer);
    document.body.appendChild(aiPanelEl);

    aiCaptionAssistant = new AICaptionAssistant({
      compact: true,
      onGenerate: (caption) => {
        showToast('Caption generated!', 'success');
      },
    });

    const assistantEl = aiCaptionAssistant.getElement ? aiCaptionAssistant.getElement() : aiCaptionAssistant.element;
    if (assistantEl) {
      panelBody.appendChild(assistantEl);
    }
  }

  const floatBtn = document.createElement('button');
  floatBtn.type = 'button';
  floatBtn.className = 'fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30 flex items-center justify-center hover:scale-110 hover:shadow-violet-500/50 transition-all';
  floatBtn.innerHTML = SVG_AI_ASSIST;
  floatBtn.title = 'AI Assist';
  floatBtn.onclick = () => {
    aiPanelOpen = !aiPanelOpen;
    renderAIPanel();
    floatBtn.classList.toggle('hidden', aiPanelOpen);
  };
  floatBtn.dataset.aiFloatBtn = 'true';
  container.appendChild(floatBtn);

  const styleId = 'smart-video-scheduler-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes ai-panel-in {
        0% { opacity: 0; transform: translateY(16px) scale(0.96); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      .ai-panel-animate-in {
        animation: ai-panel-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
    `;
    document.head.appendChild(style);
  }

  renderTabContent();

  return container;
}
