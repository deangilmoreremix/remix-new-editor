/**
 * Luxury concierge extras: testimonials with portraits, a numbered onboarding row, and photo resource cards.
 * Every visible string is a field; images only render from safe https links or the bundled /landing-art/ crops.
 */
import { useTokens, SafeLink, AccentText, VideoPlayer, LeadForm, EmailSignup } from '../components.jsx';
import { safeImageUrl } from '../../templates.js';

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const asList = (v) => (Array.isArray(v) ? v : []);
const art = (src) => safeImageUrl(src) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(src || '')) ? src : '');
const anchor = (u) => /^#[a-z0-9_-]{1,40}$/i.test(String(u || '').trim());

function Cta({ url, className, children }) {
  if (anchor(url)) return <a className={className} href={String(url).trim()}>{children}</a>;
  return <SafeLink className={className} href={url}>{children}</SafeLink>;
}


const ICONS = {
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 19h14',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  arrow: 'M5 12h14m-5-5l5 5-5 5',
};
function Ico({ name }) {
  return <svg className="ps-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}

function PersonaHero({ eyebrow, headline, subhead, bullets, buttonLabel, buttonUrl, chipText, chipScript, photo, formTitle, formSubtitle, formFields, submitLabel, privacy }) {
  const t = useTokens();
  const fields = asList(formFields).filter((f) => f.key && f.label).map((f) => ({ ...f, key: String(f.key).replace(/[^a-z0-9_]/gi, '').toLowerCase() }));
  return (
    <header className="pk-hero pk-hero--video-copy-form" id="top">
      <div className="pk-hero-copy">
        {eyebrow ? <span className="pk-eyebrow">{t(eyebrow)}</span> : null}
        <AccentText as="h1" className="pk-headline" text={headline} />
        {subhead ? <p className="pk-subhead">{t(subhead)}</p> : null}
        {asList(bullets).length ? <ul className="pk-bullets">{asList(bullets).map((b, i) => <li key={i}>{t(b.text)}</li>)}</ul> : null}
        {buttonLabel ? <div className="pk-actions"><Cta url={buttonUrl || '#lead'} className="pk-btn pk-btn--primary">{t(buttonLabel)}</Cta></div> : null}
      </div>
      <div className="pk-hero-video" id="video">
        <VideoPlayer poster={photo} />
        {chipText || chipScript ? <div className="pk-chip">{chipText ? <span>{t(chipText)} </span> : null}{chipScript ? <span className="ps-script">{t(chipScript)}</span> : null}</div> : null}
      </div>
      <div className="pk-hero-form" id="lead"><LeadForm title={formTitle} subtitle={formSubtitle} submitLabel={submitLabel} privacy={privacy} fields={fields.length ? fields : undefined} /></div>
    </header>
  );
}

function PersonaLogos({ title, items }) {
  const t = useTokens();
  return (
    <section className="pk-strip pk-strip--logos ps-logos">
      {title ? <p className="pk-strip-title">{t(title)}</p> : null}
      <ul className="pk-strip-row">
        {asList(items).map((it, i) => (
          <li key={i} className="pk-strip-item">
            <span className="pk-logo-word">{t(it.name)}</span>
            {it.subline ? <small className="ps-logo-sub">{t(it.subline)}</small> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PersonaTestimonials({ eyebrow, title, quotes }) {
  const t = useTokens();
  return (
    <section className="ps-quotes" aria-label={t(title)}>
      <div className="ps-quotes-head">
        {eyebrow ? <span className="ps-eyebrow">{t(eyebrow)}</span> : null}
        <h2 className="ps-h2">{t(title)}</h2>
        <span className="ps-arrows" aria-hidden="true"><i>&lsaquo;</i><i>&rsaquo;</i></span>
      </div>
      {asList(quotes).map((q, i) => {
        const img = art(q.photo);
        return (
          <figure key={i} className="ps-quote">
            {img ? <img src={img} alt="" width="87" height="87" loading="lazy" /> : null}
            <div>
              <blockquote>{`“${t(q.text)}”`}</blockquote>
              <figcaption><b>{t(q.name)}</b><span>{t(q.role)}</span></figcaption>
            </div>
          </figure>
        );
      })}
    </section>
  );
}

function PersonaSteps({ eyebrow, title, steps }) {
  const t = useTokens();
  return (
    <section className="ps-steps" aria-label={t(title)}>
      <div className="ps-steps-head">
        {eyebrow ? <span className="ps-eyebrow">{t(eyebrow)}</span> : null}
        <h2 className="ps-h2 ps-h2--lg">{t(title)}</h2>
      </div>
      <ol className="ps-steps-row">
        {asList(steps).map((s, i) => {
          const img = art(s.icon);
          return (
            <li key={i}>
              {img ? <img className="ps-step-ico" src={img} alt="" loading="lazy" /> : null}
              <span className="ps-step-body">
                <b><i className="ps-num">{i + 1}</i>{t(s.title)}</b>
                <span>{t(s.text)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PersonaResources({ cards }) {
  const t = useTokens();
  return (
    <section className="ps-cards" id="contact">
      {asList(cards).map((c, i) => {
        const img = art(c.image);
        const signup = c.action === 'signup';
        return (
          <article key={i} className="ps-card">
            {img ? <img className="ps-card-img" src={img} alt="" loading="lazy" /> : <span className="ps-card-img" />}
            <div className="ps-card-body">
              {c.eyebrow ? <span className="ps-eyebrow">{t(c.eyebrow)}</span> : null}
              <h3>{t(c.title)}</h3>
              {c.text ? <p>{t(c.text)}</p> : null}
              {signup
                ? <EmailSignup className="ps-signup" placeholder={c.placeholder || 'Your email address'} label={c.buttonLabel || 'Download'} source={c.title} />
                : (c.buttonLabel ? <Cta url={c.buttonUrl} className="ps-btn"><Ico name={c.icon === 'download' ? 'download' : 'mail'} />{t(c.buttonLabel)}</Cta> : null)}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export const components = {
  PersonaHero: {
    label: 'Persona: hero (video, headline, form)',
    fields: {
      eyebrow: T('Small label above the headline'), headline: A('Headline'), subhead: A('Sub-headline'),
      bullets: { type: 'array', label: 'Three highlights', arrayFields: { text: T('Text') }, getItemSummary: (i) => i.text || 'Item', defaultItemProps: { text: 'New point' } },
      buttonLabel: T('Button text'), buttonUrl: T('Button link (https, mailto:, tel: or #lead)'),
      chipText: T('Video greeting'), chipScript: T('Video greeting name (script lettering)'),
      photo: T('Placeholder image before the video plays'),
      formTitle: T('Form title'), formSubtitle: T('Form subtitle'),
      formFields: { type: 'array', label: 'Form fields', arrayFields: { key: T('Field id (letters)'), label: T('Label'), type: { type: 'select', label: 'Type', options: [{ label: 'Text', value: 'text' }, { label: 'Email', value: 'email' }, { label: 'Dropdown', value: 'select' }] }, options: T('Dropdown choices (comma separated)'), required: { type: 'radio', label: 'Required', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } }, getItemSummary: (i) => i.label || 'Field', defaultItemProps: { key: 'field', label: 'Label', type: 'text', required: false } },
      submitLabel: T('Form button text'), privacy: T('Line under the form button'),
    },
    defaultProps: {
      eyebrow: 'PERSONALIZED VIDEO LEAD GENERATION',
      headline: 'Turn Personal Connection into Predictable Growth',
      subhead: 'Create, deliver, and scale personalized videos that captivate, qualify, and convert your ideal prospects — all on one elegant platform.',
      bullets: [{ text: 'Higher Engagement' }, { text: 'More Qualified Leads' }, { text: 'Greater Revenue' }],
      buttonLabel: 'Start Your Personalized Video Experience', buttonUrl: '#lead',
      chipText: 'A Personalized Message for You,', chipScript: '{{firstname|Jordan}}',
      photo: '/landing-art/04/presenter.webp',
      formTitle: 'Request a Private Consultation', formSubtitle: 'Let’s explore how personalized video can drive results for your business.',
      formFields: [{ key: 'name', label: 'Full Name', type: 'text', required: true }, { key: 'email', label: 'Business Email', type: 'email', required: true }, { key: 'company', label: 'Company', type: 'text', required: false }, { key: 'goals', label: 'Tell us about your goals', type: 'select', options: 'Generate more leads, Nurture existing clients, Launch a new offer, Something else', required: false }],
      submitLabel: 'Request My Consultation', privacy: 'A concierge will be in touch within 1 business day.',
    },
    render: (p) => <PersonaHero {...p} />,
  },
  PersonaLogos: {
    label: 'Persona: trusted-by wordmarks',
    fields: { title: T('Label'), items: { type: 'array', label: 'Wordmarks', arrayFields: { name: T('Name'), subline: T('Small line under the name') }, getItemSummary: (i) => i.name || 'Brand', defaultItemProps: { name: 'Brand name', subline: '' } } },
    defaultProps: {
      title: 'TRUSTED BY LEADING BRANDS',
      items: [{ name: 'Forbes', subline: '' }, { name: 'LUXE REALTY', subline: 'GROUP' }, { name: 'VANTAGE', subline: 'CAPITAL' }, { name: 'Asteria', subline: 'WELLNESS' }, { name: 'CARRINGTON', subline: 'ADVISORS' }, { name: 'The Haven', subline: 'COLLECTION™' }],
    },
    render: (p) => <PersonaLogos {...p} />,
  },
  PersonaTestimonials: {
    label: 'Persona: testimonials with portraits',
    fields: {
      eyebrow: T('Small label'),
      title: T('Heading'),
      quotes: { type: 'array', label: 'Testimonials', arrayFields: { photo: T('Portrait (https link or /landing-art path)'), text: A('Quote'), name: T('Name'), role: T('Role / company') }, getItemSummary: (i) => i.name || 'Testimonial', defaultItemProps: { photo: '', text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company' } },
    },
    defaultProps: {
      eyebrow: 'RESULTS OUR CLIENTS LOVE',
      title: 'Real Connections. Real Growth.',
      quotes: [
        { photo: '/landing-art/04/avatar1.webp', text: 'The personalized videos helped us 3× our qualified pipeline in just 60 days.', name: 'Michael Reeves', role: 'CEO, Vantage Capital' },
        { photo: '/landing-art/04/avatar2.webp', text: 'It feels like a white-glove experience for our prospects — and the results are exceptional.', name: 'Elena Carrington', role: 'Founder, Carrington Advisors' },
        { photo: '/landing-art/04/avatar3.webp', text: 'A game-changer for our outreach and lead generation. Personal, scalable, and proven.', name: 'James Park', role: 'Managing Partner, Luxe Realty Group' },
      ],
    },
    render: (p) => <PersonaTestimonials {...p} />,
  },
  PersonaSteps: {
    label: 'Persona: concierge steps row',
    fields: {
      eyebrow: T('Small label'),
      title: T('Heading'),
      steps: { type: 'array', label: 'Steps', arrayFields: { icon: T('Icon image (https link or /landing-art path)'), title: T('Title'), text: T('Text') }, getItemSummary: (i) => i.title || 'Step', defaultItemProps: { icon: '', title: 'Step', text: 'Describe this step.' } },
    },
    defaultProps: {
      eyebrow: 'THE CONCIERGE ONBOARDING EXPERIENCE',
      title: 'From Vision to Leads — White-Glove, End to End.',
      steps: [
        { icon: '/landing-art/04/step1.webp', title: 'Discover', text: 'A strategy consultation to align on your goals.' },
        { icon: '/landing-art/04/step2.webp', title: 'Personalize', text: 'We craft your branded, personalized video experience.' },
        { icon: '/landing-art/04/step3.webp', title: 'Launch', text: 'Go live with a guided, concierge rollout.' },
        { icon: '/landing-art/04/step4.webp', title: 'Grow', text: 'Capture, nurture, and convert more of the right leads.' },
      ],
    },
    render: (p) => <PersonaSteps {...p} />,
  },
  PersonaResources: {
    label: 'Persona: two photo cards',
    fields: {
      cards: { type: 'array', label: 'Cards', arrayFields: { image: T('Photo (https link or /landing-art path)'), eyebrow: T('Small label'), title: T('Title'), text: A('Text'), buttonLabel: T('Button text'), buttonUrl: T('Button link (https, mailto:, tel: or #lead)'), action: { type: 'radio', label: 'Button does', options: [{ label: 'Open a link', value: 'link' }, { label: 'Email sign-up (box + button)', value: 'signup' }] }, icon: { type: 'radio', label: 'Button icon', options: [{ label: 'Download', value: 'download' }, { label: 'Envelope', value: 'mail' }] }, placeholder: T('Email box hint (sign-up only)') }, getItemSummary: (i) => i.title || 'Card', defaultItemProps: { image: '', eyebrow: '', title: 'Title', text: '', buttonLabel: 'Learn more', buttonUrl: '#lead', action: 'link', icon: 'mail', placeholder: 'Your email address' } },
    },
    defaultProps: {
      cards: [
        { image: '/landing-art/04/book.webp', eyebrow: 'FEATURED RESOURCE', title: 'The Personalized Video Playbook', text: 'A strategic guide to higher engagement, more qualified leads, and lasting client relationships.', buttonLabel: 'Download the Free Playbook', buttonUrl: '#lead', action: 'signup', icon: 'download', placeholder: 'Your email address' },
        { image: '/landing-art/04/room.webp', eyebrow: 'HAVE A QUESTION?', title: 'Let’s Connect', text: 'Our team is here to help you explore the right personalized video strategy for your business.', buttonLabel: 'Contact Our Team', buttonUrl: 'mailto:hello@example.com', action: 'link', icon: 'mail', placeholder: '' },
      ],
    },
    render: (p) => <PersonaResources {...p} />,
  },
};
