/** Design 05 (Playful sunshine) extras: hero with an editable "or" divider, steps title with highlight markers,
 *  a leads card with an "Add contacts" button, and a card grid that accepts them. */
import { useState } from 'react';
import { useTokens, AccentText, VideoPlayer, LeadForm, SafeLink, CardShell } from '../components.jsx';

const list = (v) => (Array.isArray(v) ? v : []);
const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const cols = { type: 'select', label: 'Width (grid columns)', options: [1, 2, 3, 4, 5, 6].map((n) => ({ label: `${n}`, value: n })) };
const buttonArray = { type: 'array', label: 'Buttons', arrayFields: { label: T('Text'), url: T('Link (https, mailto: or tel:, #lead)'), style: { type: 'radio', label: 'Style', options: [{ label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }] } }, getItemSummary: (i) => i.label || 'Button', defaultItemProps: { label: 'Button', url: '', style: 'secondary' } };
const formFieldArray = { type: 'array', label: 'Form fields', arrayFields: { key: T('Field name (a-z)'), label: T('Label / placeholder'), type: { type: 'select', label: 'Type', options: ['text', 'email', 'tel', 'textarea', 'select'].map((v) => ({ label: v === 'select' ? 'dropdown' : v, value: v })) }, options: T('Dropdown choices (comma separated)'), required: { type: 'radio', label: 'Required', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } }, getItemSummary: (i) => i.label || 'Field', defaultItemProps: { key: 'name', label: 'Name', type: 'text', required: true } };

function SparkHero({ eyebrow, headline, subhead, bullets, buttons, orText, chip, photo, formTitle, formSubtitle, formFields, submitLabel, privacy }) {
  const t = useTokens();
  const [playing, setPlaying] = useState(false);
  const fields = list(formFields).filter((f) => f.key && f.label).map((f) => ({ ...f, key: String(f.key).replace(/[^a-z0-9_]/gi, '').toLowerCase() }));
  return (
    <header className="pk-hero pk-hero--copy-video-form pk-hero--spark" id="top">
      <div className="pk-hero-copy">
        {eyebrow ? <span className="pk-eyebrow">{t(eyebrow)}</span> : null}
        <AccentText as="h1" className="pk-headline" text={headline} />
        {subhead ? <p className="pk-subhead">{t(subhead)}</p> : null}
        {list(bullets).length ? <ul className="pk-bullets">{list(bullets).map((b, i) => <li key={i}>{t(b.text)}</li>)}</ul> : null}
        {list(buttons).length ? (
          <div className="pk-actions">
            {orText ? <span className="pk-or">{t(orText)}</span> : null}
            {list(buttons).map((b, i) => <SafeLink key={i} className={`pk-btn pk-btn--${b.style === 'primary' ? 'primary' : 'secondary'}`} href={b.url}>{t(b.label)}</SafeLink>)}
          </div>
        ) : null}
      </div>
      <div className={`pk-hero-video${playing ? ' is-playing' : ''}`} id="video" onPlayCapture={() => setPlaying(true)} onPauseCapture={() => setPlaying(false)} onEndedCapture={() => setPlaying(false)}>
        <VideoPlayer poster={photo} />
        <span className="pk-playbtn" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#fb3f4e" /><path d="M25 18 L48 32 L25 46Z" fill="#fff" /></svg></span>
        <svg className="pk-sticker-arrow" viewBox="0 0 80 50" aria-hidden="true"><path d="M4 6 C30 2 62 8 68 38" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" /><path d="M58 32 L69 42 L73 27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {chip ? <div className="pk-chip">{t(chip)}</div> : null}
      </div>
      <div className="pk-hero-form" id="lead"><LeadForm title={formTitle} subtitle={formSubtitle} submitLabel={submitLabel} privacy={privacy} fields={fields.length ? fields : undefined} /></div>
    </header>
  );
}

function SparkSteps({ columns, title, items }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="pk-card--steps pk-steps--row">
      {title ? <AccentText as="h3" className="pk-card-title" text={title} /> : null}
      <ol className="pk-steps">{list(items).map((it, i) => <li key={i}><span className="pk-step-n">{i + 1}</span><b>{t(it.title)}</b>{it.text ? <span>{t(it.text)}</span> : null}</li>)}</ol>
    </CardShell>
  );
}

function SparkLeads({ columns, title, rows, buttonLabel, buttonUrl }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="pk-card--table pk-card--leads">
      {title ? <h3 className="pk-card-title">{t(title)}</h3> : null}
      <div className="pk-table" role="table">
        {list(rows).map((r, i) => (
          <div key={i} className="pk-tr" role="row">
            <span className="pk-td-who"><i className="pk-dot">{String(r.name || '?').slice(0, 1).toUpperCase()}</i><b>{t(r.name)}</b></span>
            {r.role ? <span>{t(r.role)}</span> : null}
            {r.tag ? <span className="pk-pill">{t(r.tag)}</span> : null}
          </div>
        ))}
      </div>
      {buttonLabel ? <SafeLink className="pk-leads-btn" href={buttonUrl}>{t(buttonLabel)}</SafeLink> : null}
    </CardShell>
  );
}

const ALLOW = ['LeadMagnetCard', 'TableCard', 'StatsCard', 'ChecklistCard', 'QuoteCard', 'StepsCard', 'FeaturesCard', 'FaqCard', 'KpiCard', 'ScheduleCard', 'ButtonCard', 'SparkSteps', 'SparkLeads'];

export const components = {
  SparkHero: {
    label: 'Spark: hero (headline, video with play button, form, "or" divider)',
    fields: {
      eyebrow: T('Small label above the headline'),
      headline: A('Headline (wrap words in [[double brackets]] to highlight)'),
      subhead: A('Sub-headline'),
      bullets: { type: 'array', label: 'Tick list', arrayFields: { text: T('Text') }, getItemSummary: (i) => i.text || 'Item', defaultItemProps: { text: 'New point' } },
      orText: T('Divider text between form and button'),
      buttons: buttonArray,
      chip: T('Sticker on the video'),
      photo: T('Placeholder image before the video plays'),
      formTitle: T('Form title ([[words]] highlighted)'),
      formSubtitle: T('Form subtitle'),
      formFields: formFieldArray,
      submitLabel: T('Form button text'),
      privacy: T('Line under the form button'),
    },
    defaultProps: {
      eyebrow: '', headline: 'Turn Prospects into Fans with Personalized [[Videos!]]', subhead: 'Create and send custom videos at scale.', bullets: [{ text: 'No credit card' }],
      orText: 'or', buttons: [{ label: 'Schedule a Demo', url: '', style: 'secondary' }], chip: 'Personalized for you, {{firstname|there}}!', photo: '',
      formTitle: 'Get Your Own Personalized Video!', formSubtitle: '',
      formFields: [{ key: 'name', label: 'Your Name', type: 'text', required: true }, { key: 'email', label: 'Your Email', type: 'email', required: true }, { key: 'business', label: 'Your Business Type', type: 'select', options: 'Marketing Agency, Real Estate, SaaS, Other', required: false }],
      submitLabel: 'Create My Personalized Video', privacy: '',
    },
    render: (p) => <SparkHero {...p} />,
  },
  SparkGrid: {
    label: 'Spark: card grid (accepts steps and leads cards)',
    fields: { columns: { type: 'select', label: 'Columns on a desktop', options: [2, 3, 4].map((n) => ({ label: `${n}`, value: n })) }, items: { type: 'slot', allow: ALLOW } },
    defaultProps: { columns: 4 },
    render: ({ columns, items: Items }) => <section className="pk-grid" style={{ '--pk-cols': columns }}><Items className="pk-grid-in" /></section>,
  },
  SparkSteps: {
    label: 'Spark card: steps (highlight words in title)',
    fields: { columns: cols, title: T('Title ([[3]] and [[Simple Steps]] are highlighted)'), items: { type: 'array', label: 'Steps', arrayFields: { title: T('Title'), text: A('Text') }, getItemSummary: (i) => i.title || 'Step', defaultItemProps: { title: 'Step', text: '' } } },
    defaultProps: { columns: 2, title: 'Get Started in [[3]] [[Simple Steps]]', items: [{ title: 'Connect & Customize', text: 'Add your brand and message.' }] },
    render: (p) => <SparkSteps {...p} />,
  },
  SparkLeads: {
    label: 'Spark card: leads list with button',
    fields: { columns: cols, title: T('Title'), rows: { type: 'array', label: 'Leads', arrayFields: { name: T('Name'), role: T('Business'), tag: T('Status') }, getItemSummary: (i) => i.name || 'Lead', defaultItemProps: { name: 'Name', role: '', tag: 'Viewed' } }, buttonLabel: T('Button text'), buttonUrl: T('Button link (https, #lead)') },
    defaultProps: { columns: 1, title: 'Your Leads, All in One Place', rows: [{ name: 'Alex M.', role: 'Marketing Agency', tag: 'Viewed' }], buttonLabel: '+ Add Contacts', buttonUrl: '#lead' },
    render: (p) => <SparkLeads {...p} />,
  },
};
