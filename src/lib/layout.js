export const POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export const SIZES = ['small', 'medium', 'large', 'huge'];

export const ALIGNS = ['left', 'center', 'right'];

export function defaultLayout(headline, body, cta, fontFamily) {
  return {
    headline: {
      text: headline,
      position: 'bottom-left',
      size: 'huge',
      color: '#ffffff',
      fontFamily,
      align: 'left',
      bg: null,
    },
    body: {
      text: body,
      position: 'bottom-left',
      size: 'small',
      color: '#ffffff',
      fontFamily,
      align: 'left',
      bg: null,
    },
    cta: {
      text: cta,
      position: 'bottom-left',
      size: 'medium',
      color: '#000000',
      fontFamily,
      align: 'left',
      bg: '#ffffff',
    },
  };
}
