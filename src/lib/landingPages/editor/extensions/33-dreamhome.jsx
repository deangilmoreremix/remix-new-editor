/**
 * Dream home hero page extras: hero (headline over a photo, video card with caption, form card with a second button),
 * icon feature strip, testimonial cards with portraits and a CTA band with a laptop picture. Every visible string is a
 * field; images are decorative artwork picked by path. All sample copy.
 */
import { AccentText, VideoPlayer, LeadForm, Icon, SafeLink, useTokens } from '../components.jsx';
import { slotFields, SLOT_DEFAULTS } from '../slotFields.js';
import { safeImageUrl } from '../../templates.js';

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const asList = (v) => (Array.isArray(v) ? v : []);
const art = (v) => safeImageUrl(v) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(v || '')) ? String(v) : '');
const cssImage = (v) => { const u = art(v); return u && !/["'()\\\s<>]/.test(u) ? `url(${JSON.stringify(u)})` : ''; };
const FORM_FIELDS = [{ key: 'name', label: 'Your Name', type: 'text', required: true }, { key: 'email', label: 'Your Email Address', type: 'email', required: true }];

function DreamHero(p) {
  const t = useTokens();
  const fields = asList(p.formFields).filter((f) => f.key && f.label).map((f) => ({ ...f, key: String(f.key).replace(/[^a-z0-9_]/gi, '').toLowerCase() }));
  const bg = cssImage(p.background);
  return (
    <header className="pk-hero dh-hero" id="top" style={bg ? { '--dh-bg': bg } : undefined}>
      <div className="dh-copy">
        <AccentText as="h1" className="pk-headline dh-headline" text={p.headline} />
        {p.subhead ? <p className="pk-subhead dh-sub">{t(p.subhead)}</p> : null}
      </div>
      <div className="pk-hero-video dh-video" id="video">
        <VideoPlayer poster={p.photo} slotImage={p.slotImage} slotVideo={p.slotVideo} bakedPlay={p.bakedPlay} />
        {p.chip ? <div className="pk-chip dh-chip">{t(p.chip)}</div> : null}
      </div>
      <div className="pk-hero-form dh-form" id="lead">
        <LeadForm title={p.formTitle} subtitle={p.formSubtitle} submitLabel={p.submitLabel} privacy={p.privacy} fields={fields.length ? fields : undefined} />
        {asList(p.buttons).length ? (
          <div className="dh-or">
            {p.orLabel ? <span className="dh-or-line">{t(p.orLabel)}</span> : null}
            {asList(p.buttons).map((b, i) => <SafeLink key={i} className="dh-alt" href={b.url}><Icon name="calendar" className="pk-ico" />{t(b.label)}</SafeLink>)}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function DreamFeatures({ items }) {
  const t = useTokens();
  return (
    <section className="dh-features" id="features" aria-label="Features">
      <ul>
        {asList(items).map((it, i) => (
          <li key={i}>
            {art(it.image) ? <img src={art(it.image)} alt="" /> : null}
            <span>{t(it.text)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DreamProof({ title, quotes }) {
  const t = useTokens();
  return (
    <section className="dh-proof" id="proof">
      {title ? <h2 className="dh-proof-title">{t(title)}</h2> : null}
      <div className="dh-proof-grid">
        {asList(quotes).map((q, i) => {
          const n = Math.max(0, Math.min(5, Number(q.stars) || 0));
          return (
            <figure key={i} className="dh-quote">
              {art(q.photo) ? <img className="dh-avatar" src={art(q.photo)} alt="" width="84" height="84" /> : <i className="dh-avatar dh-avatar--blank">{String(q.name || '?').slice(0, 1).toUpperCase()}</i>}
              <div className="dh-quote-body">
                <blockquote>{`“${t(q.text)}”`}</blockquote>
                <figcaption><b>{t(q.name)}</b><small>{t(q.role)}</small></figcaption>
                {n ? <span className="dh-stars" role="img" aria-label={`${n} out of 5 stars`}>{'★'.repeat(n)}</span> : null}
              </div>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

function DreamCta({ title, text, buttonLabel, buttonUrl, image }) {
  const t = useTokens();
  return (
    <section className="dh-cta" id="cta">
      <div className="dh-cta-copy">
        <h2>{t(title)}</h2>
        {text ? <p>{t(text)}</p> : null}
        {buttonLabel ? <SafeLink className="dh-cta-btn" href={buttonUrl || '#lead'}>{t(buttonLabel)}<Icon name="arrow" className="pk-ico" /></SafeLink> : null}
      </div>
      {art(image) ? <img className="dh-cta-art" src={art(image)} alt="" /> : null}
    </section>
  );
}

const arr = (label, arrayFields, def, sum) => ({ type: 'array', label, arrayFields, defaultItemProps: def, getItemSummary: (i) => i[sum] || 'Item' });

export const components = {
  DreamhomeHero: {
    label: 'Dream home hero (headline, video, form)',
    fields: {
      headline: A('Headline (wrap words in [[double brackets]] to highlight)'),
      subhead: A('Sub-headline'),
      background: T('Background photo (path or https image)'),
      chip: T('Caption on the video'),
      photo: T('Placeholder image before the video plays'),
      ...slotFields(),
      formTitle: T('Form title'),
      formSubtitle: A('Form text'),
      formFields: arr('Form fields', { key: T('Field name (a-z)'), label: T('Label / placeholder'), type: { type: 'select', label: 'Type', options: ['text', 'email', 'tel'].map((v) => ({ label: v, value: v })) }, required: { type: 'radio', label: 'Required', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } }, { key: 'field', label: 'Field', type: 'text', required: false }, 'label'),
      submitLabel: T('Form button text'),
      privacy: T('Line under the form button'),
      orLabel: T('Word between button and second button'),
      buttons: arr('Second button(s) in the form', { label: T('Text'), url: T('Link (https, mailto: or #lead)') }, { label: 'Button', url: '' }, 'label'),
    },
    defaultProps: {
      headline: 'Create Personalized Videos That Get Results',
      subhead: 'Record once. Personalize for every prospect. Grow your business with SmartVideo AI.',
      background: '/landing-art/dreamhome/bg.webp',
      chip: 'Your Dream Home is Closer Than You Think',
      ...SLOT_DEFAULTS, photo: '/landing-art/dreamhome/poster.webp',
      formTitle: 'Get Your Free Personalized Video',
      formSubtitle: 'Enter your name and email to see how easy it is to create stunning, personalized videos.',
      formFields: FORM_FIELDS, submitLabel: 'Watch My Video', privacy: '',
      orLabel: 'or', buttons: [{ label: 'Book a Demo', url: 'mailto:hello@example.com' }],
    },
    render: (p) => <DreamHero {...p} />,
  },
  DreamhomeFeatures: {
    label: 'Dream home feature strip (4 icons)',
    fields: { items: arr('Features', { image: T('Icon image path'), text: A('Text (new line allowed)') }, { image: '', text: 'New feature' }, 'text') },
    defaultProps: {
      items: [
        { image: '/landing-art/dreamhome/f1.webp', text: 'Personalize\nin Minutes' },
        { image: '/landing-art/dreamhome/f2.webp', text: 'Find & Target\nLocal Leads' },
        { image: '/landing-art/dreamhome/f3.webp', text: 'Track Your\nResults' },
        { image: '/landing-art/dreamhome/f4.webp', text: 'Easy to Use\nNo Tech Skills' },
      ],
    },
    render: (p) => <DreamFeatures {...p} />,
  },
  DreamhomeProof: {
    label: 'Dream home testimonials (sample quotes)',
    fields: {
      title: T('Section title'),
      quotes: arr('Testimonials', { photo: T('Portrait image path'), text: A('Quote'), name: T('Name'), role: T('Role'), stars: { type: 'number', label: 'Stars (0-5)', min: 0, max: 5 } }, { photo: '', text: 'Great tool.', name: 'Name', role: 'Role', stars: 5 }, 'name'),
    },
    defaultProps: {
      title: 'Trusted by Professionals Like You',
      quotes: [
        { photo: '/landing-art/dreamhome/q1.webp', text: 'SmartVideo AI has transformed the way I connect with clients.', name: 'Sarah Mitchell', role: 'Real Estate Agent', stars: 5 },
        { photo: '/landing-art/dreamhome/q2.webp', text: 'I’m getting more leads and closing more deals.', name: 'David Reynolds', role: 'Realtor', stars: 5 },
        { photo: '/landing-art/dreamhome/q3.webp', text: 'Incredible tool. Simple, powerful, and effective!', name: 'Jennifer Clarke', role: 'Real Estate Broker', stars: 5 },
      ],
    },
    render: (p) => <DreamProof {...p} />,
  },
  DreamhomeCta: {
    label: 'Dream home CTA band (laptop picture)',
    fields: { title: T('Title'), text: A('Text'), buttonLabel: T('Button text'), buttonUrl: T('Button link (https, mailto: or #lead)'), image: T('Picture path (laptop)') },
    defaultProps: {
      title: 'Ready to Grow Your Business?',
      text: 'Join thousands of professionals using SmartVideo AI to get more leads and close more deals.',
      buttonLabel: 'Start Free Today', buttonUrl: '#lead', image: '/landing-art/dreamhome/laptop.webp',
    },
    render: (p) => <DreamCta {...p} />,
  },
};
