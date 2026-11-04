/**
 * End Screens and Connect Form template libraries (upstream toolbar
 * "End Screens" and "Connect": /api/makes/revolution?segment=endScreens|
 * connect). Upstream's templates lived on its old backend, so these are
 * original starter sets built from this editor's own addons. Each template
 * is a preset (items with offsets relative to its start) and inserts as
 * ordinary, fully editable clips through presetToClips.
 *
 * Phone numbers use the 555-01xx range reserved for fiction; links point at
 * example.com. Both are placeholders the user replaces.
 */
import { getAddon } from './registry.js';

const DARK = 'linear-gradient(160deg, #07090d 0%, #10202a 60%, #0b3440 100%)';
const ACCENT = '#22d3ee';

const anim = (inName, outName = 'fadeOut') => ({ in: inName, idle: null, out: outName });

function text(value, geometry, o = {}) {
  return {
    type: 'overlay-text',
    addon: {
      text: value,
      geometry,
      position: 'custom',
      alignment: o.alignment || 'center',
      fontFamily: o.font || 'Montserrat',
      fontSize: o.size || 8,
      fontColor: o.color || '#FFFFFF',
      fontDecorations: { bold: o.bold ?? true, italics: false, responsive: true },
      shadow: !!o.shadow,
      shadowColor: '#000000',
      background: !!o.bg,
      backgroundColor: o.bg || '#000000',
      stroke: false,
      strokeColor: '#000000',
      rotation: 0,
      opacity: 100,
      blendMode: 'normal',
      animation: anim(o.in || 'fadeInUp'),
      linkMode: o.phone ? 'phone' : 'url',
      linkUrl: o.link || '',
      linkTarget: '_blank',
      phoneCountry: '1',
      phoneNumber: o.phone || '',
      callNotifyAddress: '',
    },
  };
}

const wrapper = (background = DARK, styles = '') => ({
  type: 'overlay-background',
  addon: { background: '#07090d', styles: `background: ${background};${styles}`, opacity: 100, blendMode: 'normal' },
});

function cta(buttonText, { phone = '', link = '', animation = 'pulse', color = ACCENT, textColor = '#07090d', left = 50, top = 72, width = 34 } = {}) {
  return {
    type: 'click-to-call',
    flat: {
      buttonText,
      phoneNumber: phone,
      linkUrl: link,
      animation,
      fontFamily: 'Montserrat',
      textColor,
      style: { buttonColor: color, posLeft: left, posTop: top, posWidth: width },
    },
  };
}

function leadForm(heading, fields, ctaText, extra = {}) {
  return {
    type: 'lead-form',
    flat: {
      heading,
      fields,
      ctaText,
      skipButtonEnabled: true,
      ...extra,
      style: { fontFamily: 'Montserrat', backgroundColor: '#0b1218', buttonColor: ACCENT, buttonFontColor: '#07090d', buttonBorderRadius: 8, buttonBottomBorder: ACCENT, captionAlignment: 'center', transition: 'none' },
    },
  };
}

/** Item at `offset` for `duration` seconds. */
const at = (offset, duration, item, trackName) => ({ ...item, offset, duration, ...(trackName ? { trackName } : {}) });

export const END_SCREENS = [
  {
    id: 'es-thanks',
    name: 'Thanks for watching',
    description: 'Big thank-you with a personal sign-off.',
    duration: 6,
    items: [
      at(0, 6, wrapper()),
      at(0.2, 5.8, text('Thanks for watching!', { left: 10, top: 34, width: 80, height: 16 }, { in: 'fadeInDown', font: 'Anton', bold: false })),
      at(0.8, 5.2, text('See you next time, {{firstname}}', { left: 20, top: 54, width: 60, height: 8 }, { color: ACCENT, size: 5 })),
    ],
  },
  {
    id: 'es-subscribe',
    name: 'Subscribe',
    description: 'Ask viewers to subscribe, with an animated button.',
    duration: 6,
    items: [
      at(0, 6, wrapper()),
      at(0.2, 5.8, text('Enjoyed this video?', { left: 15, top: 28, width: 70, height: 14 }, { in: 'zoomIn' })),
      at(0.8, 5.2, cta('Subscribe', { link: 'https://example.com/subscribe', animation: 'ripple', color: '#ef4444', textColor: '#ffffff', top: 62 })),
    ],
  },
  {
    id: 'es-shop',
    name: 'Shop now',
    description: 'Closing offer with a shopping-cart button.',
    duration: 6,
    items: [
      at(0, 6, wrapper('linear-gradient(135deg, #07090d 0%, #1b1030 100%)')),
      at(0.2, 5.8, text('Ready to get started?', { left: 12, top: 24, width: 76, height: 14 }, { in: 'fadeInDown' })),
      at(0.6, 5.4, text('Free shipping on your first order', { left: 22, top: 41, width: 56, height: 7 }, { color: '#fbbf24', size: 4, bold: false })),
      at(1, 5, cta('Shop Now', { link: 'https://example.com/shop', animation: 'cart', color: '#f59e0b', textColor: '#07090d', top: 66 })),
    ],
  },
  {
    id: 'es-watch-next',
    name: 'Watch next',
    description: 'Point viewers to your next video.',
    duration: 6,
    items: [
      at(0, 6, wrapper()),
      at(0.2, 5.8, text('UP NEXT', { left: 35, top: 22, width: 30, height: 7 }, { color: ACCENT, size: 4, in: 'fadeIn' })),
      at(0.5, 5.5, text('Your next video title', { left: 12, top: 34, width: 76, height: 14 }, { in: 'fadeInUp', font: 'Anton', bold: false })),
      at(1, 5, cta('Watch Now', { link: 'https://example.com/next-video', animation: 'play', top: 68 })),
    ],
  },
  {
    id: 'es-follow',
    name: 'Follow us',
    description: 'Clickable website and social links.',
    duration: 7,
    items: [
      at(0, 7, wrapper()),
      at(0.2, 6.8, text('Follow us', { left: 25, top: 18, width: 50, height: 14 }, { in: 'bounceIn', font: 'Anton', bold: false })),
      at(0.7, 6.3, text('example.com', { left: 25, top: 42, width: 50, height: 8 }, { link: 'https://example.com', bg: '#10202a', size: 5 })),
      at(0.9, 6.1, text('Instagram', { left: 25, top: 54, width: 50, height: 8 }, { link: 'https://instagram.com/', bg: '#10202a', size: 5 })),
      at(1.1, 5.9, text('YouTube', { left: 25, top: 66, width: 50, height: 8 }, { link: 'https://youtube.com/', bg: '#10202a', size: 5 })),
    ],
  },
  {
    id: 'es-logo',
    name: 'Brand outro',
    description: 'Brand name and tagline sign-off.',
    duration: 5,
    items: [
      at(0, 5, wrapper('radial-gradient(circle at 50% 45%, #10303a 0%, #07090d 70%)')),
      at(0.2, 4.8, text('YOUR BRAND', { left: 15, top: 36, width: 70, height: 16 }, { in: 'zoomIn', font: 'Anton', bold: false })),
      at(0.9, 4.1, text('Your tagline goes here', { left: 25, top: 55, width: 50, height: 7 }, { color: ACCENT, size: 4, bold: false, in: 'fadeIn' })),
    ],
  },
];

const PHONE = '555 010 0100';

export const CONNECT_FORMS = [
  {
    id: 'cf-call-now',
    name: 'Call us now',
    description: 'Headline and a click-to-call phone button.',
    duration: 8,
    items: [
      at(0, 8, text('Questions? Talk to a real person', { left: 12, top: 22, width: 76, height: 12 }, { shadow: true, in: 'fadeInDown' })),
      at(0.5, 7.5, cta('Call Now', { phone: `+1 ${PHONE}`, animation: 'phone', color: '#34d399', textColor: '#07090d', top: 62 })),
    ],
  },
  {
    id: 'cf-personal-call',
    name: 'Personal call',
    description: 'Personalized greeting with a click-to-call number.',
    duration: 8,
    items: [
      at(0, 8, text('Hi {{firstname}}, let’s talk!', { left: 12, top: 20, width: 76, height: 13 }, { shadow: true, in: 'bounceInDown' })),
      at(0.4, 7.6, text(`Tap to call: (555) 010-0100`, { left: 25, top: 40, width: 50, height: 8 }, { phone: PHONE, bg: '#07090d', color: ACCENT, size: 5 })),
      at(0.8, 7.2, cta('Call Now', { phone: `+1 ${PHONE}`, animation: 'phone', top: 70 })),
    ],
  },
  {
    id: 'cf-book-call',
    name: 'Book a call',
    description: 'Pauses for a lead form, then shows a call button.',
    duration: 8,
    items: [
      at(0, 1, leadForm('Book your free call', [
        { id: 'name', type: 'singleline', label: 'Name', required: true },
        { id: 'email', type: 'email', label: 'Email', required: true },
        { id: 'phone', type: 'number', label: 'Phone' },
      ], 'Book my call')),
      at(1, 7, text('Prefer to talk now?', { left: 20, top: 28, width: 60, height: 10 }, { shadow: true })),
      at(1.4, 6.6, cta('Call Us', { phone: `+1 ${PHONE}`, animation: 'phone', top: 60 })),
    ],
  },
  {
    id: 'cf-quote',
    name: 'Request a quote',
    description: 'Lead form with a message box.',
    duration: 1,
    items: [
      at(0, 1, leadForm('Get your free quote', [
        { id: 'name', type: 'singleline', label: 'Name', required: true },
        { id: 'email', type: 'email', label: 'Email', required: true },
        { id: 'phone', type: 'number', label: 'Phone' },
        { id: 'message', type: 'multiline', label: 'What do you need?' },
      ], 'Send request')),
    ],
  },
  {
    id: 'cf-website',
    name: 'Visit website',
    description: 'Headline with an animated arrow button to your site.',
    duration: 7,
    items: [
      at(0, 7, text('See everything we offer', { left: 14, top: 24, width: 72, height: 12 }, { shadow: true, in: 'fadeInLeft' })),
      at(0.5, 6.5, cta('Visit Website', { link: 'https://example.com', animation: 'arrow', top: 62, width: 40 })),
    ],
  },
  {
    id: 'cf-contact-card',
    name: 'Contact card',
    description: 'Phone (click-to-call), email and website on one card.',
    duration: 8,
    items: [
      at(0, 8, wrapper('linear-gradient(160deg, rgba(7,9,13,.92) 0%, rgba(16,32,42,.92) 100%)', 'border: 2px solid #22d3ee; border-radius: 24px;')),
      at(0.2, 7.8, text('Get in touch', { left: 20, top: 16, width: 60, height: 14 }, { in: 'fadeInDown', font: 'Anton', bold: false })),
      at(0.5, 7.5, text('📞 (555) 010-0100', { left: 22, top: 40, width: 56, height: 9 }, { phone: PHONE, size: 5, bg: '#10202a' })),
      at(0.7, 7.3, text('✉️ hello@example.com', { left: 22, top: 53, width: 56, height: 9 }, { link: 'mailto:hello@example.com', size: 5, bg: '#10202a' })),
      at(0.9, 7.1, text('🌐 example.com', { left: 22, top: 66, width: 56, height: 9 }, { link: 'https://example.com', size: 5, bg: '#10202a' })),
    ],
  },
];

export const TEMPLATE_LIBRARIES = {
  endScreens: { id: 'endScreens', title: 'End Screens', anchor: 'end', templates: END_SCREENS },
  connect: { id: 'connect', title: 'Connect Form', anchor: 'playhead', templates: CONNECT_FORMS },
};

export const getTemplate = (id) => [...END_SCREENS, ...CONNECT_FORMS].find((t) => t.id === id) || null;

/** Template → preset shape presetToClips understands. */
export const templateToPreset = (tpl) => ({ id: tpl.id, name: tpl.name, items: tpl.items });

/** Where a template starts: the timeline end (end screens) or the playhead. */
export function templateStart(tpl, anchor, { playheadSec = 0, timelineSeconds = 60 } = {}) {
  if (anchor === 'end') return Math.max(0, timelineSeconds - tpl.duration);
  return Math.max(0, Math.min(playheadSec, timelineSeconds - Math.min(tpl.duration, timelineSeconds)));
}

/** A standalone project for previewing a template (sample background + its clips). */
export function templatePreviewProject(tpl, presetToClips) {
  const T = Math.max(1, tpl.duration);
  const clips = presetToClips(templateToPreset(tpl), 0, T, 1);
  const tracks = [
    { id: 'pv-bg', type: 'text', name: 'Background', items: [{ id: 'pv-bg-clip', type: 'overlay-background', start: 0, end: T, addon: { background: '#07090d', styles: 'background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #155e75 100%);', opacity: 100, blendMode: 'normal' } }] },
    { id: 'pv-text', type: 'text', name: 'Titles', items: clips },
  ];
  return { timelineSeconds: T, tracks };
}

/** Types a template uses that the registry doesn't know (should be none). */
export function unknownTemplateTypes() {
  return [...END_SCREENS, ...CONNECT_FORMS].flatMap((t) => t.items.map((i) => i.type)).filter((type) => !getAddon(type));
}
