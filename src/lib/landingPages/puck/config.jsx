/** Puck configuration: the components an editor can add, and the fields that edit each one. */
import { Hero } from './components.jsx';

export const puckConfig = {
  root: {
    fields: {
      accent: { type: 'text', label: 'Accent colour (#hex)' },
      background: { type: 'text', label: 'Page background (#hex)' },
      text: { type: 'text', label: 'Text colour (#hex)' },
    },
    defaultProps: { accent: '#2563eb', background: '#ffffff', text: '#0f172a' },
    render: ({ children, accent, background, text }) => {
      const ok = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : d);
      return (
        <div className="pk-page" style={{ '--pk-accent': ok(accent, '#2563eb'), '--pk-bg': ok(background, '#ffffff'), '--pk-text': ok(text, '#0f172a') }}>
          {children}
        </div>
      );
    },
  },
  components: {
    Hero: {
      label: 'Hero (headline, video, form)',
      fields: {
        eyebrow: { type: 'text', label: 'Small label above the headline' },
        headline: { type: 'textarea', label: 'Headline (wrap words in [[double brackets]] to highlight)' },
        subhead: { type: 'textarea', label: 'Sub-headline' },
        bullets: { type: 'array', label: 'Tick list', arrayFields: { text: { type: 'text', label: 'Text' } }, getItemSummary: (i) => i.text || 'Item' },
        chip: { type: 'text', label: 'Label on the video' },
        photo: { type: 'text', label: 'Placeholder image (https link)' },
        formTitle: { type: 'text', label: 'Form title' },
        formSubtitle: { type: 'text', label: 'Form subtitle' },
        submitLabel: { type: 'text', label: 'Form button text' },
        ctaLabel: { type: 'text', label: 'Extra button text' },
        ctaUrl: { type: 'text', label: 'Extra button link (https)' },
      },
      defaultProps: {
        eyebrow: 'A video made for you',
        headline: 'Hi {{firstname|there}}, here is a smarter way to [[grow your business.]]',
        subhead: 'Press play for a short video, then tell us what you think.',
        bullets: [{ text: 'Made for {{company|your team}}' }, { text: 'Takes two minutes' }],
        chip: 'Hi {{firstname|there}}!',
        photo: '',
        formTitle: 'Want to talk it through?',
        formSubtitle: 'Leave your details and we will be in touch.',
        submitLabel: 'Send',
        ctaLabel: '',
        ctaUrl: '',
      },
      render: (props) => <Hero {...props} />,
    },
  },
};
