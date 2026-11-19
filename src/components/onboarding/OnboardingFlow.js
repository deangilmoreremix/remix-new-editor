// src/components/onboarding/OnboardingFlow.js
//
// The app-wide SmartVideo onboarding, one question per screen with a progress bar, Back and Skip
// (same look as the Video Outreach welcome). Answers and options: src/lib/onboarding/store.js.
//   1 goal   2 team size   3 videos per month   4 where you work   5 how you heard   6 what to make first
// Step 6 has two parts: the kind of video, then the tools (thumbnails, grouped like the side menu).
// Every answer goes to onChange (saved at once by the caller), so leaving half-way resumes at the same step.
import { TEAM_SIZES, VOLUMES, SOURCES } from '../../lib/outreach/onboarding.js';
import { APP_ONBOARDING_STEPS, cleanAppOnboarding, workReady, normalizeWebsite } from '../../lib/onboarding/store.js';
import { GOAL_CARDS, buildToolGroups, orderedVideoTypes, recommendedTools } from '../../lib/onboarding/toolCatalog.js';
import { ToolCard } from './ToolCard.js';
import { el, svg, ICONS, LOGO, card, INPUT, CTA, CHIP } from './ui.js';

const GOAL_ICONS = { 'ai-video': 'camera', images: 'image', personal: 'users', edit: 'scissors', marketing: 'megaphone', explore: 'grid' };
const LAST = APP_ONBOARDING_STEPS;

/**
 * mountOnboarding(host, { name, initial, onChange(answers), onFinish(answers), onDismiss(answers) }) -> { destroy, answers }
 * onFinish runs after the last step (or Skip on it); onDismiss when the person skips the whole onboarding.
 */
export function mountOnboarding(host, { name = '', initial = null, onChange = () => {}, onFinish = () => {}, onDismiss = () => {} } = {}) {
  let a = cleanAppOnboarding(initial || {});
  let part = a.videoTypes.length ? 'tools' : 'type'; // step 6: 'type' (video kind) or 'tools'

  const root = el('div', 'fixed inset-0 z-40 flex flex-col overflow-y-auto bg-app-bg text-white');
  root.setAttribute('data-onboarding', '');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Welcome to SmartVideo');
  const bar = el('div', 'h-[3px] w-full shrink-0 bg-white/[0.06]');
  const fill = el('div', 'h-full bg-primary transition-all duration-300');
  bar.appendChild(fill);
  const head = el('div', 'grid shrink-0 grid-cols-3 items-center px-6 py-5 md:px-12');
  const body = el('div', 'mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 pb-28 pt-6 md:pt-14');
  root.append(bar, head, body);
  host.appendChild(root);

  const change = (patch) => { a = cleanAppOnboarding({ ...a, ...patch }); onChange(a); };
  const go = (step) => { change({ step }); if (step === LAST) part = a.videoTypes.length ? 'tools' : 'type'; paint(); root.scrollTop = 0; };
  const next = () => (a.step >= LAST ? finish() : go(a.step + 1));
  function finish() { change({ completedAt: new Date().toISOString(), skippedAt: null }); destroy(); onFinish(a); }
  function dismiss() { change({ skippedAt: new Date().toISOString() }); destroy(); onDismiss(a); }
  function back() {
    if (a.step === LAST && part === 'tools') { part = 'type'; paint(); root.scrollTop = 0; return; }
    go(a.step - 1);
  }

  function header() {
    head.replaceChildren();
    const left = el('div', 'justify-self-start');
    if (a.step === 1) {
      const logo = el('div', 'flex items-center gap-2.5');
      logo.innerHTML = `${LOGO}<span class="text-lg font-extrabold tracking-tight">SmartVideo</span>`;
      left.appendChild(logo);
    } else {
      const b = el('button', 'flex items-center gap-1 rounded-lg px-1 py-1 text-sm text-white/60 hover:text-white');
      b.type = 'button';
      b.setAttribute('data-onb-back', '');
      b.innerHTML = `${svg(ICONS.back, 16)}<span>Back</span>`;
      b.addEventListener('click', back);
      left.appendChild(b);
    }
    const mid = el('div', 'justify-self-center text-[13px] text-white/50', `Step ${a.step} of ${LAST}`);
    const right = el('div', 'justify-self-end');
    if (a.step !== 4) {
      const skip = el('button', 'rounded-lg px-1 py-1 text-sm text-white/60 hover:text-white', 'Skip');
      skip.type = 'button';
      skip.setAttribute('data-onb-skip', '');
      skip.addEventListener('click', next);
      right.appendChild(skip);
    }
    head.append(left, mid, right);
    fill.style.width = `${(a.step / LAST) * 100}%`;
  }

  const titles = (t, sub) => body.append(
    el('h1', 'text-center text-3xl font-extrabold tracking-tight md:text-[34px]', t),
    el('p', 'mt-3 text-center text-[15px] text-white/55', sub),
  );

  // 1 -- what to do first
  function step1() {
    titles(`Welcome${name ? `, ${name}` : ''}. What do you want to do first?`, 'We set up your workspace for your choice. You can do everything else later.');
    const grid = el('div', 'mt-10 grid w-full max-w-5xl gap-5 md:grid-cols-2 lg:grid-cols-3');
    GOAL_CARDS.forEach((g) => {
      const b = el('button', `${card(a.goal === g.id)} flex flex-col gap-4 p-7`);
      b.type = 'button';
      b.setAttribute('data-onb-goal', g.id);
      b.setAttribute('aria-pressed', String(a.goal === g.id));
      const icon = el('div', 'grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary');
      icon.innerHTML = svg(ICONS[GOAL_ICONS[g.id]] || ICONS.sparkles, 24);
      const tags = el('div', 'mt-auto flex flex-wrap gap-2 pt-4');
      g.tags.forEach((t) => tags.appendChild(el('span', 'rounded-full bg-white/[0.07] px-3 py-1 text-xs font-semibold text-white/75', t)));
      b.append(icon, el('div', 'text-xl font-bold', g.title), el('p', 'text-[15px] leading-relaxed text-white/60', g.text), tags);
      b.addEventListener('click', () => { change({ goal: g.id }); next(); });
      grid.appendChild(b);
    });
    const dismissBtn = el('button', 'mt-9 rounded-full px-5 py-2.5 text-sm text-white/50 hover:text-white', 'Skip onboarding, take me to the app');
    dismissBtn.type = 'button';
    dismissBtn.setAttribute('data-onb-dismiss', '');
    dismissBtn.addEventListener('click', dismiss);
    body.append(grid, dismissBtn);
  }

  // 2 -- team size
  function step2() {
    titles('Who else on your team might use SmartVideo?', 'We use this to suggest the right plan and set up sharing for your team.');
    const list = el('div', 'mt-10 flex w-full max-w-xl flex-col gap-3');
    TEAM_SIZES.forEach((t) => {
      const b = el('button', `${card(a.team === t.id)} flex items-center gap-4 px-5 py-4 text-[16px] font-semibold`);
      b.type = 'button';
      b.setAttribute('data-onb-team', t.id);
      b.setAttribute('aria-pressed', String(a.team === t.id));
      b.innerHTML = `<span class="text-primary">${svg(ICONS[t.icon])}</span>`;
      b.appendChild(el('span', '', t.label));
      b.addEventListener('click', () => { change({ team: t.id }); next(); });
      list.appendChild(b);
    });
    body.appendChild(list);
  }

  // 3 -- volume
  function step3() {
    titles('How many videos do you expect to make per month?', 'A guess is fine. It helps us suggest the right plan.');
    const grid = el('div', 'mt-10 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3');
    VOLUMES.forEach((v) => {
      const b = el('button', `${card(a.volume === v.id)} px-4 py-6 text-center text-[17px] font-semibold`, v.label);
      b.type = 'button';
      b.setAttribute('data-onb-volume', v.id);
      b.setAttribute('aria-pressed', String(a.volume === v.id));
      b.addEventListener('click', () => { change({ volume: v.id }); next(); });
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }

  // 4 -- where you work
  function step4() {
    titles('Tell us where you work', 'We use your company and website for your sample video, your scripts and your landing pages.');
    const form = el('form', 'mt-10 flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-7');
    form.setAttribute('data-onb-work', '');
    const input = (label, key, ph) => {
      const wrap = el('label', 'flex flex-col gap-2');
      wrap.appendChild(el('span', 'text-[13px] font-semibold text-white/80', label));
      const i = el('input', INPUT);
      i.type = 'text'; i.name = key; i.placeholder = ph; i.value = a[key] || '';
      i.autocomplete = key === 'company' ? 'organization' : key === 'jobTitle' ? 'organization-title' : 'url';
      i.addEventListener('input', () => { a = cleanAppOnboarding({ ...a, [key]: i.value }); ok.disabled = !workReady(a); });
      i.addEventListener('change', () => change({ [key]: i.value }));
      wrap.appendChild(i);
      return { wrap, i };
    };
    const company = input('Company name', 'company', 'For example: Acme Inc.');
    const site = input('Website URL', 'website', 'For example: acme.com');
    const job = input('Job title', 'jobTitle', 'For example: Account Executive');
    const hint = el('p', 'min-h-[1rem] text-xs text-amber-300');
    site.i.addEventListener('blur', () => { hint.textContent = site.i.value.trim() && !normalizeWebsite(site.i.value) ? 'Enter a web address, like acme.com.' : ''; });
    const ok = el('button', `mt-1 ${CTA}`, 'Continue');
    ok.type = 'submit';
    ok.disabled = !workReady(a);
    form.append(company.wrap, site.wrap, job.wrap, hint, ok);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!workReady(a)) return;
      change({ company: company.i.value, website: normalizeWebsite(site.i.value), jobTitle: job.i.value });
      next();
    });
    body.appendChild(form);
    setTimeout(() => (a.company ? site.i : company.i).focus?.(), 0);
  }

  // 5 -- how you heard
  function step5() {
    titles('How did you hear about us?', 'It helps us find more teams like yours. One more step: choose what you want to make first.');
    const wrap = el('div', 'mt-10 flex w-full max-w-4xl flex-wrap justify-center gap-3');
    SOURCES.forEach((s) => {
      const b = el('button', CHIP(a.heard === s.id), s.label);
      b.type = 'button';
      b.setAttribute('data-onb-heard', s.id);
      b.addEventListener('click', () => { change({ heard: s.id, heardOther: '' }); next(); });
      wrap.appendChild(b);
    });
    const other = el('form', 'flex items-center gap-2 rounded-full border border-dashed border-white/20 py-1.5 pl-5 pr-1.5 focus-within:border-primary/50');
    const i = el('input', 'w-48 bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none');
    i.placeholder = 'Something else…';
    i.setAttribute('aria-label', 'Something else');
    i.value = a.heard === 'other' ? a.heardOther : '';
    const send = el('button', 'grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/70 hover:border-primary/40 hover:text-white');
    send.type = 'submit';
    send.setAttribute('aria-label', 'Send');
    send.innerHTML = svg(ICONS.arrow, 16);
    other.append(i, send);
    other.addEventListener('submit', (e) => { e.preventDefault(); if (!i.value.trim()) { i.focus(); return; } change({ heard: 'other', heardOther: i.value }); next(); });
    wrap.appendChild(other);
    body.appendChild(wrap);
  }

  // 6a -- the kind of video (pick one or more)
  function step6Type() {
    titles('What kind of video do you want to make?', 'Pick one or more. We show the best tools for them first.');
    const grid = el('div', 'mt-10 grid w-full max-w-4xl gap-4 sm:grid-cols-2');
    orderedVideoTypes(a.goal).forEach((t) => {
      const on = a.videoTypes.includes(t.id);
      const b = el('button', `${card(on)} flex flex-col gap-1.5 p-6`);
      b.type = 'button';
      b.setAttribute('data-onb-type', t.id);
      b.setAttribute('aria-pressed', String(on));
      b.append(el('div', 'text-[17px] font-bold', t.title), el('p', 'text-[14px] text-white/55', t.text));
      b.addEventListener('click', () => {
        const types = on ? a.videoTypes.filter((x) => x !== t.id) : [...a.videoTypes, t.id];
        change({ videoTypes: types });
        paint();
      });
      grid.appendChild(b);
    });
    const actions = el('div', 'mt-8 flex flex-col items-center gap-3');
    const cont = el('button', CTA, a.videoTypes.length ? 'Show me the tools' : 'Pick a kind of video to continue');
    cont.type = 'button';
    cont.disabled = !a.videoTypes.length;
    cont.setAttribute('data-onb-continue', '');
    cont.addEventListener('click', () => { part = 'tools'; paint(); root.scrollTop = 0; });
    const all = el('button', 'text-sm text-white/55 hover:text-white', 'Not sure? Show me every tool');
    all.type = 'button';
    all.setAttribute('data-onb-all-tools', '');
    all.addEventListener('click', () => { part = 'tools'; paint(); root.scrollTop = 0; });
    actions.append(cont, all);
    body.append(grid, actions);
  }

  // 6b -- the tools, grouped like the side menu; recommended ones first
  function step6Tools() {
    titles('Choose your tools', 'Grouped like your side menu. Pick the ones you want to start with.');
    const rec = recommendedTools(a.videoTypes);
    const cards = new Map();
    const toggle = (id) => {
      const on = a.tools.includes(id);
      change({ tools: on ? a.tools.filter((x) => x !== id) : [...a.tools, id] });
      cards.forEach((c, k) => c.refresh(a.tools.includes(k)));
      sync();
    };
    const wrap = el('div', 'mt-10 flex w-full flex-col gap-10');
    buildToolGroups().forEach((g) => {
      const items = [...g.items].sort((x, y) => (rec.includes(y.id) ? 1 : 0) - (rec.includes(x.id) ? 1 : 0) || (rec.indexOf(x.id) - rec.indexOf(y.id)));
      const sec = el('section', 'flex flex-col gap-4');
      sec.setAttribute('data-onb-group', g.title);
      sec.appendChild(el('h2', 'text-sm font-bold uppercase tracking-wider text-white/50', g.title));
      const grid = el('div', 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3');
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
      wrap.appendChild(sec);
    });
    // Sticky action bar.
    const bar2 = el('div', 'fixed inset-x-0 bottom-0 z-10 flex items-center justify-center gap-4 border-t border-white/10 bg-app-bg/95 px-5 py-4 backdrop-blur');
    const count = el('span', 'text-sm text-white/60');
    const start = el('button', CTA);
    start.type = 'button';
    start.setAttribute('data-onb-start', '');
    start.addEventListener('click', finish);
    bar2.append(count, start);
    function sync() {
      const n = a.tools.length;
      count.textContent = n ? `${n} selected` : 'Nothing selected yet';
      start.textContent = n ? 'Start' : 'Explore all tools';
    }
    sync();
    body.append(wrap);
    root.appendChild(bar2);
    bar2.setAttribute('data-onb-bar', '');
  }

  function step6() { (part === 'tools' ? step6Tools : step6Type)(); }

  const VIEWS = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6 };
  function paint() {
    root.querySelectorAll('[data-onb-bar]').forEach((n) => n.remove());
    header();
    body.replaceChildren();
    VIEWS[a.step]();
  }
  function destroy() { root.remove(); }
  paint();
  return { destroy, get answers() { return a; } };
}
