/** Design 07 "Street poster" extras: feature row, case studies + quote + chevron pipeline, import dropzone + final CTA. Sample copy only. */
import { AccentText, Icon, SafeLink, useTokens } from '../components.jsx';
import { safeImageUrl } from '../../templates.js';

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const asList = (v) => (Array.isArray(v) ? v : []);
const art = (src) => safeImageUrl(src) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(src || '')) ? String(src) : '');
const iconField = { type: 'select', label: 'Icon', options: ['video', 'bolt', 'target', 'layers', 'users', 'play', 'send', 'calendar', 'chart', 'check', 'star', 'mail'].map((k) => ({ label: k, value: k })) };
const Pic = ({ src, className }) => { const u = art(src); return u ? <img className={className} src={u} alt="" loading="lazy" /> : null; };

export const components = {
  PosterFeatures: {
    label: 'Poster: heading and feature row',
    fields: { heading: T('Heading (wrap words in [[double brackets]] to highlight)'), text: A('Text'), items: { type: 'array', label: 'Features', arrayFields: { icon: iconField, title: T('Title'), text: T('Text') }, getItemSummary: (i) => i.title || 'Feature', defaultItemProps: { icon: 'check', title: 'Feature', text: '' } } },
    defaultProps: {
      heading: 'Everything You Need to Generate Leads [[with Video]]',
      text: 'A full lead generation system — from contact import to personalized video creation to a booked pipeline.',
      items: [
        { icon: 'video', title: 'Personalized Videos at Scale', text: 'Create 1:1 videos for hundreds or thousands of contacts.' },
        { icon: 'bolt', title: 'Higher Response Rates', text: 'Cut through the noise with a personal, human touch.' },
        { icon: 'target', title: 'More Booked Meetings', text: 'Turn views into conversations, demos, and sales calls.' },
        { icon: 'layers', title: 'Agency-Ready & Done-for-You', text: 'White-labeled, campaign support, and creative execution from our team.' },
      ],
    },
    render: ({ heading, text, items }) => {
      const t = useTokens();
      return (
        <section className="pk-px-feats">
          <div className="pk-px-feats-in">
            <div className="pk-px-feats-intro">
              <AccentText as="h2" className="pk-px-h2" text={heading} />
              {text ? <p>{t(text)}</p> : null}
            </div>
            <ul className="pk-px-feats-row">
              {asList(items).map((it, i) => (
                <li key={i}><Icon name={it.icon || 'check'} className="pk-ico pk-ico--lg" /><span><b>{t(it.title)}</b>{it.text ? <small>{t(it.text)}</small> : null}</span></li>
              ))}
            </ul>
          </div>
        </section>
      );
    },
  },

  PosterProof: {
    label: 'Poster: case studies, quote and pipeline',
    fields: {
      casesTitle: T('Case studies heading'),
      casesText: T('Case studies text'),
      cases: { type: 'array', label: 'Case studies', arrayFields: { photo: T('Photo (path or https link)'), brand: T('Agency name'), logo: T('Agency logo (path or https link)'), value1: T('Number 1'), label1: T('Label 1'), value2: T('Number 2'), label2: T('Label 2') }, getItemSummary: (i) => i.brand || 'Case', defaultItemProps: { photo: '', brand: 'Agency', logo: '', value1: '+100%', label1: 'Result', value2: '+2x', label2: 'Result' } },
      quote: A('Testimonial'),
      quoteName: T('Name'),
      quoteRole: T('Role / company'),
      quotePhoto: T('Photo (path or https link)'),
      pipelineTitle: T('Pipeline heading'),
      pipelineText: T('Pipeline text'),
      steps: { type: 'array', label: 'Pipeline steps', arrayFields: { icon: iconField, label: T('Label') }, getItemSummary: (i) => i.label || 'Step', defaultItemProps: { icon: 'check', label: 'Step' } },
    },
    defaultProps: {
      casesTitle: 'Agency Case Studies',
      casesText: 'Real results from teams using personalized video to build pipeline.',
      cases: [
        { photo: '/landing-art/07/case1.webp', brand: 'NorthPeak Digital', logo: '/landing-art/07/cl1.webp', value1: '+317%', label1: 'More Replies', value2: '+4.2x', label2: 'Booked Meetings' },
        { photo: '/landing-art/07/case2.webp', brand: 'Brightside Media', logo: '/landing-art/07/cl2.webp', value1: '+268%', label1: 'Lead Conversion', value2: '+6.1x', label2: 'Pipeline Value' },
      ],
      quote: 'This completely changed our outreach. The personalized videos feel high-touch, but we’re sending them at scale and booking more meetings than ever.',
      quoteName: 'Jordan Ellis',
      quoteRole: 'CEO, ScaleHouse Agency',
      quotePhoto: '/landing-art/07/jordan.webp',
      pipelineTitle: 'Your Lead Pipeline, Visualized',
      pipelineText: 'From contacts to conversations to closed deals.',
      steps: [
        { icon: 'users', label: 'Import Contacts' }, { icon: 'play', label: 'Create Personalized Videos' }, { icon: 'send', label: 'Launch Outreach' },
        { icon: 'calendar', label: 'Book Meetings' }, { icon: 'chart', label: 'Fill Your Pipeline' },
      ],
    },
    render: (p) => {
      const t = useTokens();
      return (
        <section className="pk-px-proof">
          <div className="pk-px-cases">
            <h2 className="pk-px-h2">{t(p.casesTitle)}</h2>
            <p>{t(p.casesText)}</p>
            <ul>
              {asList(p.cases).map((c, i) => (
                <li key={i}>
                  <Pic src={c.photo} className="pk-px-case-photo" />
                  <div className="pk-px-case-stats">
                    <span><b>{t(c.value1)}</b>{t(c.label1)}</span>
                    <span><b>{t(c.value2)}</b>{t(c.label2)}</span>
                  </div>
                  <div className="pk-px-case-brand"><Pic src={c.logo} className="pk-px-case-logo" /><b>{t(c.brand)}</b></div>
                </li>
              ))}
            </ul>
          </div>
          <figure className="pk-px-quote">
            <blockquote>{t(p.quote)}</blockquote>
            <figcaption>
              <Pic src={p.quotePhoto} className="pk-px-avatar" />
              <span><b>{t(p.quoteName)}</b><small>{t(p.quoteRole)}</small></span>
              <span className="pk-px-stars" aria-hidden="true">{'★★★★★'}</span>
            </figcaption>
          </figure>
          <div className="pk-px-pipe">
            <h2 className="pk-px-h2">{t(p.pipelineTitle)}</h2>
            <p>{t(p.pipelineText)}</p>
            <ol>
              {asList(p.steps).map((s, i) => <li key={i}><Icon name={s.icon || 'check'} className="pk-ico pk-ico--lg" /><span>{t(s.label)}</span></li>)}
            </ol>
          </div>
        </section>
      );
    },
  },

  PosterCta: {
    label: 'Poster: import dropzone and final call to action',
    fields: {
      heading: T('Heading'), text: A('Text'), dropTitle: T('Dropzone title'), dropHint: T('Dropzone hint'),
      checks: { type: 'array', label: 'Tick list', arrayFields: { text: T('Text') }, getItemSummary: (i) => i.text || 'Item', defaultItemProps: { text: 'Item' } },
      ctaTitle: T('Call to action headline'),
      buttons: { type: 'array', label: 'Buttons', arrayFields: { label: T('Text'), url: T('Link (https, mailto: or tel:)'), style: { type: 'radio', label: 'Style', options: [{ label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }] } }, getItemSummary: (i) => i.label || 'Button', defaultItemProps: { label: 'Button', url: '', style: 'secondary' } },
    },
    defaultProps: {
      heading: 'Bring Your Contacts. We’ll Do the Rest.',
      text: 'Import your existing leads and instantly create personalized video outreach campaigns.',
      dropTitle: 'Import Contacts', dropHint: 'Drag & drop a CSV, or click to upload',
      checks: [{ text: 'Works with your existing contact lists' }, { text: 'Map personalized fields (name, company, etc.)' }, { text: 'Launch your first campaign in minutes' }],
      ctaTitle: 'Ready to Turn More Contacts into Customers?',
      buttons: [{ label: 'Get Started Free', url: 'https://example.com/start', style: 'primary' }, { label: 'Book a Strategy Call', url: 'https://example.com/book', style: 'secondary' }],
    },
    render: (p) => {
      const t = useTokens();
      return (
        <section className="pk-px-cta">
          <div className="pk-px-cta-left">
            <div className="pk-px-cta-copy"><h2 className="pk-px-h2">{t(p.heading)}</h2><p>{t(p.text)}</p></div>
            <div className="pk-px-drop"><Icon name="video" className="pk-ico pk-px-drop-ico" /><b>{t(p.dropTitle)}</b><small>{t(p.dropHint)}</small></div>
            <ul className="pk-px-checks">{asList(p.checks).map((c, i) => <li key={i}><Icon name="check" className="pk-ico" /><span>{t(c.text)}</span></li>)}</ul>
          </div>
          <div className="pk-px-cta-right">
            <p className="pk-px-cta-title">{t(p.ctaTitle)}</p>
            <div className="pk-px-cta-btns">{asList(p.buttons).map((b, i) => <SafeLink key={i} className={`pk-px-btn pk-px-btn--${b.style === 'primary' ? 'primary' : 'secondary'}`} href={b.url}>{t(b.label)}</SafeLink>)}</div>
          </div>
        </section>
      );
    },
  },
};
