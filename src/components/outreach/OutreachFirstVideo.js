// src/components/outreach/OutreachFirstVideo.js
//
// "Your first video", right after the SmartVideo welcome: the person is the first prospect.
//   1 See a personalized video made for you   (their name, company and website; what they get)
//   2 Making your video                       (website, name in the voice, video, landing page; while you wait)
//   3 <Name>, your video is ready             (the video, Watch it on your landing page, Make one for my prospects)
// The video is made by Video Outreach's own Generate (the caller's `make`), from the SmartVideo sample presenter.
import { normalizeWebsite } from '../../lib/outreach/onboarding.js';

// The SmartVideo sample presenter (an AI presenter, made once): the video starts with a short pause for the greeting.
export const SAMPLE_PRESENTER = Object.freeze({ video: '/media/outreach-sample/presenter.mp4', poster: '/media/outreach-sample/presenter.jpg', hiThere: '/media/outreach-sample/hi-there.mp3' });

const el = (tag, cls = '', txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};
const svg = (paths, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICON = {
  sparkle: '<path d="M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};
const LOGO = `<div class="grid h-8 w-8 place-items-center rounded-lg bg-white p-1.5">${svg('<path d="M12 2 2 7l10 5 10-5-10-5Z" fill="black" stroke="none"/><path d="m2 17 10 5 10-5" stroke="black" stroke-width="2"/><path d="m2 12 10 5 10-5" stroke="black" stroke-width="2"/>', 22)}</div>`;
const INPUT = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-primary/50';
// Never filled (like the studios' prompt bar): the main action is outlined with a lime left edge.
const MAIN = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.14] border-l-2 border-l-primary bg-transparent px-6 py-3.5 text-[15px] font-bold text-white hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-35';
const SECOND = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-6 py-3.5 text-[15px] font-bold text-white/80 hover:border-white/20 hover:bg-white/[0.05] hover:text-white';

export const STAGES = Object.freeze([
  { id: 'site', label: 'Capture your website' },
  { id: 'voice', label: 'Add your name to the voice' },
  { id: 'render', label: 'Render your video' },
  { id: 'page', label: 'Build your landing page' },
]);

const WAIT_CARDS = [
  { title: 'Record in your browser', text: 'Camera, screen or both. Nothing to install.', action: 'Open the recorder', href: '#/recorder' },
  { title: 'Find your prospects', text: 'Lead Finder builds the list you send it to.', action: 'Open Lead Finder', href: '#/leadfinder' },
  { title: 'SmartVideo Academy', text: 'Short lessons on personalized video outreach.', action: 'Start learning', href: '#/academy', accent: true },
];

/**
 * mountFirstVideo(host, { name, company, website, make(details, onStage) -> Promise<{ ok, error, link, pageLink }>,
 *   onLater(), onProspects() }) -> { destroy }
 */
export function mountFirstVideo(host, { name = '', company = '', website = '', make, onLater = () => {}, onProspects = () => {} } = {}) {
  const d = { firstName: String(name || ''), company: String(company || ''), website: String(website || '') };
  const root = el('div', 'absolute inset-0 z-40 flex flex-col overflow-y-auto bg-app-bg text-white');
  root.setAttribute('data-outreach-first-video', '');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Your first video');
  const bar = el('div', 'h-[3px] w-full shrink-0 bg-primary');
  const head = el('div', 'grid shrink-0 grid-cols-3 items-center px-6 py-5 md:px-12');
  const body = el('div', 'mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-24 pt-6 md:pt-12');
  root.append(bar, head, body);
  host.appendChild(root);
  let gone = false;

  const header = ({ middle = 'Your first video', later = true } = {}) => {
    head.replaceChildren();
    const logo = el('div', 'flex items-center gap-2.5 justify-self-start');
    logo.innerHTML = `${LOGO}<span class="text-lg font-extrabold tracking-tight">SmartVideo</span>`;
    head.append(logo, el('div', 'justify-self-center text-[13px] text-white/50', middle || ''));
    const right = el('div', 'justify-self-end');
    if (later) {
      const b = el('button', 'rounded-lg px-1 py-1 text-sm text-white/60 hover:text-white', 'Do this later');
      b.type = 'button';
      b.setAttribute('data-first-later', '');
      b.addEventListener('click', () => { destroy(); onLater(); });
      right.appendChild(b);
    }
    head.appendChild(right);
  };

  // ---- 1. Your details -------------------------------------------------------
  function details(error = '') {
    header();
    body.replaceChildren();
    const grid = el('div', 'grid items-start gap-10 lg:grid-cols-[1fr_380px]');
    const left = el('form', 'flex flex-col gap-5');
    left.setAttribute('data-first-details', '');
    left.append(
      el('h1', 'text-3xl font-extrabold tracking-tight md:text-[36px] md:leading-tight', 'See a personalized video made for you'),
      el('p', '-mt-2 text-[15px] text-white/55', 'You are the first prospect. These are the details from the last step. Change them if you want.'),
    );
    const field = (label, key, ph, hint = '') => {
      const w = el('label', 'flex flex-col gap-2');
      w.appendChild(el('span', 'text-[13px] font-semibold text-white/80', label));
      const i = el('input', INPUT);
      i.name = key; i.placeholder = ph; i.value = d[key];
      i.addEventListener('input', () => { d[key] = i.value; paintPreview(); go.disabled = !ready(); });
      w.appendChild(i);
      if (hint) w.appendChild(el('span', 'text-xs text-white/45', hint));
      return w;
    };
    const two = el('div', 'grid gap-4 sm:grid-cols-2');
    two.append(field('First name', 'firstName', 'Your first name'), field('Company', 'company', 'Your company'));
    left.append(two, field('Company website', 'website', 'acme.com', 'This page plays behind you in the video.'));
    if (error) {
      const e = el('p', 'rounded-xl border border-amber-300/30 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-200', error);
      e.setAttribute('data-first-error', '');
      left.appendChild(e);
    }
    const row = el('div', 'flex flex-wrap items-center gap-4 pt-1');
    const go = el('button', MAIN);
    go.type = 'submit';
    go.setAttribute('data-first-make', '');
    go.innerHTML = `<span class="text-primary">${svg(ICON.sparkle, 16)}</span><span>Make my video</span>`;
    go.disabled = !ready();
    row.append(go, el('span', 'text-[13px] text-white/50', 'About 2 minutes. Uses one short speech request on your MuAPI key.'));
    left.appendChild(row);
    left.addEventListener('submit', (e) => { e.preventDefault(); if (ready()) making(); });

    const right = el('div', 'rounded-2xl border border-white/10 bg-white/[0.02] p-6');
    right.appendChild(el('div', 'mb-4 text-[15px] font-bold', 'What you get'));
    const shot = el('div', 'overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]');
    const url = el('div', 'truncate border-b border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/50');
    const stage = el('div', 'relative h-40');
    const bubble = el('div', 'absolute left-1/2 top-5 -translate-x-1/2 rounded-lg bg-black/80 px-3 py-1.5 text-[15px] font-bold text-white ring-1 ring-white/10');
    const face = el('img', 'absolute bottom-4 left-5 h-16 w-16 rounded-full object-cover ring-2 ring-primary/60');
    face.src = SAMPLE_PRESENTER.poster; face.alt = '';
    stage.append(bubble, face);
    shot.append(url, stage);
    right.appendChild(shot);
    const list = el('ul', 'mt-5 flex flex-col gap-2.5 text-[14px] text-white/80');
    ['A video that says your name', 'Your website as the background', 'A landing page with a call to action'].forEach((t) => {
      const li = el('li', 'flex items-center gap-3');
      li.innerHTML = `<span class="text-primary">${svg(ICON.check, 16)}</span>`;
      li.appendChild(el('span', '', t));
      list.appendChild(li);
    });
    right.appendChild(list);
    function paintPreview() {
      url.textContent = normalizeWebsite(d.website) || 'your-website.com';
      bubble.textContent = `Hi ${d.firstName.trim() || 'there'}!`;
    }
    paintPreview();
    grid.append(left, right);
    body.appendChild(grid);
  }
  const ready = () => !!(d.firstName.trim() && d.company.trim() && normalizeWebsite(d.website));

  // ---- 2. Making ----------------------------------------------------------------
  async function making() {
    header();
    body.replaceChildren();
    const wrap = el('div', 'mx-auto flex w-full max-w-3xl flex-col');
    wrap.setAttribute('data-first-making', '');
    const top = el('div', 'flex flex-wrap items-end justify-between gap-3');
    const left = el('div', 'text-[13px] text-white/55', 'Starting\u2026');
    left.setAttribute('data-first-percent', '');
    top.append(el('h1', 'text-3xl font-extrabold tracking-tight md:text-[36px]', 'Making your video'), left);
    const track = el('div', 'mt-6 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]');
    const fill = el('div', 'h-full rounded-full bg-primary transition-all duration-500');
    fill.style.width = '4%';
    track.appendChild(fill);
    const list = el('ul', 'mt-6 flex flex-col gap-3.5');
    const rows = STAGES.map((s) => {
      const li = el('li', 'flex items-center gap-3 text-[15px] text-white/50');
      li.setAttribute('data-first-stage', s.id);
      const dot = el('span', 'grid h-6 w-6 place-items-center rounded-full border-2 border-white/20');
      li.append(dot, el('span', '', s.label));
      list.appendChild(li);
      return { s, li, dot };
    });
    wrap.append(top, track, list);

    wrap.appendChild(el('h2', 'mt-14 text-center text-[17px] font-bold', 'While you wait, get set up to record'));
    const cards = el('div', 'mt-5 grid gap-4 md:grid-cols-3');
    WAIT_CARDS.forEach((c) => {
      const box = el('div', `flex flex-col gap-2 rounded-2xl border p-5 ${c.accent ? 'border-primary/25 bg-primary/[0.06]' : 'border-white/10 bg-white/[0.02]'}`);
      const a = el('a', 'mt-3 self-start rounded-full border border-white/15 px-4 py-2 text-[13px] font-bold text-white/85 hover:border-primary/40 hover:text-white', c.action);
      a.href = c.href; a.target = '_blank'; a.rel = 'noopener';
      box.append(el('div', 'text-[15px] font-bold', c.title), el('p', 'text-[13px] text-white/55', c.text), a);
      cards.appendChild(box);
    });
    wrap.appendChild(cards);
    body.appendChild(wrap);

    // Everything here follows the real work: a stage spins while it runs and is ticked when it is done; the bar and
    // the percentage are the stages done plus how far the current one is (websites captured, names voiced,
    // pictures rendered).
    let at = -1;
    let part = 0;
    const paint = () => {
      rows.forEach((r, i) => {
        const done = i < at;
        const now = i === at;
        r.li.className = `flex items-center gap-3 text-[15px] ${done ? 'text-white/80' : now ? 'font-semibold text-white' : 'text-white/50'}`;
        r.li.setAttribute('data-state', done ? 'done' : now ? 'working' : 'waiting');
        r.dot.className = `grid h-6 w-6 place-items-center rounded-full border-2 ${done ? 'border-primary bg-primary/15 text-primary' : now ? 'animate-spin border-white/15 border-t-primary' : 'border-white/20'}`;
        r.dot.innerHTML = done ? svg(ICON.check, 14) : '';
      });
      const share = at < 0 ? 0 : Math.min(1, (Math.min(at, STAGES.length) + (at < STAGES.length ? part : 0)) / STAGES.length);
      left.textContent = at >= STAGES.length ? 'Done' : at < 0 ? 'Starting\u2026' : `${Math.round(share * 100)}% done`;
      fill.style.width = `${Math.max(3, Math.round(share * 100))}%`;
    };
    paint();
    const onStage = (id, p = 0) => {
      const i = id === 'done' ? STAGES.length : STAGES.findIndex((s) => s.id === id);
      if (i < 0 || i < at) return;
      if (i > at) { at = i; part = 0; }
      part = Math.max(part, Math.min(1, Number(p) || 0));
      paint();
    };
    let res;
    try { res = await make({ ...d, website: normalizeWebsite(d.website) }, onStage); } catch (err) { res = { ok: false, error: err?.message || String(err) }; }
    if (gone) return;
    if (res?.ok) { at = STAGES.length; paint(); setTimeout(() => !gone && done(res), 600); }
    else details(res?.error || 'The video could not be made. Check your details and try again.');
  }

  // ---- 3. Ready ----------------------------------------------------------------
  function done(res) {
    header({ middle: '', later: false });
    body.replaceChildren();
    const grid = el('div', 'grid items-start gap-10 lg:grid-cols-[1fr_380px]');
    grid.setAttribute('data-first-ready', '');
    const player = el('div', 'overflow-hidden rounded-2xl border border-white/10 bg-black');
    const frame = el('iframe', 'aspect-video w-full');
    frame.src = res.embed || res.link || '';
    frame.title = 'Your personalized video';
    frame.allow = 'autoplay; fullscreen';
    frame.setAttribute('allowfullscreen', '');
    player.appendChild(frame);
    const right = el('div', 'flex flex-col gap-4');
    right.append(
      el('h1', 'text-3xl font-extrabold tracking-tight md:text-[36px] md:leading-tight', `${d.firstName.trim() || 'Hi'}, your video is ready`),
      el('p', 'text-[15px] text-white/55', 'This is what each of your prospects gets: their name, their website and your call to action.'),
    );
    if (res.pageLink || res.link) {
      const watch = el('a', `${MAIN} self-start`, 'Watch it on your landing page');
      watch.href = res.pageLink || res.link; watch.target = '_blank'; watch.rel = 'noopener';
      watch.setAttribute('data-first-watch', '');
      right.appendChild(watch);
    }
    const mine = el('button', `${SECOND} self-start`, 'Make one for my prospects');
    mine.type = 'button';
    mine.setAttribute('data-first-prospects', '');
    mine.addEventListener('click', () => { destroy(); onProspects(); });
    right.append(mine, el('p', 'text-[13px] text-white/45', 'Next you record your own intro once. SmartVideo puts it in front of every prospect’s website.'));
    grid.append(player, right);
    body.appendChild(grid);
  }

  function destroy() { gone = true; root.remove(); }
  details();
  return { destroy };
}
