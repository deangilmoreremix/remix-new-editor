import { mountStudioChrome } from '../lib/studioChrome.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { showToast } from '../lib/loading.js';

const SVG_AI_ASSIST = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/></svg>';
const SVG_SPIN = '<svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-opacity="0.3"/><path d="M21 12a9 9 0 00-9-9"/></svg>';
const SVG_CALENDAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

const CALENDAR_TABS = ['Calendar', 'Schedule', 'Analytics'];

export function SmartVideoScheduler() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-hidden relative';
  mountStudioChrome(container, { currentRoute: 'smart-video-scheduler', title: 'Smart Video Scheduler' });

  let activeTab = 'Calendar';
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
    if (aiPanelOpen && window.openModal) {
      window.openModal('ai-caption-assistant', {
        onGenerate: (caption) => { showToast('Caption generated!', 'success'); },
      });
      aiPanelOpen = false;
    }
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

  function renderTabContent() {
    contentArea.innerHTML = '';
    if (activeTab === 'Calendar') {
      const placeholder = document.createElement('div');
      placeholder.className = 'flex flex-col items-center justify-center py-20 text-center';
      placeholder.innerHTML = '<div class="text-5xl mb-4">📅</div><h3 class="text-lg font-bold text-white mb-2">Content Calendar</h3><p class="text-sm text-white/50 max-w-md">Your scheduled posts will appear here. Connect your social accounts to start scheduling.</p>';
      contentArea.appendChild(placeholder);
    } else if (activeTab === 'Schedule') {
      const placeholder = document.createElement('div');
      placeholder.className = 'flex flex-col items-center justify-center py-20 text-center';
      placeholder.innerHTML = '<div class="text-5xl mb-4">⏰</div><h3 class="text-lg font-bold text-white mb-2">Schedule Posts</h3><p class="text-sm text-white/50 max-w-md">Schedule your content for the best times. AI will suggest optimal posting times.</p>';
      contentArea.appendChild(placeholder);
    } else if (activeTab === 'Analytics') {
      const placeholder = document.createElement('div');
      placeholder.className = 'flex flex-col items-center justify-center py-20 text-center';
      placeholder.innerHTML = '<div class="text-5xl mb-4">📊</div><h3 class="text-lg font-bold text-white mb-2">Analytics</h3><p class="text-sm text-white/50 max-w-md">Track your post performance across all platforms.</p>';
      contentArea.appendChild(placeholder);
    }
  }

  renderTabContent();
  return container;
}
