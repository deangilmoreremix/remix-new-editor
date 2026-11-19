// src/lib/tours/registry.js
// Every guided tour, keyed by id, and the route -> tour lookup. A tour is { id, route, version, steps:[{ target, title,
// body, side?, align?, sidebar?, wait?, learnMore? }] }; `target` is a selector, a list of fallback selectors, a
// function, or null (a centred step). Bump `version` to show a changed tour again to people who saw the old one.
import shell from './defs/shell.js';
import home from './defs/home.js';
import image from './defs/image.js';
import video from './defs/video.js';
import agents from './defs/agents.js';
import mywork from './defs/mywork.js';
import more from './defs/more.js';

export const TOUR_LIST = Object.freeze([...shell, ...home, ...image, ...video, ...agents, ...mywork, ...more]);
export const TOURS = Object.freeze(Object.fromEntries(TOUR_LIST.map((t) => [t.id, t])));

// Routes that show another route's page.
const ALIASES = { 'video-agent-studio': 'video-agent', 'zackd-studio': 'zackd', cinegen: 'workbench', 'timeline-classic': 'timeline' };

/** 'image?x=1' / '#/academy/track/x' -> the route id a tour is keyed by ('' when none). */
export function routeId(page) {
  const p = String(page || '').replace(/^#?\/?/, '').split('?')[0];
  if (!p || p.startsWith('template/')) return '';
  const base = p === 'academy' || p.startsWith('academy/') ? 'academy' : p;
  return ALIASES[base] || base;
}

export const shellTour = () => TOURS.app;
/** The tour for a page, or null. The shell tour is not a page tour. */
export function tourForPage(page) {
  const id = routeId(page);
  return id && id !== 'app' ? TOURS[id] || null : null;
}
