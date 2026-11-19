/**
 * Neon KPI hero: headline + video + lead form, plus a right-hand column with a big counter card and a gift
 * (lead magnet) card, as in the supplied design. All text is a field; all sample copy.
 */
import { useEffect, useRef } from 'react';
import { AccentText, VideoPlayer, LeadForm, EmailSignup, Icon, SafeLink, useTokens } from '../components.jsx';
import { slotFields, SLOT_DEFAULTS } from '../slotFields.js';
import { safeImageUrl } from '../../templates.js';

// https pictures, or the design's own art under /landing-art/ (same rule as the other editor components).
const artUrl = (v) => safeImageUrl(v) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(v || '')) ? String(v) : '');

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const asList = (v) => (Array.isArray(v) ? v : []);
const FORM_FIELDS = [{ key: 'name', label: 'Your First Name', type: 'text', required: true }, { key: 'email', label: 'Your Email Address', type: 'email', required: true }, { key: 'company', label: 'Company (Optional)', type: 'text', required: false }];

const FIELD_ICON = { name: 'user', first_name: 'user', firstname: 'user', email: 'mail', company: 'building', phone: 'phone', tel: 'phone' };

function NeonHero(p) {
  const t = useTokens();
  const formRef = useRef(null);
  const iconsRef = useRef(null);
  const fields = asList(p.formFields).filter((f) => f.key && f.label).map((f) => ({ ...f, key: String(f.key).replace(/[^a-z0-9_]/gi, '').toLowerCase() }));
  // LeadForm is shared and has no icon slot: copy the inline SVG from the icon set into each field label.
  const keySig = fields.map((f) => f.key).join(',');
  useEffect(() => {
    const form = formRef.current; const src = iconsRef.current;
    if (!form || !src) return undefined;
    const added = [];
    form.querySelectorAll('label.pk-field').forEach((lab, i) => {
      const f = fields[i]; const svg = f && src.querySelector(`[data-ico="${FIELD_ICON[f.key] || (f.type === 'email' ? 'mail' : 'user')}"] svg`);
      if (!svg) return;
      const el = svg.cloneNode(true); el.setAttribute('class', 'pk-neon-fico');
      lab.prepend(el); added.push(el);
    });
    return () => added.forEach((el) => el.remove());
  }, [keySig]);
  return (
    <header className="pk-hero pk-neon-hero" id="top">
      <div className="pk-hero-copy">
        {p.eyebrow ? <span className="pk-eyebrow"><Icon name="play" className="pk-eyebrow-ico" />{t(p.eyebrow)}</span> : null}
        <AccentText as="h1" className="pk-headline" text={p.headline} />
        {p.subhead ? <p className="pk-subhead">{t(p.subhead)}</p> : null}
        {asList(p.bullets).length ? <ul className="pk-bullets">{asList(p.bullets).map((b, i) => <li key={i}>{t(b.text)}</li>)}</ul> : null}
      </div>
      <div className="pk-hero-video">
        <VideoPlayer poster={p.photo} slotImage={p.slotImage} slotVideo={p.slotVideo} bakedPlay={p.bakedPlay} />
        {p.chip ? <div className="pk-chip">{t(p.chip)}</div> : null}
      </div>
      <div className="pk-hero-form" id="lead" ref={formRef}>
        <span hidden ref={iconsRef}>{['user', 'mail', 'building', 'phone'].map((n) => <span key={n} data-ico={n}><Icon name={n} /></span>)}</span>
        <LeadForm title={p.formTitle} submitLabel={p.submitLabel} privacy={p.privacy} fields={fields.length ? fields : undefined} />
        {asList(p.buttons).length ? (
          <div className="pk-neon-or">
            {p.orLabel ? <span className="pk-neon-or-line">{t(p.orLabel)}</span> : null}
            {asList(p.buttons).map((b, i) => <SafeLink key={i} className="pk-btn pk-btn--secondary" href={b.url}>{t(b.label)}</SafeLink>)}
          </div>
        ) : null}
      </div>
      <aside className="pk-neon-aside" aria-label="Highlights">
        <section className="pk-neon-kpi">
          <p className="pk-neon-kpi-title"><Icon name="users" className="pk-ico" />{t(p.kpiTitle)}</p>
          <b className="pk-neon-kpi-value">{t(p.kpiValue)}</b>
          {p.kpiBadge ? <span className="pk-neon-badge">{t(p.kpiBadge)}</span> : null}
          <svg className="pk-neon-spark" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="pk-neon-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#19e6ee" stopOpacity=".75" /><stop offset="1" stopColor="#19e6ee" stopOpacity="0" /></linearGradient></defs>
            <path d="M0 76 C30 74 40 70 60 66 S90 62 105 52 S130 54 150 40 S180 6 200 4 L200 80 L0 80 Z" fill="url(#pk-neon-g)" />
            <path d="M0 76 C30 74 40 70 60 66 S90 62 105 52 S130 54 150 40 S180 6 200 4" fill="none" stroke="#19e6ee" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </svg>
        </section>
        <section className="pk-neon-gift">
          <div className="pk-neon-gift-body">
            {artUrl(p.giftIcon ?? '/landing-art/10/gift.webp') ? <img className="pk-neon-giftico" src={artUrl(p.giftIcon ?? '/landing-art/10/gift.webp')} alt="" /> : null}
            <h2 className="pk-neon-gift-title">{t(p.giftTitle)}</h2>
            <EmailSignup className="pk-neon-signup" placeholder={p.giftPlaceholder} label={p.giftButton} source={p.giftTitle} />
          </div>
          <div className="pk-neon-book">{artUrl(p.giftBook ?? '/landing-art/10/book.webp') ? <img src={artUrl(p.giftBook ?? '/landing-art/10/book.webp')} alt="" /> : null}<b className="pk-sr">{t(p.giftCover)}</b></div>
        </section>
      </aside>
    </header>
  );
}

export const components = {
  NeonHero: {
    label: 'Neon hero (headline, video, form, counter, gift)',
    fields: {
      eyebrow: T('Small label above the headline'),
      headline: A('Headline (wrap words in [[double brackets]] to highlight)'),
      subhead: A('Sub-headline'),
      bullets: { type: 'array', label: 'Tick list', arrayFields: { text: T('Text') }, getItemSummary: (i) => i.text || 'Item', defaultItemProps: { text: 'New point' } },
      chip: T('Label on the video'),
      photo: T('Placeholder image before the video plays'),
      ...slotFields(),
      formTitle: T('Form title'),
      formFields: { type: 'array', label: 'Form fields', arrayFields: { key: T('Field name (a-z)'), label: T('Label / placeholder'), type: { type: 'select', label: 'Type', options: ['text', 'email', 'tel'].map((v) => ({ label: v, value: v })) }, required: { type: 'radio', label: 'Required', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } }, getItemSummary: (i) => i.label || 'Field', defaultItemProps: { key: 'field', label: 'Field', type: 'text', required: false } },
      submitLabel: T('Form button text'),
      privacy: T('Line under the form button'),
      orLabel: T('Word between form and buttons'),
      buttons: { type: 'array', label: 'Buttons under the form', arrayFields: { label: T('Text'), url: T('Link (https, mailto: or tel:)') }, getItemSummary: (i) => i.label || 'Button', defaultItemProps: { label: 'Button', url: '' } },
      kpiTitle: T('Counter title'),
      kpiValue: T('Counter number'),
      kpiBadge: T('Counter badge'),
      giftTitle: T('Gift card title'),
      giftPlaceholder: T('Gift email box hint'),
      giftButton: T('Gift button text'),
      giftCover: T('Text on the gift book cover'),
      giftIcon: T('Gift icon picture (https link or /landing-art path)'),
      giftBook: T('Gift book picture (https link or /landing-art path)'),
    },
    defaultProps: {
      eyebrow: 'Personalized Video Lead Generation',
      headline: 'Turn Every Prospect Into a Warm Lead With [[Personalized Video]]',
      subhead: 'Create, send, and track AI-personalized videos at scale. Build your email list, capture more leads, and grow revenue, all in one platform.',
      bullets: [{ text: 'AI-powered video personalization' }, { text: 'Built-in lead capture & list building' }, { text: 'Automated follow-ups & nurturing' }],
      chip: '\u{1F44B} Hi {{firstname|there}}, this video is just for you!', ...SLOT_DEFAULTS, photo: '/landing-art/10/presenter.webp',
      formTitle: 'Get Your Personalized Video & Grow Your Lead List', formFields: FORM_FIELDS, submitLabel: 'Create My Personalized Video', privacy: '',
      orLabel: 'or', buttons: [{ label: 'Book a Live Walkthrough', url: '#lead' }],
      kpiTitle: 'Leads Captured (All Time)', kpiValue: '128,349', kpiBadge: '+37% (Last 30 days)',
      giftTitle: 'Join Our Insider List & Get a Free "Personalized Video Playbook"', giftPlaceholder: 'Enter your email', giftButton: 'Get the Free Playbook', giftCover: 'The Personalized Video Playbook', giftIcon: '/landing-art/10/gift.webp', giftBook: '/landing-art/10/book.webp',
    },
    render: (p) => <NeonHero {...p} />,
  },
};
