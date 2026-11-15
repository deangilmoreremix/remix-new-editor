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
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  pin: 'M12 22s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  car: 'M3 15l2-6h14l2 6M3 15v4h3v-2h12v2h3v-4M3 15h18M7.5 15.5h.01M16.5 15.5h.01',
  plane: 'M2 14l20-8-8 20-3-9z',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  dumbbell: 'M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12',
  book: 'M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4zM4 16a4 4 0 0 1 4-4h10',
  tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
  cutlery: 'M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10',
  sparkles: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 3v4M17 5h4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4',
  palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 5-1a9 9 0 0 0-7-12M7.5 11h.01M10 7.5h.01M15 7.5h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  leaf: 'M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19l8-8',
  rocket: 'M5 15c-1 3-1 5-1 5s2 0 5-1M14 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4M9 15l-3-3 5-5c3-3 7-3 9-3 0 2 0 6-3 9l-5 5-3-3z',
  phone: 'M7 2h10v20H7zM11 18h2',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2',
  handshake: 'M2 12l5-4 4 2 4-2 5 4-8 8zM7 8l4 4M13 12l3 3',
  facebook: 'M15 3h-2a4 4 0 0 0-4 4v3H6v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z',
  instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM17.5 6.5h.01',
  youtube: 'M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM10 9l5 3-5 3z',
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

