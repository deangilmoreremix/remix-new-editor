/** Design 07 "Street poster" extras: feature row, case studies + quote + chevron pipeline, import dropzone + final CTA. Sample copy only. */
import { useState } from 'react';
import { AccentText, Icon, SafeLink, useTokens } from '../components.jsx';
import { safeImageUrl } from '../../templates.js';

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const asList = (v) => (Array.isArray(v) ? v : []);
const art = (src) => safeImageUrl(src) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(src || '')) ? String(src) : '');
const iconField = { type: 'select', label: 'Icon', options: ['video', 'bolt', 'target', 'layers', 'users', 'play', 'send', 'calendar', 'chart', 'check', 'star', 'mail'].map((k) => ({ label: k, value: k })) };
// Decorative by default (logos and faces beside their own names); a described photo is exposed to screen readers.
const Pic = ({ src, className, alt }) => { const u = art(src); return u ? <img className={className} src={u} alt={alt || ''} loading="lazy" /> : null; };

export const components = {
  PosterNav: {
    label: 'Poster: top bar with brand tagline',
    fields: {
      brand: T('Brand name'), tagline: T('Tagline next to the brand'), logo: T('Logo (path or https link)'),
      links: { type: 'array', label: 'Menu links', arrayFields: { label: T('Text'), url: T('Link (https, #lead, #video)') }, getItemSummary: (i) => i.label || 'Link', defaultItemProps: { label: 'Link', url: '' } },
      ctaLabel: T('Button text'), ctaUrl: T('Button link (#lead, https...)'),
    },
    defaultProps: {
      brand: 'SmartVideo AI', tagline: 'Personalized video for growth', logo: '/landing-art/07/logo.webp',
      links: ['How It Works', 'Case Studies', 'Features', 'Pricing', 'Resources'].map((label) => ({ label, url: '' })),
      ctaLabel: 'Book a Strategy Call', ctaUrl: '#lead',
    },
    render: (p) => {
      const t = useTokens();
      return (
        <nav className="pk-nav pk-px-nav" aria-label="Site">
          <a className="pk-brand" href="#top"><Pic src={p.logo} className="pk-px-logo" /><span>{t(p.brand)}</span></a>
          {p.tagline ? <span className="pk-px-tagline">{t(p.tagline)}</span> : null}
          <ul className="pk-nav-links">{asList(p.links).map((l, i) => <li key={i}><SafeLink href={l.url}>{t(l.label)}</SafeLink>{l.url ? null : <span>{t(l.label)}</span>}</li>)}</ul>
          <div className="pk-nav-right">{p.ctaLabel ? <SafeLink className="pk-btn pk-btn--primary pk-nav-cta" href={p.ctaUrl || '#lead'}>{t(p.ctaLabel)}</SafeLink> : null}</div>
        </nav>
      );
    },
  },

  PosterLogos: {
    label: 'Poster: trusted-by logo strip',
    fields: {
      title: T('Title'),
      items: { type: 'array', label: 'Logos', arrayFields: { logo: T('Logo icon (path or https link)'), name: T('Name'), sub: T('Small label under the name') }, getItemSummary: (i) => i.name || 'Logo', defaultItemProps: { logo: '', name: 'Name', sub: '' } },
    },
    defaultProps: {
      title: 'Trusted by growth-focused agencies & brands',
      items: [['NorthPeak', 'Digital'], ['Brightside', 'Media'], ['ScaleHouse', 'Agency'], ['Momentum', 'Creative'], ['LaunchLab', 'Growth']].map(([name, sub], i) => ({ logo: `/landing-art/07/logo${i + 1}.webp`, name, sub })),
    },
    render: (p) => {
      const t = useTokens();
      return (
        <section className="pk-strip pk-px-logos">
          {p.title ? <p className="pk-strip-title">{t(p.title)}</p> : null}
          <ul className="pk-strip-row">{asList(p.items).map((it, i) => <li key={i} className="pk-px-logo-item"><Pic src={it.logo} className="pk-px-logo-img" /><span><b>{t(it.name)}</b>{it.sub ? <small>{t(it.sub)}</small> : null}</span></li>)}</ul>
        </section>
      );
    },
  },
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
      cases: { type: 'array', label: 'Case studies', arrayFields: { photo: T('Photo (path or https link)'), photoAlt: T('Screen-reader description (alt text)'), brand: T('Agency name'), logo: T('Agency logo (path or https link)'), value1: T('Number 1'), label1: T('Label 1'), value2: T('Number 2'), label2: T('Label 2') }, getItemSummary: (i) => i.brand || 'Case', defaultItemProps: { photo: '', brand: 'Agency', logo: '', value1: '+100%', label1: 'Result', value2: '+2x', label2: 'Result' } },
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
            <AccentText as="h2" className="pk-px-h2" text={p.casesTitle} />
            <p>{t(p.casesText)}</p>
            <ul>
              {asList(p.cases).map((c, i) => (
                <li key={i}>
                  <Pic src={c.photo} alt={t(c.photoAlt)} className="pk-px-case-photo" />
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
            <AccentText as="h2" className="pk-px-h2" text={p.pipelineTitle} />
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
      buttons: [{ label: 'Get Started Free', url: '#lead', style: 'primary' }, { label: 'Book a Strategy Call', url: '#lead', style: 'secondary' }],
    },
    render: (p) => <PosterCtaView {...p} />,
  },
};

function PosterCtaView(p) {
  const t = useTokens();
  const [picked, setPicked] = useState('');
  return (
        <section className="pk-px-cta">
          <div className="pk-px-cta-left">
            <div className="pk-px-cta-copy"><AccentText as="h2" className="pk-px-h2" text={p.heading} /><p>{t(p.text)}</p></div>
            <label className="pk-px-drop">
              <input className="pk-px-drop-input" type="file" accept=".csv,.xls,.xlsx,text/csv" onChange={(e) => setPicked(e.target.files?.[0]?.name || '')} />
              <Icon name="video" className="pk-ico pk-px-drop-ico" /><b>{t(p.dropTitle)}</b><small>{picked || t(p.dropHint)}</small>
            </label>
            <ul className="pk-px-checks">{asList(p.checks).map((c, i) => <li key={i}><Icon name="check" className="pk-ico" /><span>{t(c.text)}</span></li>)}</ul>
          </div>
          <div className="pk-px-cta-right">
            <AccentText as="p" className="pk-px-cta-title" text={p.ctaTitle} />
            <div className="pk-px-cta-btns">{asList(p.buttons).map((b, i) => <SafeLink key={i} className={`pk-px-btn pk-px-btn--${b.style === 'primary' ? 'primary' : 'secondary'}`} href={b.url}>{t(b.label)}</SafeLink>)}</div>
          </div>
        </section>
  );
}
