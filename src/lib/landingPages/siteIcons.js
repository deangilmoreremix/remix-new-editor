/** Fixed icon set for site pages: config only ever picks a KEY from this list. */
const SVG_NS = 'http://www.w3.org/2000/svg';

export const ICON_PATHS = Object.freeze({
  video: 'M15 10l5-3v10l-5-3zM3 6h12v12H3z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  bolt: 'M13 2L3 14h8l-1 8 10-12h-8z',
  layers: 'M12 2l10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  check: 'M20 6L9 17l-5-5',
  mail: 'M3 5h18v14H3zM3 7l9 7 9-7',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  star: 'M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z',
  play: 'M7 4l13 8-13 8z',
  filter: 'M3 4h18l-7 8v7l-4 2v-9z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  heart: 'M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  building: 'M4 21V3h10v18M14 9h6v12M8 7h2M8 11h2M8 15h2M4 21h16',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  shield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',
});
export const ICON_KEYS = Object.freeze(Object.keys(ICON_PATHS));

export function icon(doc, key, className = 'vp-ico') {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  const p = doc.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', ICON_PATHS[key] || ICON_PATHS.check);
  svg.appendChild(p);
  return svg;
}

