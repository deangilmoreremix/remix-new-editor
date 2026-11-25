import { mountStudioChrome } from '../lib/studioChrome.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { cancelScheduledPost, listScheduledPosts, STATUS_LABELS } from '../lib/socialSchedule.js';
import { groupPostsByDay, postLink, postTitle, summarizePosts } from '../lib/scheduledPostsView.js';

const CALENDAR_TABS = ['Calendar', 'Schedule', 'Analytics'];
const REFRESH_MS = 30_000;

const TAB_ON = 'px-4 py-2 rounded-lg text-xs font-bold bg-white text-black shadow transition-all';
const TAB_OFF = 'px-4 py-2 rounded-lg text-xs font-bold text-gray-500 hover:text-white hover:bg-white/10 transition-all';

const STATUS_STYLES = {
  scheduled: 'bg-sky-500/15 text-sky-300',
  publishing: 'bg-amber-500/15 text-amber-300',
  processing: 'bg-amber-500/15 text-amber-300',
  published: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-red-500/15 text-red-300',
  cancelled: 'bg-white/10 text-white/50',
};

const PLATFORM_LABELS = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };

// Post titles and errors are user- or platform-supplied, so every node below is
// built with textContent, never innerHTML.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function SmartVideoScheduler() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-hidden relative';
  mountStudioChrome(container, { currentRoute: 'smart-video-scheduler', title: 'Smart Video Scheduler' });

  let activeTab = 'Calendar';
  let posts = [];
  let loading = true;
  let loadError = null;
  let cancellingId = null;

  const wrapper = el('div', 'flex flex-col flex-1 overflow-hidden');
  const topBar = el('div', 'px-4 md:px-8 pt-6 pb-4 shrink-0');

  const hero = createHeroSection('smart-video-scheduler', 'h-28 md:h-40 mb-4');
  if (hero) {
    const heroText = el('div', 'absolute bottom-0 left-0 right-0 p-5 z-10 flex items-end justify-between');
    const heroCopy = el('div');
    heroCopy.appendChild(el('h1', 'text-2xl md:text-4xl font-black text-white tracking-tight mb-1', 'Smart Video Scheduler'));
    heroCopy.appendChild(el('p', 'text-white/60 text-sm max-w-md', 'Schedule posts to YouTube, TikTok and Instagram'));
    heroText.appendChild(heroCopy);
    hero.appendChild(heroText);
    topBar.appendChild(hero);
  }
  wrapper.appendChild(topBar);

  const tabBar = el('div', 'px-4 md:px-8 pb-2 shrink-0 flex items-center gap-1');
  const tabButtons = {};
  CALENDAR_TABS.forEach((tab) => {
    const btn = el('button', tab === activeTab ? TAB_ON : TAB_OFF, tab);
    btn.type = 'button';
    btn.onclick = () => selectTab(tab);
    tabButtons[tab] = btn;
    tabBar.appendChild(btn);
  });
  wrapper.appendChild(tabBar);

  const contentArea = el('div', 'flex-1 overflow-y-auto px-4 md:px-8 pb-24');
  wrapper.appendChild(contentArea);
  container.appendChild(wrapper);

  function selectTab(tab) {
    activeTab = tab;
    Object.entries(tabButtons).forEach(([key, b]) => { b.className = key === activeTab ? TAB_ON : TAB_OFF; });
    renderTabContent();
  }

  function openScheduler() {
    openSocialPublish({
      mode: 'schedule',
      onScheduled: () => {
        selectTab('Calendar');
        load();
      },
    });
  }

  function primaryButton(label) {
    const btn = el('button', 'px-5 py-2.5 rounded-xl text-sm font-bold bg-lime-400 text-black hover:bg-lime-300 transition-all', label);
    btn.type = 'button';
    btn.onclick = openScheduler;
    return btn;
  }

  function message(title, body, withButton) {
    const box = el('div', 'flex flex-col items-center justify-center py-20 text-center gap-3');
    box.appendChild(el('h3', 'text-lg font-bold text-white', title));
    if (body) box.appendChild(el('p', 'text-sm text-white/50 max-w-md', body));
    if (withButton) box.appendChild(primaryButton('Schedule a post'));
    return box;
  }

  async function onCancel(post) {
    cancellingId = post.id;
    renderTabContent();
    try {
      await cancelScheduledPost(post.id);
      loadError = null;
    } catch (e) {
      loadError = e.message || 'Could not cancel the post.';
    }
    cancellingId = null;
    await load();
  }

  function postRow(post) {
    const row = el('div', 'flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10');
    row.dataset.postId = post.id;

    const time = new Date(post.run_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    row.appendChild(el('div', 'w-16 shrink-0 text-xs font-bold text-white/70 pt-0.5', time));

    const body = el('div', 'flex-1 min-w-0');
    body.appendChild(el('div', 'text-sm font-semibold text-white truncate', postTitle(post)));
    const meta = el('div', 'flex items-center gap-2 mt-1 flex-wrap');
    meta.appendChild(el('span', 'text-[11px] text-white/50', PLATFORM_LABELS[post.platform] || post.platform));
    meta.appendChild(el('span', `text-[11px] px-2 py-0.5 rounded-full ${STATUS_STYLES[post.status] || STATUS_STYLES.cancelled}`, STATUS_LABELS[post.status] || post.status));
    body.appendChild(meta);

    if (post.status === 'failed' && post.error) {
      body.appendChild(el('div', 'text-xs text-red-300 mt-1', post.error));
    }
    const thumbNote = post.result?.thumbnail;
    if (post.status === 'published' && typeof thumbNote === 'string' && thumbNote.startsWith('failed')) {
      body.appendChild(el('div', 'text-xs text-amber-300 mt-1', 'Published, but the thumbnail was not applied. Set it in YouTube Studio.'));
    }
    const link = post.status === 'published' ? postLink(post) : null;
    if (link) {
      const a = el('a', 'text-xs text-sky-300 underline mt-1 inline-block', 'View post');
      a.href = link;
      a.target = '_blank';
      a.rel = 'noreferrer noopener';
      body.appendChild(a);
    }
    row.appendChild(body);

    if (post.status === 'scheduled') {
      const busy = cancellingId === post.id;
      const cancel = el('button', 'text-xs px-3 py-1.5 rounded-lg border border-white/15 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50', busy ? 'Cancelling…' : 'Cancel');
      cancel.type = 'button';
      cancel.disabled = busy;
      cancel.onclick = () => onCancel(post);
      row.appendChild(cancel);
    }
    return row;
  }

  function renderCalendar() {
    if (loading && posts.length === 0) return message('Loading your schedule…');
    if (loadError && posts.length === 0) return message('Could not load your schedule', loadError);
    const visible = posts.filter((p) => p.status !== 'cancelled');
    if (visible.length === 0) {
      return message('Nothing scheduled yet', 'Posts you schedule will appear here, grouped by day.', true);
    }
    const list = el('div', 'flex flex-col gap-6 pt-2');
    if (loadError) list.appendChild(el('div', 'text-sm text-red-300', loadError));
    groupPostsByDay(visible).forEach((day) => {
      const section = el('section', 'flex flex-col gap-2');
      section.appendChild(el('h3', 'text-xs font-bold uppercase tracking-wider text-white/50', day.label));
      day.posts.forEach((post) => section.appendChild(postRow(post)));
      list.appendChild(section);
    });
    return list;
  }

  function renderSchedule() {
    const box = message(
      'Schedule a post',
      'Pick a video or image, write the copy, choose an account and a time. Your Muapi key is stored encrypted only until the post has published.',
      true,
    );
    return box;
  }

  function renderAnalytics() {
    if (loading && posts.length === 0) return message('Loading…');
    const s = summarizePosts(posts);
    if (s.total === 0) return message('No posts yet', 'Counts for scheduled, published and failed posts appear here once you schedule something.');
    const wrap = el('div', 'pt-4 flex flex-col gap-4');
    const grid = el('div', 'grid grid-cols-2 md:grid-cols-4 gap-3');
    [['Scheduled', s.scheduled + s.inFlight], ['Published', s.published], ['Failed', s.failed], ['Total', s.total - s.cancelled]].forEach(([label, value]) => {
      const card = el('div', 'p-4 rounded-xl bg-white/5 border border-white/10');
      card.appendChild(el('div', 'text-2xl font-black text-white', String(value)));
      card.appendChild(el('div', 'text-xs text-white/50 mt-1', label));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    const platforms = Object.entries(s.byPlatform);
    if (platforms.length) {
      const line = el('div', 'text-sm text-white/60', platforms.map(([p, n]) => `${PLATFORM_LABELS[p] || p}: ${n}`).join('  ·  '));
      wrap.appendChild(line);
    }
    wrap.appendChild(el('p', 'text-xs text-white/40', 'These are your own scheduling counts. Views and engagement from the platforms are not available yet.'));
    return wrap;
  }

  function renderTabContent() {
    contentArea.replaceChildren();
    const view = activeTab === 'Calendar' ? renderCalendar() : activeTab === 'Schedule' ? renderSchedule() : renderAnalytics();
    contentArea.appendChild(view);
  }

  async function load() {
    try {
      posts = await listScheduledPosts();
      loadError = null;
    } catch (e) {
      loadError = e.message || 'Could not load your schedule.';
    }
    loading = false;
    renderTabContent();
  }

  // Keep statuses fresh while the page is open; stops once it leaves the DOM.
  const timer = setInterval(() => {
    if (!container.isConnected) { clearInterval(timer); return; }
    if (document.hidden) return;
    load();
  }, REFRESH_MS);

  renderTabContent();
  load();
  return container;
}
