/** Design 08 (Local business) extras: industry tiles, follow-up flow card, service-area map card, video note and name+email newsletter band. Sample copy only. */
import { useState } from 'react';
import { AccentText, CardShell, Icon, SafeLink, useTokens } from '../components.jsx';
import { usePage, useThanks } from '../context.js';
import { ICON_KEYS } from '../../siteIcons.js';
import { safeImageUrl } from '../../templates.js';

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const list = (v) => (Array.isArray(v) ? v : []);
const cols = { type: 'select', label: 'Width (columns of 4)', options: [1, 2, 3, 4].map((n) => ({ label: `${n}`, value: n })) };
const iconField = { type: 'select', label: 'Icon', options: ICON_KEYS.map((k) => ({ label: k, value: k })) };
const imgField = T('Custom icon image URL (optional, replaces the icon)');
const art = (v) => safeImageUrl(v) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(v || '')) ? String(v) : '');
const Pic = ({ image, icon, className }) => (art(image) ? <img className={className} src={art(image)} alt="" width="56" height="56" /> : <Icon name={icon} className={`${className} lc-svg`} />);
function LocalIndustries({ title, text, tiles, more }) {
  const t = useTokens();
  return (
    <section className="lc-ind" aria-label="Industries">
      <div className="lc-ind-in">
        <div className="lc-ind-intro">
          <AccentText as="h2" className="lc-ind-title" text={title} />
          {text ? <p>{t(text)}</p> : null}
        </div>
        <ul className="lc-tiles">{list(tiles).map((x, i) => <li key={i} className="lc-tile"><Pic image={x.image} icon={x.icon} className="lc-ico" /><span>{t(x.label)}</span></li>)}</ul>
        {more ? <p className="lc-more">{t(more)}</p> : null}
      </div>
    </section>
  );
}

function LocalFlowCard({ columns, title, text, steps }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="lc-flow">
      <h3 className="pk-card-title">{t(title)}</h3>
      {text ? <p className="pk-card-text">{t(text)}</p> : null}
      <ol className="lc-steps">{list(steps).map((s, i) => <li key={i}><Pic image={s.image} icon={s.icon} className="lc-ico" /><span>{t(s.label)}</span></li>)}</ol>
    </CardShell>
  );
}

function LocalMapCard({ columns, title, text }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="lc-map">
      <div className="lc-map-art" role="img" aria-label={t(title)}><h3 className="pk-card-title">{t(title)}</h3></div>
      {text ? <p className="lc-map-text"><Icon name="pin" className="lc-pin" />{t(text)}</p> : null}
    </CardShell>
  );
}

/** Handwritten caption with a hand-drawn arrow; sits next to the video on wide screens. Place it right after the hero. */
function LocalVideoNote({ text }) {
  const t = useTokens();
  return (
    <div className="lc-note-wrap">
      <p className="lc-note">
        <svg className="lc-note-arrow" viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M52 52C28 56 8 44 12 14M3 24l9-12 11 9" /></svg>
        <span>{t(text)}</span>
      </p>
    </div>
  );
}

/** Name + email sign-up that records a lead through the page's lead handler. */
function LocalNewsletter({ title, text, nameLabel, emailLabel, buttonLabel, social, links }) {
  const { handlers, preview } = usePage();
  const t = useTokens();
  const thanks = useThanks();
  const [state, setState] = useState({ status: 'idle', error: '' });
  const onSubmit = async (e) => {
    e.preventDefault();
    if (preview) { setState({ status: 'idle', error: 'Preview only: nothing is sent.' }); return; }
    const fd = new FormData(e.currentTarget);
    setState({ status: 'sending', error: '' });
    const res = await (handlers.onLead?.({ name: String(fd.get('name') || ''), email: String(fd.get('email') || ''), message: `Signed up: ${title}` }) ?? { error: 'Form is not available' });
    setState(res?.error ? { status: 'idle', error: 'Could not send. Please try again.' } : { status: 'done', error: '' });
  };
  const ls = list(links).filter((l) => l.label);
  return (
    <section className="lc-news">
      <div className="lc-news-in">
        <div className="lc-news-text"><b>{t(title)}</b>{text ? <span>{t(text)}</span> : null}</div>
        {state.status === 'done' ? <p className="pk-thanks lc-news-form">{t(thanks) || 'Thanks!'}</p> : (
          <form className="lc-news-form" onSubmit={onSubmit}>
            <label><span className="pk-sr">Name</span><input name="name" type="text" required maxLength={120} placeholder={t(nameLabel)} autoComplete="name" /></label>
            <label><span className="pk-sr">Email</span><input name="email" type="email" required maxLength={200} placeholder={t(emailLabel)} autoComplete="email" /></label>
            <button type="submit" className="pk-btn pk-btn--primary" disabled={state.status === 'sending'}>{t(buttonLabel)}</button>
            <span className="pk-status" role="status">{state.error}</span>
          </form>
        )}
        <div className="lc-news-cta">
          {social ? <p className="lc-news-social">{t(social)}</p> : null}
          {ls.length ? <p className="lc-news-links">{ls.map((l, i) => <span key={i}>{i ? ' or ' : ''}{l.url ? <SafeLink href={l.url}>{t(l.label)} &rarr;</SafeLink> : t(l.label)}</span>)}</p> : null}
        </div>
      </div>
    </section>
  );
}

const TILES = [['Home Services', 'home', 't1'], ['Pet Care', 'leaf', 't2'], ['Health & Wellness', 'heart', 't3'], ['Salons & Spas', 'sparkles', 't4'], ['Restaurants & Cafés', 'cutlery', 't5'], ['Local Retail', 'tag', 't6'], ['Auto Services', 'car', 't7']];
const STEPS = [['Collect Leads', 'filter', 's1'], ['Send a Personalized Video', 'play', 's2'], ['Follow Up Automatically', 'mail', 's3'], ['Get Bookings & More Customers', 'calendar', 's4']];
const art8 = (k) => `/landing-art/08/${k}.webp`;

export const components = {
  LocalIndustries: {
    label: 'Local: industry tiles',
    fields: { title: A('Heading ([[double brackets]] underline words)'), text: A('Text'), tiles: { type: 'array', label: 'Tiles', arrayFields: { label: T('Label'), icon: iconField, image: imgField }, getItemSummary: (i) => i.label || 'Tile', defaultItemProps: { label: 'Industry', icon: 'star', image: '' } }, more: A('Handwritten note at the end') },
    defaultProps: {
      title: 'Built for\nLocal & [[Service]]\nBusinesses', text: 'A simple, powerful way to connect with more people in your area.',
      tiles: TILES.map(([label, icon, k]) => ({ label, icon, image: art8(k) })), more: 'And many more!',
    },
    render: (p) => <LocalIndustries {...p} />,
  },
  LocalFlowCard: {
    label: 'Local: follow-up flow card',
    fields: { columns: cols, title: A('Title'), text: A('Text'), steps: { type: 'array', label: 'Steps', arrayFields: { label: T('Label'), icon: iconField, image: imgField }, getItemSummary: (i) => i.label || 'Step', defaultItemProps: { label: 'Step', icon: 'check', image: '' } } },
    defaultProps: { columns: 1, title: 'Automatic Follow-Up\nThat Keeps Leads Moving', text: 'Turn new leads into paying customers with simple, automated video follow-ups.', steps: STEPS.map(([label, icon, k]) => ({ label, icon, image: art8(k) })) },
    render: (p) => <LocalFlowCard {...p} />,
  },
  LocalMapCard: {
    label: 'Local: service-area map card',
    fields: { columns: cols, title: T('Title'), text: A('Text under the map') },
    defaultProps: { columns: 1, title: 'Serving Your Local Community', text: 'Proudly serving Riverside, Maple Grove, Oak Hill, Pinecrest, Lakeside, and nearby areas!' },
    render: (p) => <LocalMapCard {...p} />,
  },
  LocalVideoNote: {
    label: 'Local: handwritten video caption',
    fields: { text: A('Caption') },
    defaultProps: { text: 'See a personalized\nvideo in action!' },
    render: (p) => <LocalVideoNote {...p} />,
  },
  LocalNewsletter: {
    label: 'Local: newsletter band (name + email)',
    fields: {
      title: T('Title'), text: A('Text'), nameLabel: T('Name placeholder'), emailLabel: T('Email placeholder'), buttonLabel: T('Button label'), social: A('Right-side text'),
      links: { type: 'array', label: 'Links', arrayFields: { label: T('Label'), url: T('Link (https://, #lead...)') }, getItemSummary: (i) => i.label || 'Link', defaultItemProps: { label: 'Link', url: '#lead' } },
    },
    defaultProps: {
      title: 'Get Local Business Tips & Lead-Generation Ideas', text: 'Join our list for practical video marketing tips, local business growth strategies, and product updates.',
      nameLabel: 'Your Name', emailLabel: 'Your Email', buttonLabel: 'Sign Me Up', social: 'Ready to grow your business\nwith personalized video?',
      links: [{ label: 'Request a Demo', url: '#lead' }, { label: 'Schedule a Consultation', url: '#lead' }],
    },
    render: (p) => <LocalNewsletter {...p} />,
  },
};
