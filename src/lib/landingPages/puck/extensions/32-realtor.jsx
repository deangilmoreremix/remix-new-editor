/** Design 32 (Real estate page): menu bar with tagline, video-with-overlay section, steps + phone mockup, closing CTA band. Sample copy only. */
import { useState } from 'react';
import { AccentText, Icon, LeadForm, SafeLink, VideoPlayer, useTokens } from '../components.jsx';
import { slotFields, SLOT_DEFAULTS } from '../slotFields.js';
import { safeImageUrl } from '../../templates.js';

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const list = (v) => (Array.isArray(v) ? v : []);
const img = (v) => safeImageUrl(v) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(v || '')) ? String(v) : '');
const lines = (s) => String(s || '').split('\n');

function RealtorNav({ brand, tagline, logo, links, ctaLabel, ctaUrl }) {
  const t = useTokens();
  const logoUrl = img(logo);
  return (
    <nav className="pk-nav rl-nav" aria-label="Site">
      <a className="pk-brand rl-brand" href="#top">
        {logoUrl ? <img src={logoUrl} alt="" width="36" height="40" /> : null}
        <span><b>{t(brand)}</b>{tagline ? <small>{t(tagline)}</small> : null}</span>
      </a>
      <ul className="pk-nav-links rl-links">
        {list(links).map((l, i) => <li key={i}>{l.url ? <SafeLink href={l.url}>{t(l.label)}</SafeLink> : <span>{t(l.label)}</span>}</li>)}
      </ul>
      <div className="pk-nav-right">{ctaLabel ? <SafeLink className="pk-btn pk-btn--primary pk-nav-cta" href={ctaUrl || '#lead'}>{t(ctaLabel)}</SafeLink> : null}</div>
    </nav>
  );
}

const cssBg = (v) => { const u = img(v); return u && !/["'()\\\s<>]/.test(u) ? `url(${JSON.stringify(u)})` : ''; };

/** Hero without its own video (the page video lives in the section below): photo background, copy, tick list and the real lead form. */
function RealtorHero({ background, eyebrow, headline, subhead, bullets, formOptions, formTitle, formSubtitle, formFields, submitLabel, privacy }) {
  const t = useTokens();
  const fields = list(formFields).filter((f) => f.key && f.label).map((f) => ({ ...f, key: String(f.key).replace(/[^a-z0-9_]/gi, '').toLowerCase() }));
  return (
    <header className="pk-hero pk-hero--copy-video-form" id="top" style={cssBg(background) ? { '--pk-hero-bg': cssBg(background) } : undefined}>
      <div className="pk-hero-copy">
        {eyebrow ? <span className="pk-eyebrow">{t(eyebrow)}</span> : null}
        <AccentText as="h1" className="pk-headline" text={headline} />
        {subhead ? <p className="pk-subhead">{t(subhead)}</p> : null}
        {list(bullets).length ? <ul className="pk-bullets">{list(bullets).map((b, i) => <li key={i}>{t(b.text)}</li>)}</ul> : null}
      </div>
      <div className="pk-hero-form" id="lead"><LeadForm options={formOptions} title={formTitle} subtitle={formSubtitle} submitLabel={submitLabel} privacy={privacy} fields={fields.length ? fields : undefined} /></div>
    </header>
  );
}

function RealtorVideoSection({ poster, slotImage, slotVideo, bakedPlay, overlayText, eyebrow, title, text, callout }) {
  const t = useTokens();
  const [playing, setPlaying] = useState(false);
  return (
    <section className="rl-vid">
      <div className={`rl-vid-media${playing ? ' is-playing' : ''}`} onPlayCapture={() => setPlaying(true)} onPauseCapture={() => setPlaying(false)} onEndedCapture={() => setPlaying(false)}>
        <VideoPlayer poster={img(poster)} slotImage={slotImage} slotVideo={slotVideo} bakedPlay={bakedPlay} />
        <div className="rl-vid-note" aria-hidden="true">
          <p>{lines(overlayText).map((l, i) => <span key={i}>{t(l)}</span>)}</p>
          <i><Icon name="home" /></i>
        </div>
        <i className="rl-vid-play" aria-hidden="true"><Icon name="play" /></i>
      </div>
      <div className="rl-vid-copy">
        {eyebrow ? <span className="pk-eyebrow-plain">{t(eyebrow)}</span> : null}
        <AccentText as="h2" className="pk-h2" text={title} />
        {text ? <p className="rl-vid-text">{t(text)}</p> : null}
        {callout ? <div className="rl-callout"><Icon name="target" className="pk-ico pk-ico--lg" /><AccentText as="p" text={callout} /></div> : null}
      </div>
    </section>
  );
}

function RealtorSteps({ eyebrow, title, steps, phoneName, phoneText, phoneImage, phoneButton, note }) {
  const t = useTokens();
  const phoneImg = img(phoneImage);
  return (
    <section className="rl-steps">
      <div className="rl-steps-copy">
        {eyebrow ? <span className="pk-eyebrow-plain">{t(eyebrow)}</span> : null}
        <AccentText as="h2" className="pk-h2" text={title} />
        <ol className="rl-step-list">
          {list(steps).map((s, i) => <li key={i}><span className="rl-step-n">{i + 1}</span><b>{t(s.title)}</b>{s.text ? <span>{t(s.text)}</span> : null}</li>)}
        </ol>
      </div>
      <div className="rl-phone" role="img" aria-label={t(phoneName)}>
        <div className="rl-screen">
          <p><b>{t(phoneName)}</b><span>{t(phoneText)}</span></p>
          {phoneImg ? <div className="rl-screen-img" style={{ backgroundImage: `url(${JSON.stringify(phoneImg)})` }}><i><Icon name="play" /></i></div> : null}
          {phoneButton ? <span className="rl-screen-btn">{t(phoneButton)}</span> : null}
        </div>
      </div>
      <p className="rl-note">
        <svg className="rl-arrow" viewBox="0 0 30 50" aria-hidden="true"><path d="M6 4c14 2 22 16 14 28-2 3-5 6-9 8M11 33l-3 8 9-1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span>{lines(note).map((l, i) => <span key={i}>{t(l)}</span>)}</span>
      </p>
    </section>
  );
}

function RealtorCta({ eyebrow, title, text, buttonLabel, buttonUrl, note }) {
  const t = useTokens();
  return (
    <section className="rl-cta">
      <div className="rl-cta-copy">
        {eyebrow ? <span className="pk-eyebrow-plain">{t(eyebrow)}</span> : null}
        <AccentText as="h2" className="rl-cta-title" text={title} />
        {text ? <p>{t(text)}</p> : null}
      </div>
      <div className="rl-cta-act">
        <SafeLink className="pk-btn pk-btn--primary" href={buttonUrl || '#lead'}>{t(buttonLabel)}</SafeLink>
        {note ? <small>{t(note)}</small> : null}
      </div>
    </section>
  );
}

const HERO_DEFAULTS = {
  background: '/landing-art/realtor/hero.webp', eyebrow: 'REAL ESTATE PROFESSIONALS', headline: 'Turn More Leads Into Listings with Personalized [[Video Outreach]]',
  subhead: 'Create stunning, personalized real estate videos in minutes. Connect with more buyers and sellers, build trust, and close more deals with SmartVideo AI.',
  bullets: [{ text: 'Personalize with the click of a button' }, { text: 'Showcase properties and local areas' }, { text: 'Stand out in a crowded market' }],
  formTitle: 'Get Your Free Personalized Real Estate Video', formSubtitle: 'Enter your name and email to create a custom video and see how SmartVideo AI can help you get more leads and listings.',
  formFields: [{ key: 'name', label: 'Your Name', type: 'text', required: true }, { key: 'email', label: 'Your Email Address', type: 'email', required: true }], submitLabel: 'Create My Free Video', privacy: 'Your information is secure and never shared.',
};

export const components = {
  RealtorHero: {
    label: 'Realtor: hero with photo and lead form',
    fields: {
      background: T('Background photo'), eyebrow: T('Small label above the headline'), headline: A('Headline (wrap words in [[double brackets]] to highlight)'), subhead: A('Sub-headline'),
      bullets: { type: 'array', label: 'Tick list', arrayFields: { text: T('Text') }, getItemSummary: (i) => i.text || 'Item', defaultItemProps: { text: 'New point' } },
      formTitle: T('Form title'), formSubtitle: A('Form subtitle'),
      formFields: { type: 'array', label: 'Form fields', arrayFields: { key: T('Field name (a-z)'), label: T('Label / placeholder'), type: { type: 'select', label: 'Type', options: ['text', 'email', 'tel', 'textarea'].map((v) => ({ label: v, value: v })) }, required: { type: 'radio', label: 'Required', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } }, getItemSummary: (i) => i.label || 'Field', defaultItemProps: { key: 'field', label: 'Field', type: 'text', required: false } },
      submitLabel: T('Form button text'), privacy: T('Line under the form button'),
    },
    defaultProps: HERO_DEFAULTS,
    render: (p) => <RealtorHero {...p} />,
  },
  RealtorNav: {
    label: 'Realtor: menu bar with tagline',
    fields: { brand: T('Brand name'), tagline: T('Tagline under the brand'), logo: T('Logo image'), links: { type: 'array', label: 'Menu links', arrayFields: { label: T('Text'), url: T('Link (optional)') }, getItemSummary: (i) => i.label || 'Link', defaultItemProps: { label: 'Link', url: '' } }, ctaLabel: T('Button text'), ctaUrl: T('Button link (#lead scrolls to the form)') },
    defaultProps: { brand: 'SmartVideo AI', tagline: 'Personalized Videos. Real Results.', logo: '/landing-art/realtor/logo.webp', links: ['Home', 'Features', 'Templates', 'Pricing', 'Support'].map((label) => ({ label, url: '' })), ctaLabel: 'Get Started Free', ctaUrl: '#lead' },
    render: (p) => <RealtorNav {...p} />,
  },
  RealtorVideoSection: {
    label: 'Realtor: video with handwritten overlay + copy',
    fields: { poster: T('Video placeholder image'), ...slotFields(), overlayText: A('Handwritten note on the video (one line per row)'), eyebrow: T('Small label'), title: A('Heading'), text: A('Text'), callout: A('Highlighted line ([[double brackets]] make words bold)') },
    defaultProps: { ...SLOT_DEFAULTS, poster: '/landing-art/realtor/agent.webp', overlayText: 'Hi Sarah,\nYour dream home\nis waiting!', eyebrow: 'REAL PEOPLE. REAL CONNECTIONS.', title: 'Make Every Prospect Feel Like a VIP', text: 'With SmartVideo AI, you can create personalized real estate videos that include the right property, location, and message — all tailored to each lead. It’s the easiest way to build trust and get more responses.', callout: '[[Personalization]] increases response rates by [[up to 3x]] compared to generic outreach.' },
    render: (p) => <RealtorVideoSection {...p} />,
  },
  RealtorSteps: {
    label: 'Realtor: 3 steps with phone mockup',
    fields: { eyebrow: T('Small label'), title: A('Heading'), steps: { type: 'array', label: 'Steps', arrayFields: { title: T('Title'), text: A('Text') }, getItemSummary: (i) => i.title || 'Step', defaultItemProps: { title: 'Step', text: '' } }, phoneName: T('Phone message: greeting'), phoneText: A('Phone message: text'), phoneImage: T('Phone message: picture'), phoneButton: T('Phone button text'), note: A('Handwritten note (one line per row)') },
    defaultProps: { eyebrow: 'HOW IT WORKS', title: 'Get Started in 3 Easy Steps', steps: [{ title: 'Choose a Template', text: 'Pick from professionally designed real estate templates or start from scratch.' }, { title: 'Add Your Personal Touch', text: 'Include your name, contact details, property info and more.' }, { title: 'Share & Connect', text: 'Send your personalized video and start getting more leads and showings.' }], phoneName: 'Hi John,', phoneText: 'Here’s a quick look at a property that matches your needs...', phoneImage: '/landing-art/realtor/property.webp', phoneButton: 'Watch Your Video', note: 'Simple,\nfast and\npowerful!' },
    render: (p) => <RealtorSteps {...p} />,
  },
  RealtorCta: {
    label: 'Realtor: closing call-to-action band',
    fields: { eyebrow: T('Small label'), title: A('Headline'), text: A('Text'), buttonLabel: T('Button text'), buttonUrl: T('Button link (#lead scrolls to the form)'), note: T('Line under the button') },
    defaultProps: { eyebrow: 'READY TO GET MORE LISTINGS?', title: 'Start Creating Your Personalized Real Estate Videos Today', text: 'Join thousands of real estate professionals using SmartVideo AI to build stronger connections and close more deals.', buttonLabel: 'Get Started Free', buttonUrl: '#lead', note: 'No credit card required.' },
    render: (p) => <RealtorCta {...p} />,
  },
};
