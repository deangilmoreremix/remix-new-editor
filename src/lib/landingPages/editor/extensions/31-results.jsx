/** Design 31 (Results page): feature tiles, laptop demo, testimonial row and CTA band. Sample copy only; every string is a field. */
import { AccentText, SafeLink, useTokens } from '../components.jsx';
import { safeImageUrl } from '../../templates.js';

const art = (src) => safeImageUrl(src) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(src || '')) ? src : '');
const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const list = (v) => (Array.isArray(v) ? v : []);

function ResultsFeatures({ title, tiles }) {
  const t = useTokens();
  return (
    <section className="rs-feat" aria-label={t(title) || 'Features'}>
      <div className="rs-feat-card">
        <AccentText as="h2" className="rs-h2" text={title} />
        <ul className="rs-tiles">
          {list(tiles).map((x, i) => (
            <li key={i} className="rs-tile">
              {art(x.icon) ? <img src={art(x.icon)} alt="" loading="lazy" /> : <i aria-hidden="true" />}
              <span>{t(x.label)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ResultsDemo({ title, text, buttonLabel, buttonUrl, image, imageAlt, arrow }) {
  const t = useTokens();
  return (
    <section className="rs-demo">
      <div className="rs-demo-copy">
        <AccentText as="h2" className="rs-h2 rs-demo-title" text={title} />
        {text ? <p>{t(text)}</p> : null}
        {buttonLabel ? <SafeLink className="rs-btn rs-btn--play" href={buttonUrl}>{t(buttonLabel)}</SafeLink> : null}
      </div>
      {art(arrow) ? <img className="rs-arrow" src={art(arrow)} alt="" aria-hidden="true" loading="lazy" /> : null}
      {art(image) ? <img className="rs-laptop" src={art(image)} alt={t(imageAlt)} loading="lazy" /> : null}
    </section>
  );
}

function ResultsTestimonials({ title, quotes }) {
  const t = useTokens();
  return (
    <section className="rs-proof" aria-label={t(title) || 'Testimonials'}>
      <AccentText as="h2" className="rs-h2" text={title} />
      <ul className="rs-quotes">
        {list(quotes).map((q, i) => {
          const n = Math.max(0, Math.min(5, parseInt(q.stars, 10) || 0));
          return (
            <li key={i} className="rs-quote">
              {art(q.photo) ? <img className="rs-ava" src={art(q.photo)} alt="" loading="lazy" /> : <i className="rs-ava" aria-hidden="true" />}
              <figure>
                <blockquote>{t(q.text)}</blockquote>
                <figcaption><b>{t(q.name)}</b><span>{t(q.role)}</span></figcaption>
                {n ? <p className="rs-stars" role="img" aria-label={`${n} out of 5 stars`}>{'★'.repeat(n)}</p> : null}
              </figure>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ResultsCta({ title, text, buttonLabel, buttonUrl, checks }) {
  const t = useTokens();
  return (
    <section className="rs-cta">
      <div className="rs-cta-in">
        <div className="rs-cta-copy">
          <AccentText as="h2" className="rs-cta-title" text={title} />
          {text ? <p>{t(text)}</p> : null}
          {buttonLabel ? <SafeLink className="rs-btn rs-btn--big" href={buttonUrl}>{t(buttonLabel)}</SafeLink> : null}
        </div>
        <ul className="rs-checks">{list(checks).map((c, i) => <li key={i}>{t(c.label)}</li>)}</ul>
      </div>
    </section>
  );
}

export const components = {
  ResultsFeatures: {
    label: 'Results: feature tiles',
    fields: { title: T('Heading'), tiles: { type: 'array', label: 'Tiles', arrayFields: { icon: T('Icon image (https or /landing-art path)'), label: T('Label') }, getItemSummary: (i) => i.label || 'Tile', defaultItemProps: { icon: '', label: 'Feature' } } },
    defaultProps: {
      title: 'Powerful Features to Grow Your Audience',
      tiles: [['i1', 'Personalized Video Messages'], ['i2', 'Lead Capture Forms'], ['i3', 'Business Automation'], ['i4', 'Custom Branding & Templates'], ['i5', 'Instant Sharing & Tracking']].map(([i, label]) => ({ icon: `/landing-art/results/${i}.webp`, label })),
    },
    render: (p) => <ResultsFeatures {...p} />,
  },
  ResultsDemo: {
    label: 'Results: laptop demo',
    fields: { title: T('Heading'), text: A('Text'), buttonLabel: T('Button text (empty = no button)'), buttonUrl: T('Button link (https, #video or #lead)'), image: T('Laptop image (https or /landing-art path)'), imageAlt: T('Image description for screen readers'), arrow: T('Arrow decoration image (optional)') },
    defaultProps: {
      title: 'See It In Action', text: 'Turn any video into a personalized marketing machine. Add your prospect’s name, company and more — in just minutes.',
      buttonLabel: 'Watch Demo Video', buttonUrl: '#video', image: '/landing-art/results/laptop.webp', imageAlt: 'Video editor on a laptop showing a presenter with a personalized greeting', arrow: '/landing-art/results/arrow.webp',
    },
    render: (p) => <ResultsDemo {...p} />,
  },
  ResultsTestimonials: {
    label: 'Results: testimonial row',
    fields: { title: T('Heading'), quotes: { type: 'array', label: 'Testimonials', arrayFields: { photo: T('Portrait (https or /landing-art path)'), text: A('Quote'), name: T('Name'), role: T('Role'), stars: T('Stars (0-5)') }, getItemSummary: (i) => i.name || 'Testimonial', defaultItemProps: { photo: '', text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role', stars: '5' } } },
    defaultProps: {
      title: 'Trusted by Creators, Businesses and Agencies',
      quotes: [
        { photo: '/landing-art/results/p1.webp', text: '“SmartVideo AI has completely changed the way I connect with clients.”', name: 'Sarah Mitchell', role: 'Marketing Consultant', stars: '5' },
        { photo: '/landing-art/results/p2.webp', text: '“I created a list of qualified leads in just one afternoon. Amazing!”', name: 'David Reynolds', role: 'Real Estate Agent', stars: '5' },
        { photo: '/landing-art/results/p3.webp', text: '“Simple to use, incredibly powerful. My business has never grown faster.”', name: 'Lisa Carter', role: 'Small Business Owner', stars: '5' },
      ],
    },
    render: (p) => <ResultsTestimonials {...p} />,
  },
  ResultsCta: {
    label: 'Results: closing CTA band',
    fields: { title: T('Heading'), text: A('Text'), buttonLabel: T('Button text'), buttonUrl: T('Button link (https, #lead or #video)'), checks: { type: 'array', label: 'Check lines', arrayFields: { label: T('Text') }, getItemSummary: (i) => i.label || 'Line', defaultItemProps: { label: 'Benefit' } } },
    defaultProps: {
      title: 'Ready to Grow Your Business?', text: 'Join thousands of happy users and start creating personalized videos today.', buttonLabel: 'Get Started Free', buttonUrl: '#lead',
      checks: ['Free to try', 'No credit card required', 'Start in minutes'].map((label) => ({ label })),
    },
    render: (p) => <ResultsCta {...p} />,
  },
};
