/** Mono editorial extras: logo + results strip, intro with icon features, and the three info panels. Sample copy only. */
import { useTokens } from '../components.jsx';
import { safeImageUrl } from '../../templates.js';

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const arr = (label, arrayFields, defaultItemProps, summary) => ({ type: 'array', label, arrayFields, defaultItemProps, getItemSummary: (i) => i[summary] || 'Item' });
const img = (src) => safeImageUrl(src) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(src || '')) ? src : '');
const list = (v) => (Array.isArray(v) ? v : []);
const Img = ({ src, ...rest }) => (img(src) ? <img src={img(src)} alt="" aria-hidden="true" {...rest} /> : null);

function Proof({ title, logos, stats }) {
  const t = useTokens();
  return (
    <section className="mn-proof">
      <p className="mn-proof-title">{t(title)}</p>
      <ul className="mn-logos">{list(logos).map((l, i) => <li key={i}><Img src={l.icon} width="24" height="22" /><span>{t(l.name)}</span></li>)}</ul>
      <ul className="mn-stats">{list(stats).map((s, i) => <li key={i}><b>{t(s.value)}</b><span>{t(s.label)}</span></li>)}</ul>
    </section>
  );
}

function Intro({ eyebrow, title, text, features }) {
  const t = useTokens();
  return (
    <section className="mn-intro">
      <div className="mn-intro-head">
        {eyebrow ? <span className="pk-eyebrow-plain">{t(eyebrow)}</span> : null}
        <h2>{t(title)}</h2>
        {text ? <p>{t(text)}</p> : null}
      </div>
      <ul className="mn-feats">{list(features).map((f, i) => <li key={i}><Img src={f.icon} width="36" height="32" /><b>{t(f.title)}</b><span>{t(f.text)}</span></li>)}</ul>
    </section>
  );
}

function Panels(p) {
  const t = useTokens();
  return (
    <section className="mn-panels">
      <article className="mn-panel mn-quotes">
        <h3>{t(p.quotesTitle)}</h3>
        <div className="mn-quote-row">
          {list(p.quotes).map((q, i) => (
            <figure key={i}>
              <blockquote>{`“${t(q.text)}”`}</blockquote>
              <figcaption><Img src={q.avatar} width="36" height="36" className="mn-av" /><span><b>{t(q.name)}</b><small>{t(q.role)}</small></span></figcaption>
            </figure>
          ))}
        </div>
      </article>
      <article className="mn-panel mn-dash">
        <h3>{t(p.dashTitle)}</h3>
        <div className="mn-win">
          <div className="mn-side">
            <b className="mn-side-brand">{t(p.dashBrand)}</b>
            <ul>{list(p.dashMenu).map((m, i) => <li key={i} className={i === 0 ? 'is-on' : ''}>{t(m.label)}</li>)}</ul>
          </div>
          <div className="mn-main">
            <div className="mn-main-bar"><b>{t(p.dashHeading)}</b><span>{t(p.dashRange)}</span></div>
            <div className="mn-kpis">{list(p.kpis).map((k, i) => <div key={i}><small>{t(k.label)}</small><b>{t(k.value)}</b><em>{t(k.delta)}</em></div>)}</div>
            <Img src={p.chart} className="mn-chart" />
          </div>
        </div>
      </article>
      <article className="mn-panel mn-check">
        <h3>{t(p.checkTitle)}</h3>
        <ul>{list(p.checks).map((c, i) => <li key={i} className={c.done === 'yes' ? 'is-done' : ''}><i aria-hidden="true" /><span>{t(c.label)}</span></li>)}</ul>
      </article>
    </section>
  );
}

export const components = {
  MonoProof: {
    label: 'Mono: logos and results strip',
    fields: { title: T('Label'), logos: arr('Logos', { name: T('Name'), icon: T('Icon image link') }, { name: 'Brand', icon: '' }, 'name'), stats: arr('Results', { value: T('Number'), label: T('Label') }, { value: '0%', label: 'Label' }, 'value') },
    defaultProps: { title: 'Trusted by growth-focused teams', logos: [{ name: 'Brand', icon: '' }], stats: [{ value: '3.8×', label: 'Higher opt-in rate' }] },
    render: (p) => <Proof {...p} />,
  },
  MonoIntro: {
    label: 'Mono: intro with four features',
    fields: { eyebrow: T('Small label'), title: T('Title'), text: A('Text'), features: arr('Features', { icon: T('Icon image link'), title: T('Title'), text: A('Text') }, { icon: '', title: 'Feature', text: '' }, 'title') },
    defaultProps: { eyebrow: 'Build a high-quality list', title: 'Convert Viewers Into Leads', text: 'Say what you do.', features: [{ icon: '', title: 'Feature', text: 'Describe it.' }] },
    render: (p) => <Intro {...p} />,
  },
  MonoPanels: {
    label: 'Mono: testimonials, dashboard and checklist',
    fields: {
      quotesTitle: T('Testimonials heading'),
      quotes: arr('Testimonials', { text: A('Quote'), name: T('Name'), role: T('Role / company'), avatar: T('Photo link') }, { text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company', avatar: '' }, 'name'),
      dashTitle: T('Dashboard heading'), dashBrand: T('Dashboard brand'), dashHeading: T('Dashboard title'), dashRange: T('Date range'),
      dashMenu: arr('Dashboard menu', { label: T('Label') }, { label: 'Item' }, 'label'),
      kpis: arr('Dashboard numbers', { label: T('Label'), value: T('Number'), delta: T('Change') }, { label: 'Label', value: '0', delta: '' }, 'label'),
      chart: T('Chart image link'),
      checkTitle: T('Checklist heading'),
      checks: arr('Checklist', { label: T('Text'), done: { type: 'radio', label: 'Ticked', options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] } }, { label: 'Item', done: 'yes' }, 'label'),
    },
    defaultProps: { quotesTitle: 'What our customers say', quotes: [], dashTitle: 'Your leads at a glance', dashBrand: 'Brand', dashHeading: 'Dashboard', dashRange: 'Last 30 days', dashMenu: [{ label: 'Dashboard' }], kpis: [], chart: '', checkTitle: 'Checklist', checks: [] },
    render: (p) => <Panels {...p} />,
  },
};
