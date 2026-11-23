/** Design 02 (Clean SaaS) extras: a logo strip with an image per logo, and a card grid whose card heading icons are editable. */
import { useTokens } from '../components.jsx';
import { safeImageUrl } from '../../templates.js';
import { ICON_PATHS, ICON_KEYS } from '../../siteIcons.js';

const list = (v) => (Array.isArray(v) ? v : []);
const EXTRA = { quote: 'M4 18v-5c0-4 2-7 6-8M14 18v-5c0-4 2-7 6-8M4 13h6v5H4zM14 13h6v5h-6z' };
const PATHS = { ...ICON_PATHS, ...EXTRA };
const iconField = (n) => ({ type: 'select', label: `Heading icon, card ${n}`, options: [{ label: 'None', value: '' }, ...[...ICON_KEYS, ...Object.keys(EXTRA)].map((k) => ({ label: k, value: k }))] });

/** An icon as a CSS mask image (decorative; the path comes from a fixed icon set, never from user text). */
const maskUrl = (name) => {
  const d = PATHS[name];
  if (!d) return 'none';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

function LeadLogoStrip({ title, logos }) {
  const t = useTokens();
  return (
    <section className="pk-strip pk-strip--logos ld-strip" aria-label={t(title) || 'Trusted by'}>
      {title ? <p className="pk-strip-title">{t(title)}</p> : null}
      <ul className="pk-strip-row">
        {list(logos).map((l, i) => {
          const src = safeImageUrl(l.image) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(l.image || '') ? l.image : '');
          return (
            <li key={i} className="pk-strip-item">
              {src ? <img className="ld-logo-mark" src={src} alt={t(l.imageAlt) || ''} width="30" height="31" loading="lazy" /> : null}
              <span className="pk-logo-word">{t(l.name)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const components = {
  LeadLogoStrip: {
    label: 'Lead: logo strip (with logo images)',
    fields: {
      title: { type: 'text', label: 'Heading' },
      logos: { type: 'array', label: 'Logos', arrayFields: { name: { type: 'text', label: 'Name' }, image: { type: 'text', label: 'Logo mark image (https link or /landing-art path)' }, imageAlt: { type: 'text', label: 'Screen-reader description (alt text)' } }, getItemSummary: (i) => i.name || 'Logo', defaultItemProps: { name: 'Company', image: '' } },
    },
    defaultProps: { title: 'Trusted by growth-focused teams', logos: [{ name: 'Notionly', image: '/landing-art/02/l1.webp' }, { name: 'Cloudway', image: '/landing-art/02/l2.webp' }] },
    render: (p) => <LeadLogoStrip {...p} />,
  },
  LeadCardGrid: {
    label: 'Lead: card grid (editable heading icons)',
    fields: {
      columns: { type: 'select', label: 'Columns on a desktop', options: [2, 3, 4, 5, 6].map((n) => ({ label: `${n}`, value: n })) },
      icon1: iconField(1), icon2: iconField(2), icon3: iconField(3), icon4: iconField(4), icon5: iconField(5), icon6: iconField(6),
      items: { type: 'slot', allow: ['LeadMagnetCard', 'TableCard', 'StatsCard', 'ChecklistCard', 'QuoteCard', 'StepsCard', 'FeaturesCard', 'FaqCard', 'KpiCard', 'ScheduleCard', 'ButtonCard'] },
    },
    defaultProps: { columns: 6, icon1: 'book', icon2: 'users', icon3: 'quote', icon4: 'layers', icon5: 'calendar', icon6: 'chart' },
    render: ({ columns, items: Items, icon1, icon2, icon3, icon4, icon5, icon6 }) => {
      const style = { '--pk-cols': columns };
      [icon1, icon2, icon3, icon4, icon5, icon6].forEach((n, i) => { style[`--lead-ico-${i + 1}`] = maskUrl(n); });
      return <section className="pk-grid ld-grid" style={style}><Items className="pk-grid-in" /></section>;
    },
  },
};
