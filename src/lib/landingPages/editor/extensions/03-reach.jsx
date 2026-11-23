/**
 * Design 03 (Bold red outreach) extras: trust bar with leaf laurels, handwritten side note with arrow,
 * and a card grid whose cards can highlight words ([[like this]]) in their titles, play icon on the book
 * cover and a testimonial carousel with arrows and dots. Every visible string is a field.
 */
import { useRef, useState } from 'react';
import { useTokens, AccentText, CardShell, Icon, EmailSignup } from '../components.jsx';
import { safeImageUrl } from '../../templates.js';

const list = (v) => (Array.isArray(v) ? v : []);
const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const art = (src) => safeImageUrl(src) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(src || '')) ? src : '');
const cols = { type: 'select', label: 'Columns it spans', options: [1, 2, 3].map((n) => ({ label: `${n}`, value: n })) };

/** One laurel half: a curved stem with real leaf shapes. */
function LaurelHalf() {
  const leaves = [[5, 30, -35], [4, 24, -20], [3, 18, -5], [3, 12, 10], [4, 6, 25]];
  return (
    <svg className="rc-laurel-svg" viewBox="0 0 24 40" aria-hidden="true" focusable="false">
      <path d="M19 38 C 8 32 4 18 9 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {leaves.map(([x, y, r], i) => (
        <path key={`o${i}`} d="M0 0 C 3 -3 7 -3 10 0 C 7 3 3 3 0 0 Z" fill="currentColor" transform={`translate(${x + 7} ${34 - i * 7.6}) rotate(${-120 + i * 12 + r * 0.2 - 30})`} />
      ))}
      {leaves.map(([x, y, r], i) => (
        <path key={`i${i}`} d="M0 0 C 2.4 -2.4 5.6 -2.4 8 0 C 5.6 2.4 2.4 2.4 0 0 Z" fill="currentColor" transform={`translate(${x + 10} ${32 - i * 7.2}) rotate(${-40 + i * 6 - r * 0.2})`} />
      ))}
    </svg>
  );
}

function ReachTrustBar({ title, logos, badges }) {
  const t = useTokens();
  return (
    <section className="rc-trust" aria-label={t(title) || 'Trusted by'}>
      <p className="rc-trust-title">{t(title)}</p>
      <ul className="rc-trust-logos">{list(logos).map((l, i) => <li key={i} className="rc-logo">{t(l.name)}</li>)}</ul>
      <ul className="rc-trust-badges">
        {list(badges).map((b, i) => (
          <li key={i} className="rc-laurel"><span className="rc-laurel-l"><LaurelHalf /></span><span className="rc-laurel-t"><b>{t(b.value)}</b><small>{t(b.label)}</small></span><span className="rc-laurel-r"><LaurelHalf /></span></li>
        ))}
      </ul>
    </section>
  );
}

/** Handwritten note with a curved arrow pointing at the form. */
function ReachSideNote({ text }) {
  const t = useTokens();
  return (
    <div className="rc-note-wrap">
      <p className="rc-note">
        <span className="rc-note-text">{t(text)}</span>
        <svg className="rc-note-arrow" viewBox="0 0 90 50" aria-hidden="true" focusable="false">
          <path d="M86 40 C 62 50 30 44 10 22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M22 20 L 8 21 L 14 34" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </p>
    </div>
  );
}

function PlayGlyph() {
  return <svg className="rc-play" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><circle cx="20" cy="20" r="18" fill="#fff" /><path d="M16 12.5 L 29 20 L 16 27.5 Z" fill="#c81a1a" /></svg>;
}

function ReachMagnetCard({ columns, tag, title, cover, text, placeholder, buttonLabel }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="pk-card--magnet">
      <div className="pk-book" aria-hidden="true"><b>{t(cover || title)}</b><PlayGlyph /></div>
      <div className="pk-magnet-body">
        {tag ? <span className="pk-tag">{t(tag)}</span> : null}
        <h3 className="pk-card-title"><AccentText text={title} /></h3>
        {text ? <p className="pk-card-text">{t(text)}</p> : null}
        <EmailSignup placeholder={placeholder} label={buttonLabel || 'Send it to me'} source={title} />
      </div>
    </CardShell>
  );
}

function ReachFeaturesCard({ columns, title, items }) {
  const t = useTokens();
  return (
    <CardShell columns={columns}>
      {title ? <h3 className="pk-card-title"><AccentText text={title} /></h3> : null}
      <ul className="pk-feats">{list(items).map((it, i) => <li key={i}><Icon name={it.icon || 'check'} className="pk-ico pk-ico--lg" /><span><b>{t(it.title)}</b>{it.text ? <small>{t(it.text)}</small> : null}</span></li>)}</ul>
    </CardShell>
  );
}

function ReachStatsCard({ columns, title, items }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="pk-card--stats">
      {title ? <h3 className="pk-card-title"><AccentText text={title} /></h3> : null}
      <div className="pk-stats">{list(items).map((it, i) => <div key={i} className="pk-stat">{it.icon ? <Icon name={it.icon} /> : null}<b>{t(it.value)}</b><span>{t(it.label)}</span></div>)}</div>
    </CardShell>
  );
}

function ReachQuotesCard({ columns, heading, quotes, prevLabel, nextLabel }) {
  const t = useTokens();
  const track = useRef(null);
  const [page, setPage] = useState(0);
  const qs = list(quotes);
  const go = (dir) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };
  const onScroll = (e) => {
    const el = e.currentTarget;
    const w = el.scrollWidth / Math.max(1, qs.length);
    setPage(Math.min(qs.length - 1, Math.round(el.scrollLeft / w)));
  };
  return (
    <CardShell columns={columns} className="pk-card--quotes rc-quotes">
      {heading ? <h3 className="pk-card-title"><AccentText text={heading} /></h3> : null}
      <div className="rc-q-stage">
        <button type="button" className="rc-q-arrow rc-q-prev" onClick={() => go(-1)} aria-label={t(prevLabel) || 'Previous testimonials'}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M8 1.5 3.5 6 8 10.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <div className="rc-q-track" ref={track} onScroll={onScroll}>
          {qs.map((q, i) => (
            <figure key={i} className="pk-quote">
              <blockquote>{`“${t(q.text)}”`}</blockquote>
              <figcaption>
                {art(q.avatar) ? <img className="pk-avatar" src={art(q.avatar)} alt={t(q.avatarAlt) || ''} loading="lazy" width="38" height="38" /> : <i className="pk-dot pk-dot--lg">{String(q.name || '?').slice(0, 1).toUpperCase()}</i>}
                <span><b>{t(q.name)}</b><small>{t(q.role)}</small></span>
              </figcaption>
            </figure>
          ))}
        </div>
        <button type="button" className="rc-q-arrow rc-q-next" onClick={() => go(1)} aria-label={t(nextLabel) || 'Next testimonials'}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 1.5 8.5 6 4 10.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </div>
      <div className="rc-q-dots" aria-hidden="true">{qs.map((_, i) => <i key={i} className={i === page ? 'on' : ''} />)}</div>
    </CardShell>
  );
}

const ALLOW = ['ReachMagnetCard', 'ReachFeaturesCard', 'ReachStatsCard', 'ReachQuotesCard', 'LeadMagnetCard', 'TableCard', 'StatsCard', 'ChecklistCard', 'QuoteCard', 'StepsCard', 'FeaturesCard', 'FaqCard', 'KpiCard', 'ScheduleCard', 'ButtonCard'];
export const components = {
  ReachTrustBar: {
    label: 'Reach: trust bar (logos and rating laurels)',
    fields: {
      title: T('Heading'),
      logos: { type: 'array', label: 'Company names', arrayFields: { name: T('Name') }, getItemSummary: (i) => i.name || 'Logo', defaultItemProps: { name: 'Company' } },
      badges: { type: 'array', label: 'Rating badges', arrayFields: { value: T('Number'), label: T('Label') }, getItemSummary: (i) => i.value || 'Badge', defaultItemProps: { value: '4.9/5', label: 'Customer Rating' } },
    },
    defaultProps: { title: 'Trusted by Growth-Focused Teams', logos: [{ name: 'HubSpot' }, { name: 'salesforce' }, { name: 'pipedrive' }], badges: [{ value: '4.9/5', label: 'Customer Rating' }] },
    render: (p) => <ReachTrustBar {...p} />,
  },
  ReachSideNote: {
    label: 'Reach: handwritten side note with arrow',
    fields: { text: A('Note text') },
    defaultProps: { text: 'See it in action - get a custom demo today!' },
    render: (p) => <ReachSideNote {...p} />,
  },
  ReachGrid: {
    label: 'Reach: card grid (accepts highlight cards)',
    fields: { columns: { type: 'select', label: 'Columns on a desktop', options: [2, 3, 4].map((n) => ({ label: `${n}`, value: n })) }, items: { type: 'slot', allow: ALLOW } },
    defaultProps: { columns: 3 },
    render: ({ columns, items: Items }) => <section className="pk-grid" style={{ '--pk-cols': columns }}><Items className="pk-grid-in" /></section>,
  },
  ReachMagnetCard: {
    label: 'Reach card: download card with play-icon book',
    fields: { columns: cols, tag: T('Small label'), title: T('Title ([[words]] highlighted)'), cover: T('Text on the book cover'), text: A('Text'), placeholder: T('Email box hint'), buttonLabel: T('Button text') },
    defaultProps: { columns: 1, tag: 'FREE LEAD MAGNET', title: 'Get the Personalized Video Playbook', cover: 'The Personalized Video Playbook', text: 'A step-by-step guide.', placeholder: 'Enter your email address', buttonLabel: 'Get the Free Guide' },
    render: (p) => <ReachMagnetCard {...p} />,
  },
  ReachFeaturesCard: {
    label: 'Reach card: feature list (highlight words in title)',
    fields: { columns: cols, title: T('Title ([[words]] highlighted)'), items: { type: 'array', label: 'Features', arrayFields: { icon: T('Icon name'), title: T('Title'), text: T('Text') }, getItemSummary: (i) => i.title || 'Feature', defaultItemProps: { icon: 'check', title: 'Feature', text: '' } } },
    defaultProps: { columns: 1, title: 'Why [[VideoReach]] Drives More Leads', items: [{ icon: 'video', title: 'Personalized video', text: 'One-to-one videos.' }] },
    render: (p) => <ReachFeaturesCard {...p} />,
  },
  ReachStatsCard: {
    label: 'Reach card: big numbers (highlight words in title)',
    fields: { columns: cols, title: T('Title ([[words]] highlighted)'), items: { type: 'array', label: 'Numbers', arrayFields: { value: T('Number'), label: T('Label'), icon: T('Icon name') }, getItemSummary: (i) => i.value || 'Number', defaultItemProps: { value: '0%', label: 'Label', icon: '' } } },
    defaultProps: { columns: 1, title: 'Real results', items: [{ value: '3.4x', label: 'Higher Response Rate', icon: 'arrow' }] },
    render: (p) => <ReachStatsCard {...p} />,
  },
  ReachQuotesCard: {
    label: 'Reach card: testimonial carousel (arrows and dots)',
    fields: { columns: cols, heading: T('Heading ([[words]] highlighted)'), prevLabel: T('Screen-reader name of the left arrow'), nextLabel: T('Screen-reader name of the right arrow'), quotes: { type: 'array', label: 'Testimonials', arrayFields: { text: A('Quote'), name: T('Name'), role: T('Role / company'), avatar: T('Photo (https link or /landing-art/ path)'), avatarAlt: T('Screen-reader description (alt text)') }, getItemSummary: (i) => i.name || 'Quote', defaultItemProps: { text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company', avatar: '' } } },
    defaultProps: { columns: 1, heading: 'What Our Customers Are Saying', prevLabel: 'Previous testimonials', nextLabel: 'Next testimonials', quotes: [{ text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company', avatar: '' }] },
    render: (p) => <ReachQuotesCard {...p} />,
  },
};
