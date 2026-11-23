/** Neon lead-gen extras: a testimonial row with photos and star ratings, and a sign-up footer band with editable social links. */
import { AccentText, EmailSignup, SafeLink, useTokens } from '../components.jsx';
import { safeImageUrl } from '../../templates.js';

const T = (label) => ({ type: 'text', label });
const imgOk = (src) => safeImageUrl(src) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(src || '')) ? src : '');

function Voices({ eyebrow, title, quotes }) {
  const t = useTokens();
  const list = Array.isArray(quotes) ? quotes : [];
  return (
    <section className="pk-lq-voices">
      <div className="pk-lq-head">
        {eyebrow ? <span className="pk-eyebrow-plain">{t(eyebrow)}</span> : null}
        {title ? <AccentText as="h2" className="pk-lq-title" text={title} /> : null}
      </div>
      <div className="pk-lq-list">
        {list.map((q, i) => {
          const n = Math.max(0, Math.min(5, Number(q.stars) || 0));
          const photo = imgOk(q.photo);
          return (
            <figure key={i} className="pk-lq-card">
              {photo ? <img src={photo} alt={t(q.photoAlt) || ''} width="58" height="58" loading="lazy" /> : <i className="pk-dot pk-dot--lg">{String(q.name || '?').slice(0, 1).toUpperCase()}</i>}
              <div className="pk-lq-body">
                <blockquote>{`“${t(q.text)}”`}</blockquote>
                <figcaption>
                  <span><b>{t(q.name)}</b><small>{t(q.role)}</small></span>
                  {n ? <span className="pk-lq-stars" role="img" aria-label={`${n} out of 5 stars`}>{'★'.repeat(n)}</span> : null}
                </figcaption>
              </div>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

/* Social icons drawn from simple shapes (no brand artwork); one entry per network. */
const SOCIAL = {
  linkedin: <><rect x="3" y="9" width="4" height="12" /><circle cx="5" cy="4.5" r="2.2" /><path d="M10 9h4v2c.8-1.4 2.2-2.3 4-2.3 3 0 4 2 4 5V21h-4v-6c0-1.4-.5-2.3-1.8-2.3S14 13.600 14 15v6h-4z" /></>,
  youtube: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9l5 3-5 3z" className="pk-lq-cut" /></>,
  x: <path d="M4 3l16 18M20 3L4 21" fill="none" strokeWidth="2.6" strokeLinecap="round" />,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" strokeWidth="2" /><circle cx="17.200" cy="6.800" r="1.200" /></>,
  facebook: <path d="M14 8V6c0-.8.4-1 1-1h2V2h-3c-3 0-4 2-4 4v2H8v3h2v10h4V11h3l.5-3z" />,
  tiktok: <path d="M14 3v11a3.500 3.500 0 1 1-3.500-3.500M14 3c.3 2.500 2 4 4.500 4.200" fill="none" strokeWidth="2.600" strokeLinecap="round" />,
};
const NETWORKS = Object.keys(SOCIAL).map((k) => ({ label: k[0].toUpperCase() + k.slice(1), value: k }));

function FooterBand({ brand, tagline, title, placeholder, buttonLabel, followLabel, socials }) {
  const t = useTokens();
  const list = Array.isArray(socials) ? socials : [];
  return (
    <section className="pk-band pk-lq-foot">
      <div className="pk-band-in">
        <div className="pk-band-brand">{brand ? <b>{t(brand)}</b> : null}{tagline ? <span>{t(tagline)}</span> : null}</div>
        <div className="pk-band-text"><b>{t(title)}</b></div>
        <EmailSignup placeholder={placeholder} label={buttonLabel || 'Get Started'} source={title} className="pk-mini--band" />
        {followLabel || list.length ? (
          <div className="pk-social">
            {followLabel ? <span>{t(followLabel)}</span> : null}
            <ul className="pk-lq-social">
              {list.map((s, i) => (SOCIAL[s.network] && s.url ? (
                <li key={i}><SafeLink href={s.url}><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" strokeWidth="0" aria-hidden="true">{SOCIAL[s.network]}</svg><span className="pk-lq-sr">{t(s.label || s.network)}</span></SafeLink></li>
              ) : null))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export const components = {
  LeadiqFooterBand: {
    label: 'Sign-up footer with social links (Neon)',
    fields: {
      brand: T('Brand name'),
      tagline: T('Tagline'),
      title: { type: 'textarea', label: 'Sign-up text' },
      placeholder: T('Email placeholder'),
      buttonLabel: T('Button label'),
      followLabel: T('Social label (e.g. Follow Us)'),
      socials: { type: 'array', label: 'Social links', arrayFields: { network: { type: 'select', label: 'Network', options: NETWORKS }, url: T('Link (https://...)'), label: T('Accessible name') }, getItemSummary: (i) => i.network || 'Link', defaultItemProps: { network: 'linkedin', url: '', label: 'LinkedIn' } },
    },
    defaultProps: { brand: 'Your Brand', tagline: 'Your tagline here.', title: 'Join our community and get new ideas in your inbox.', placeholder: 'Enter your email address', buttonLabel: 'Get Started Free', followLabel: 'Follow Us', socials: [{ network: 'linkedin', url: '', label: 'LinkedIn' }] },
    render: (p) => <FooterBand {...p} />,
  },
  LeadiqTestimonials: {
    label: 'Testimonials with photos (Neon)',
    fields: {
      eyebrow: T('Small label'),
      title: T('Heading (wrap words in [[double brackets]] to highlight)'),
      quotes: { type: 'array', label: 'Testimonials', arrayFields: { photo: T('Photo (https link)'), photoAlt: T('Screen-reader description (alt text)'), text: { type: 'textarea', label: 'Quote' }, name: T('Name'), role: T('Role / company'), stars: { type: 'number', label: 'Stars (0-5)', min: 0, max: 5 } }, getItemSummary: (i) => i.name || 'Quote', defaultItemProps: { photo: '', text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company', stars: 5 } },
    },
    defaultProps: { eyebrow: 'CUSTOMER LOVE', title: 'What Our Users Are Saying', quotes: [{ photo: '', text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company', stars: 5 }] },
    render: (p) => <Voices {...p} />,
  },
};
