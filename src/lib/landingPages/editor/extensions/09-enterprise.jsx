/** Enterprise navy extras: three-column feature row, security badge strip and a testimonial row (all text is editable; all sample copy). */
import { EmailSignup, Icon, SafeLink, useTokens } from '../components.jsx';
import { ICON_KEYS } from '../../siteIcons.js';
import { safeImageUrl } from '../../templates.js';

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const iconField = { type: 'select', label: 'Icon', options: ICON_KEYS.map((k) => ({ label: k, value: k })) };
const list = (v) => (Array.isArray(v) ? v : []);
const MARKS = [{ label: 'None', value: '' }, { label: 'Cloud (blue)', value: 'cloud' }, { label: 'Four squares', value: 'squares' }, { label: 'Sprocket (orange)', value: 'sprocket' }];
function Mark({ kind }) {
  if (kind === 'cloud') return <svg className="ent-mark" viewBox="0 0 64 44" aria-hidden="true"><path fill="#1ea1df" d="M20 8c4-4 11-4 15 1 4-3 11-2 13 4 7 0 12 6 11 12-1 7-7 11-13 10H15C7 35 3 29 5 23c1-4 4-6 8-6 0-4 3-7 7-9z" /></svg>;
  if (kind === 'squares') return <svg className="ent-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#f25022" d="M1 1h10v10H1z" /><path fill="#7fba00" d="M13 1h10v10H13z" /><path fill="#00a4ef" d="M1 13h10v10H1z" /><path fill="#ffb900" d="M13 13h10v10H13z" /></svg>;
  if (kind === 'sprocket') return <svg className="ent-mark" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#ff7a59" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="14" r="4.5" /><path d="M12 9.5V3M18 6l-4 4" /></g><circle cx="12" cy="3" r="1.8" fill="#ff7a59" /><circle cx="19" cy="5.5" r="1.8" fill="#ff7a59" /></svg>;
  return null;
}
const img = (src) => safeImageUrl(src) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(src || '')) ? src : '');

function EnterpriseColumns(p) {
  const t = useTokens();
  return (
    <section className="ent-cols">
      <div className="ent-col ent-col--list">
        <div className="ent-col-main">
          {p.listEyebrow ? <span className="ent-eyebrow">{t(p.listEyebrow)}</span> : null}
          <h2 className="ent-h">{t(p.listTitle)}</h2>
          {p.listText ? <p className="ent-p">{t(p.listText)}</p> : null}
          <ul className="ent-ticks">{list(p.checks).map((c, i) => <li key={i}><Icon name="check" className="ent-tick" /><span>{t(c.text)}</span></li>)}</ul>
        </div>
        <div className="ent-paper">
          <div className="ent-cover" aria-hidden="true">{p.cardTag ? <small>{t(p.cardTag)}</small> : null}<b>{t(p.cardCover)}</b></div>
          <div className="ent-paper-body">
            <h3>{t(p.cardTitle)}</h3>
            {p.cardText ? <p>{t(p.cardText)}</p> : null}
            <EmailSignup placeholder={p.cardPlaceholder} label={p.cardButton || 'Download Now'} source={p.cardTitle} className="ent-dl" />
          </div>
        </div>
      </div>
      <div className="ent-col ent-col--team">
        {p.teamEyebrow ? <span className="ent-eyebrow">{t(p.teamEyebrow)}</span> : null}
        <h2 className="ent-h">{t(p.teamTitle)}</h2>
        <ul className="ent-feats">{list(p.features).map((f, i) => <li key={i}><span className="ent-ico"><Icon name={f.icon || 'check'} /></span><span><b>{t(f.title)}</b><small>{t(f.text)}</small></span></li>)}</ul>
      </div>
      <div className="ent-col ent-col--crm">
        {p.crmEyebrow ? <span className="ent-eyebrow">{t(p.crmEyebrow)}</span> : null}
        <h2 className="ent-h">{t(p.crmTitle)}</h2>
        {p.crmText ? <p className="ent-p">{t(p.crmText)}</p> : null}
        <div className="ent-crm">
          <ul>{list(p.integrations).map((x, i) => <li key={i} className={`ent-int ent-int--${x.mark || 'none'}`}><Mark kind={x.mark} /><span className="ent-int-t"><b>{t(x.name)}</b>{x.sub ? <small>{t(x.sub)}</small> : null}</span></li>)}</ul>
          {p.moreLabel ? (p.moreUrl ? <SafeLink className="ent-more" href={p.moreUrl}>{t(p.moreLabel)}</SafeLink> : <span className="ent-more">{t(p.moreLabel)}</span>) : null}
        </div>
      </div>
    </section>
  );
}

function EnterpriseBadges({ title, items, note }) {
  const t = useTokens();
  return (
    <section className="ent-badges">
      <h2 className="ent-badges-title">{t(title)}</h2>
      <ul className="ent-badges-row">{list(items).map((b, i) => <li key={i}><Icon name={b.icon || 'shield'} className="ent-badge-ico" /><span><b>{t(b.title)}</b><small>{t(b.text)}</small></span></li>)}</ul>
      {note ? <p className="ent-badges-note">{t(note)}</p> : null}
    </section>
  );
}

function EnterpriseTestimonials({ title, text, quotes }) {
  const t = useTokens();
  return (
    <section className="ent-quotes">
      <div className="ent-quotes-intro"><h2 className="ent-h ent-h--lg">{t(title)}</h2>{text ? <p className="ent-p">{t(text)}</p> : null}</div>
      <div className="ent-quotes-row">
        {list(quotes).map((q, i) => (
          <figure key={i} className="ent-quote">
            <blockquote>{`“${t(q.text)}”`}</blockquote>
            <figcaption>
              {img(q.avatar) ? <img src={img(q.avatar)} alt={t(q.avatarAlt) || ''} width="44" height="44" loading="lazy" /> : <i className="ent-initial">{String(q.name || '?').slice(0, 1)}</i>}
              <span><b>{t(q.name)}</b><small>{t(q.role)}</small></span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export const components = {
  EnterpriseColumns: {
    label: 'Enterprise: three columns (list-building, workflow, CRM)',
    fields: {
      listEyebrow: T('Column 1: small label'), listTitle: T('Column 1: heading'), listText: A('Column 1: text'),
      checks: { type: 'array', label: 'Column 1: tick list', arrayFields: { text: T('Text') }, getItemSummary: (i) => i.text || 'Item', defaultItemProps: { text: 'New point' } },
      cardTag: T('Download card: label on the cover'), cardCover: T('Download card: cover title'), cardTitle: T('Download card: title'), cardText: A('Download card: text'), cardPlaceholder: T('Download card: email hint'), cardButton: T('Download card: button text'),
      teamEyebrow: T('Column 2: small label'), teamTitle: T('Column 2: heading'),
      features: { type: 'array', label: 'Column 2: features', arrayFields: { icon: iconField, title: T('Title'), text: T('Text') }, getItemSummary: (i) => i.title || 'Feature', defaultItemProps: { icon: 'check', title: 'Feature', text: 'Describe it.' } },
      crmEyebrow: T('Column 3: small label'), crmTitle: T('Column 3: heading'), crmText: A('Column 3: text'),
      integrations: { type: 'array', label: 'Column 3: integration names', arrayFields: { name: T('Name'), sub: T('Second line (optional)'), mark: { type: 'select', label: 'Simple drawn mark', options: MARKS } }, getItemSummary: (i) => i.name || 'Integration', defaultItemProps: { name: 'CRM', sub: '', mark: '' } },
      moreLabel: T('Column 3: link text'), moreUrl: T('Column 3: link (optional)'),
    },
    defaultProps: {
      listEyebrow: 'Build a pipeline', listTitle: 'List-building that fuels outreach', listText: 'Turn engagement into a predictable pipeline.', checks: [{ text: 'Lead capture from demos and events' }],
      cardTag: 'Whitepaper', cardCover: 'The Guide', cardTitle: 'Download the whitepaper', cardText: 'A short guide for your team.', cardPlaceholder: 'Work Email *', cardButton: 'Download Now',
      teamEyebrow: 'Built for teams', teamTitle: 'A collaborative workflow', features: [{ icon: 'users', title: 'Team collaboration', text: 'Keep teams aligned.' }],
      crmEyebrow: 'Connect your stack', crmTitle: 'CRM integration', crmText: 'Keep your data in sync.', integrations: [{ name: 'CRM one', sub: '' }], moreLabel: '+ More integrations', moreUrl: '',
    },
    render: (p) => <EnterpriseColumns {...p} />,
  },
  EnterpriseBadges: {
    label: 'Enterprise: security and compliance badge strip',
    fields: {
      title: T('Heading'),
      items: { type: 'array', label: 'Badges (describe only claims you can back up)', arrayFields: { icon: iconField, title: T('Title'), text: T('Second line') }, getItemSummary: (i) => i.title || 'Badge', defaultItemProps: { icon: 'shield', title: 'Badge', text: 'Detail' } },
      note: T('Closing note'),
    },
    defaultProps: { title: 'Security & compliance', items: [{ icon: 'shield', title: 'Badge', text: 'Detail' }], note: '' },
    render: (p) => <EnterpriseBadges {...p} />,
  },
  EnterpriseTestimonials: {
    label: 'Enterprise: testimonial row',
    fields: {
      title: T('Heading'), text: A('Text under the heading'),
      quotes: { type: 'array', label: 'Testimonials', arrayFields: { text: A('Quote'), name: T('Name'), role: T('Role, company'), avatar: T('Photo (https link or /landing-art/..)'), avatarAlt: T('Screen-reader description (alt text)') }, getItemSummary: (i) => i.name || 'Quote', defaultItemProps: { text: 'A quote you have permission to use.', name: 'Name', role: 'Role, Company', avatar: '' } },
    },
    defaultProps: { title: 'What our customers say', text: '', quotes: [{ text: 'A quote you have permission to use.', name: 'Name', role: 'Role, Company', avatar: '' }] },
    render: (p) => <EnterpriseTestimonials {...p} />,
  },
};
