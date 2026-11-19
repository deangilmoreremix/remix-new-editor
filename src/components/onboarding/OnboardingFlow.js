// src/components/onboarding/OnboardingFlow.js
//
// The app-wide SmartVideo onboarding, in the layout of the reference screenshots, built in the application's own colours and outline-only buttons
// (styles: src/styles/onboarding.css). One question per screen with a progress bar, Back and Skip.
//   1 what to do first (two large cards)   2 team size   3 videos per month   4 where you work   5 how you heard
//   6 what to make first: the kind of video, then the studios (all 38, grouped like the side menu, with images)
// Every answer goes to onChange (saved at once by the caller), so leaving half-way resumes at the same step.
import { TEAM_SIZES, VOLUMES, SOURCES } from '../../lib/outreach/onboarding.js';
import { APP_ONBOARDING_STEPS, cleanAppOnboarding, workReady, normalizeWebsite } from '../../lib/onboarding/store.js';
import { GOAL_CARDS, buildToolGroups, orderedVideoTypes, recommendedTools } from '../../lib/onboarding/toolCatalog.js';
import '../../styles/onboarding.css';
import { ToolCard } from './ToolCard.js';
import { el, svg, ICONS, TYPE_ICONS, logo } from './obIcons.js';

const GOAL_ICONS = { 'ai-video': 'sparkles', personal: 'camera' };
const LAST = APP_ONBOARDING_STEPS;

/**
 * mountOnboarding(host, { name, initial, onChange(answers), onFinish(answers), onDismiss(answers, destination) }) -> { destroy, answers }
 * onFinish runs after the last step (or Skip on it); onDismiss when the person leaves early (the Academy button),
 * with the route to open.
 */
export function mountOnboarding(host, { name = '', initial = null, onChange = () => {}, onFinish = () => {}, onDismiss = () => {} } = {}) {
  let a = cleanAppOnboarding(initial || {});
  let part = a.videoTypes.length ? 'tools' : 'type'; // step 6: 'type' (video kind) or 'tools'

  const root = el('div', 'ob');
  root.setAttribute('data-onboarding', '');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Welcome to SmartVideo');
  const bar = el('div', 'ob-bar');
  const fill = document.createElement('i');
  bar.appendChild(fill);
  const head = el('div', 'ob-head');
  const main = el('div', 'ob-main');
  root.append(bar, head, main);
  host.appendChild(root);
  document.body.classList.add('ob-active');

  // The floating purple help bubble (bottom right) opens the Ask SmartVideo assistant.
  const chat = el('button', 'ob-chat');
  chat.type = 'button';
  chat.setAttribute('aria-label', 'Ask SmartVideo');
  chat.setAttribute('data-onb-chat', '');
  chat.innerHTML = svg(ICONS.chat, 22);
  chat.addEventListener('click', async () => {
    try {
      const m = await import('../../features/ask-smartvideo/AskSmartVideo.js');
      m.mountAskSmartVideo({ navigate: (p) => { window.location.hash = `#/${p}`; window.location.reload(); }, getPage: () => 'onboarding' });
      document.querySelector('#ask-smartvideo-root [data-ask="launcher"]')?.click();
    } catch { chat.remove(); }
  });
  root.appendChild(chat);

  const change = (patch) => { a = cleanAppOnboarding({ ...a, ...patch }); onChange(a); };
  const go = (step) => { change({ step }); if (step === LAST) part = a.videoTypes.length ? 'tools' : 'type'; paint(); root.scrollTop = 0; };
  const next = () => (a.step >= LAST ? finish() : go(a.step + 1));
  function finish() { change({ completedAt: new Date().toISOString(), skippedAt: null }); destroy(); onFinish(a); }
  function leave(route) { change({ skippedAt: new Date().toISOString() }); destroy(); onDismiss(a, route); }
  function back() {
    if (a.step === LAST && part === 'tools') { part = 'type'; paint(); root.scrollTop = 0; return; }
    go(a.step - 1);
  }

  function header() {
    head.replaceChildren();
    const left = el('div');
    if (a.step === 1) {
      left.appendChild(logo());
    } else {
      const b = el('button', 'ob-nav');
      b.type = 'button';
      b.setAttribute('data-onb-back', '');
      b.innerHTML = `${svg(ICONS.back, 16)}<span>Back</span>`;
      b.addEventListener('click', back);
      left.appendChild(b);
    }
    const mid = el('div', 'ob-step', `Step ${a.step} of ${LAST}`);
    const right = el('div');
    if (a.step !== 4) { // where you work needs an answer, so it has no Skip (as in the design)
      const skip = el('button', 'ob-nav', 'Skip');
      skip.type = 'button';
      skip.setAttribute('data-onb-skip', '');
      skip.addEventListener('click', next);
      right.appendChild(skip);
    }
    head.append(left, mid, right);
    fill.style.width = `${(a.step / LAST) * 100}%`;
  }

  const content = el('div', 'ob-content');
  const titles = (t, sub) => {
    main.append(el('h1', 'ob-title', t), el('p', 'ob-sub', sub), content);
  };
  const pressed = (b, on) => { b.setAttribute('aria-pressed', String(on)); return b; };
  // Choice cards and actions are real <button>s: the app's outline-only rules (src/styles/outline-buttons.css) give them
  // a transparent fill, a thin border, and a neon border and neon text while aria-pressed="true".
  const choice = (cls) => { const b = el('button', cls); b.type = 'button'; return b; };
  const filled = (cls, text) => { const b = el('button', cls, text); b.type = 'button'; return b; };

  // 1 -- what to do first: two large cards
  function step1() {
    titles(`Welcome${name ? `, ${name}` : ''}. What do you want to do first?`, 'We set up your workspace for your choice. You can do both later.');
    const grid = el('div', 'ob-goals');
    GOAL_CARDS.forEach((g) => {
      const b = choice('ob-goal');
      b.setAttribute('data-onb-goal', g.id);
      pressed(b, a.goal === g.id);
      const tile = el('div', 'ob-tile');
      tile.innerHTML = svg(ICONS[GOAL_ICONS[g.id]] || ICONS.sparkles, 24);
      const tags = el('div', 'ob-tags');
      g.tags.forEach((t) => tags.appendChild(el('span', 'ob-tag', t)));
      b.append(tile, el('div', 'ob-goal-title', g.title), el('p', 'ob-goal-text', g.text), tags);
      b.addEventListener('click', () => { change({ goal: g.id }); next(); });
      grid.appendChild(b);
    });
    const help = filled('ob-help');
    help.setAttribute('data-onb-academy', '');
    help.innerHTML = `${svg(ICONS.cap, 17)}<span>Not sure? Learn it in the SmartVideo Academy</span>`;
    help.addEventListener('click', () => leave('academy'));
    content.append(grid, help);
  }

  // 2 -- team size
  function step2() {
    titles('Who else on your team might use SmartVideo?', 'We use this to suggest the right plan and set up sharing for your team.');
    const list = el('div', 'ob-rows');
    TEAM_SIZES.forEach((t) => {
      const b = choice('ob-row');
      b.setAttribute('data-onb-team', t.id);
      pressed(b, a.team === t.id);
      b.innerHTML = svg(ICONS[t.icon], 22);
      b.appendChild(el('span', '', t.label));
      b.addEventListener('click', () => { change({ team: t.id }); next(); });
      list.appendChild(b);
    });
    content.appendChild(list);
  }

  // 3 -- volume
  function step3() {
    titles('How many videos do you expect to make per month?', 'A guess is fine. It helps us suggest the right plan.');
    const grid = el('div', 'ob-tiles');
    VOLUMES.forEach((v) => {
      const b = choice('ob-box');
      b.textContent = v.label;
      b.setAttribute('data-onb-volume', v.id);
      pressed(b, a.volume === v.id);
      b.addEventListener('click', () => { change({ volume: v.id }); next(); });
      grid.appendChild(b);
    });
    content.appendChild(grid);
  }

  // 4 -- where you work
  function step4() {
    titles('Tell us where you work', 'We use your company and website for your sample video and your video scripts.');
    const form = el('form', 'ob-form');
    form.setAttribute('data-onb-work', '');
    const input = (label, key, ph) => {
      const wrap = el('label', 'ob-field');
      wrap.appendChild(el('span', '', label));
      const i = el('input', 'ob-input');
      i.type = 'text'; i.name = key; i.placeholder = ph; i.value = a[key] || '';
      i.autocomplete = key === 'company' ? 'organization' : key === 'jobTitle' ? 'organization-title' : 'url';
      i.addEventListener('input', () => { a = cleanAppOnboarding({ ...a, [key]: i.value }); ok.disabled = !workReady(a); });
      i.addEventListener('change', () => change({ [key]: i.value }));
      wrap.appendChild(i);
      return { wrap, i };
    };
    const company = input('Company Name', 'company', 'For example: Acme Inc.');
    const site = input('Website URL', 'website', 'For example: acme.com');
    const job = input('Job Title', 'jobTitle', 'For example: Account Executive');
    const hint = el('p', 'ob-hint');
    site.i.addEventListener('blur', () => { hint.textContent = site.i.value.trim() && !normalizeWebsite(site.i.value) ? 'Enter a web address, like acme.com.' : ''; });
    const ok = filled('ob-primary ob-block', 'Continue');
    ok.type = 'submit';
    ok.disabled = !workReady(a);
    form.append(company.wrap, site.wrap, job.wrap, hint, ok);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!workReady(a)) return;
      change({ company: company.i.value, website: normalizeWebsite(site.i.value), jobTitle: job.i.value });
      next();
    });
    content.appendChild(form);
  }

  // 5 -- how you heard
  function step5() {
    titles('Finally, how did you hear about us?', 'It helps us find more teams like yours. One more step: choose what you want to make first.');
    const wrap = el('div', 'ob-chips');
    SOURCES.forEach((s) => {
      const b = choice('ob-chip');
      b.textContent = s.label;
      b.setAttribute('data-onb-heard', s.id);
      pressed(b, a.heard === s.id);
      b.addEventListener('click', () => { change({ heard: s.id, heardOther: '' }); next(); });
      wrap.appendChild(b);
    });
    const other = el('form', 'ob-other');
    const i = el('input');
    i.placeholder = 'Something else…';
    i.setAttribute('aria-label', 'Something else');
    i.value = a.heard === 'other' ? a.heardOther : '';
    const send = el('button');
    send.type = 'submit';
    send.setAttribute('aria-label', 'Send');
    send.innerHTML = svg(ICONS.arrow, 16);
    other.append(i, send);
    other.addEventListener('submit', (e) => { e.preventDefault(); if (!i.value.trim()) { i.focus(); return; } change({ heard: 'other', heardOther: i.value }); next(); });
    wrap.appendChild(other);
    content.appendChild(wrap);
  }

  // 6a -- the kind of video (pick one or more)
  function step6Type() {
    titles('What kind of video do you want to make?', 'Pick one or more. We show the best studios for them first.');
    const grid = el('div', 'ob-types');
    orderedVideoTypes(a.goal).forEach((t) => {
      const on = a.videoTypes.includes(t.id);
      const b = choice('ob-type');
      b.setAttribute('data-onb-type', t.id);
      pressed(b, on);
      const tile = el('div', 'ob-tile');
      tile.innerHTML = svg(ICONS[TYPE_ICONS[t.id]] || ICONS.sparkles, 22);
      const text = el('div');
      text.append(el('div', 'ob-type-title', t.title), el('div', 'ob-type-text', t.text));
      b.append(tile, text);
      b.addEventListener('click', () => {
        change({ videoTypes: on ? a.videoTypes.filter((x) => x !== t.id) : [...a.videoTypes, t.id] });
        paint();
      });
      grid.appendChild(b);
    });
    const actions = el('div', 'ob-actions');
    const cont = filled('ob-primary', a.videoTypes.length ? 'Show me the studios' : 'Pick a kind of video to continue');
    cont.disabled = !a.videoTypes.length;
    cont.setAttribute('data-onb-continue', '');
    cont.addEventListener('click', () => { part = 'tools'; paint(); root.scrollTop = 0; });
    const all = el('button', 'ob-link', 'Not sure? Show me every studio');
    all.type = 'button';
    all.setAttribute('data-onb-all-tools', '');
    all.addEventListener('click', () => { part = 'tools'; paint(); root.scrollTop = 0; });
    actions.append(cont, all);
    content.append(grid, actions);
  }

  // 6b -- all 38 studios, grouped like the side menu; recommended ones first
  function step6Tools() {
    titles('Choose your studios', 'All 38, grouped like your side menu. Pick the ones you want to start with, or press Open to go straight in.');
    const rec = recommendedTools(a.videoTypes);
    const cards = new Map();
    const toggle = (id) => {
      const on = a.tools.includes(id);
      change({ tools: on ? a.tools.filter((x) => x !== id) : [...a.tools, id] });
      cards.forEach((c, k) => c.refresh(a.tools.includes(k)));
      sync();
    };
    const groups = el('div', 'ob-groups');
    buildToolGroups().forEach((g) => {
      const items = [...g.items].sort((x, y) => (rec.includes(y.id) ? 1 : 0) - (rec.includes(x.id) ? 1 : 0) || (rec.indexOf(x.id) - rec.indexOf(y.id)));
      const sec = el('section');
      sec.setAttribute('data-onb-group', g.title);
      sec.appendChild(el('h2', 'ob-ghead', g.title));
      const grid = el('div', 'ob-tools');
      items.forEach((t) => {
        const c = ToolCard(t, {
          selected: a.tools.includes(t.id),
          recommended: rec.includes(t.id),
          onToggle: toggle,
          // "Open": finish now and go straight to this studio (it becomes the first choice; other picks are kept).
          onOpen: (id) => { change({ tools: [id, ...a.tools.filter((x) => x !== id)], primaryTool: id }); finish(); },
        });
        cards.set(t.id, c);
        grid.appendChild(c);
      });
      sec.appendChild(grid);
      groups.appendChild(sec);
    });
    content.appendChild(groups);
    // Sticky action bar.
    const bar2 = el('div', 'ob-bottom');
    bar2.setAttribute('data-onb-bar', '');
    const count = el('span', 'ob-count');
    const start = filled('ob-primary');
    start.setAttribute('data-onb-start', '');
    start.addEventListener('click', finish);
    bar2.append(count, start);
    function sync() {
      const n = a.tools.length;
      count.textContent = n ? `${n} selected` : 'Nothing selected yet';
      start.textContent = n ? 'Start' : 'Explore all studios';
    }
    sync();
    root.appendChild(bar2);
    root.classList.add('ob-has-bottom');
  }

  function step6() { (part === 'tools' ? step6Tools : step6Type)(); }

  const VIEWS = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6 };
  function paint() {
    root.querySelectorAll('[data-onb-bar]').forEach((n) => n.remove());
    root.classList.remove('ob-has-bottom');
    header();
    main.replaceChildren();
    content.replaceChildren();
    VIEWS[a.step]();
  }
  function destroy() { document.body.classList.remove('ob-active'); root.remove(); }
  paint();
  return { destroy, get answers() { return a; } };
}
