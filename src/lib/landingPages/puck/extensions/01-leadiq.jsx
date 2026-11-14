/** Neon lead-gen extras: a testimonial row with photos and star ratings. */
import { AccentText, useTokens } from '../components.jsx';
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
              {photo ? <img src={photo} alt="" width="58" height="58" loading="lazy" /> : <i className="pk-dot pk-dot--lg">{String(q.name || '?').slice(0, 1).toUpperCase()}</i>}
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

export const components = {
  LeadiqTestimonials: {
    label: 'Testimonials with photos (Neon)',
    fields: {
      eyebrow: T('Small label'),
      title: T('Heading (wrap words in [[double brackets]] to highlight)'),
      quotes: { type: 'array', label: 'Testimonials', arrayFields: { photo: T('Photo (https link)'), text: { type: 'textarea', label: 'Quote' }, name: T('Name'), role: T('Role / company'), stars: { type: 'number', label: 'Stars (0-5)', min: 0, max: 5 } }, getItemSummary: (i) => i.name || 'Quote', defaultItemProps: { photo: '', text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company', stars: 5 } },
    },
    defaultProps: { eyebrow: 'CUSTOMER LOVE', title: 'What Our Users Are Saying', quotes: [{ photo: '', text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company', stars: 5 }] },
    render: (p) => <Voices {...p} />,
  },
};
