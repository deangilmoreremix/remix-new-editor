/**
 * Luxury concierge extras: testimonials with portraits, a numbered onboarding row, and photo resource cards.
 * Every visible string is a field; images only render from safe https links or the bundled /landing-art/ crops.
 */
import { useTokens, SafeLink } from '../components.jsx';
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
    <section className="ps-cards">
      {asList(cards).map((c, i) => {
        const img = art(c.image);
        return (
          <article key={i} className="ps-card">
            {img ? <img className="ps-card-img" src={img} alt="" loading="lazy" /> : <span className="ps-card-img" />}
            <div className="ps-card-body">
              {c.eyebrow ? <span className="ps-eyebrow">{t(c.eyebrow)}</span> : null}
              <h3>{t(c.title)}</h3>
              {c.text ? <p>{t(c.text)}</p> : null}
              {c.buttonLabel ? <Cta url={c.buttonUrl} className="ps-btn">{t(c.buttonLabel)}</Cta> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export const components = {
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
      cards: { type: 'array', label: 'Cards', arrayFields: { image: T('Photo (https link or /landing-art path)'), eyebrow: T('Small label'), title: T('Title'), text: A('Text'), buttonLabel: T('Button text'), buttonUrl: T('Button link (https, mailto:, tel: or #lead)') }, getItemSummary: (i) => i.title || 'Card', defaultItemProps: { image: '', eyebrow: '', title: 'Title', text: '', buttonLabel: 'Learn more', buttonUrl: '#lead' } },
    },
    defaultProps: {
      cards: [
        { image: '/landing-art/04/book.webp', eyebrow: 'FEATURED RESOURCE', title: 'The Personalized Video Playbook', text: 'A strategic guide to higher engagement, more qualified leads, and lasting client relationships.', buttonLabel: 'Download the Free Playbook', buttonUrl: '#lead' },
        { image: '/landing-art/04/room.webp', eyebrow: 'HAVE A QUESTION?', title: 'Let’s Connect', text: 'Our team is here to help you explore the right personalized video strategy for your business.', buttonLabel: 'Contact Our Team', buttonUrl: 'mailto:hello@example.com' },
      ],
    },
    render: (p) => <PersonaResources {...p} />,
  },
};
