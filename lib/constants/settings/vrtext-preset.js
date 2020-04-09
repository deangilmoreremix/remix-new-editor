// eslint-disable-next-line no-unused-vars
import React from 'react';

export const VRTEXT_PRESET = 'text';
export const FONT_FAMILY = 'fontFamily';
export const FONT_SIZE = 'fontSize';
export const FONT_DECORATIONS = 'fontDecorations';
export const FONT_DECORATIONS_BOLD = 'bold';
export const FONT_DECORATIONS_ITALIC = 'italics';
export const FONT_COLOR = 'fontColor';
export const ALIGNMENT = 'alignment';
export const SHADOW = 'shadow';
export const STROKE = 'stroke';
export const BACKGROUND = 'background';
export const SHADOW_COLOR = 'shadowColor';
export const STROKE_COLOR = 'strokeColor';
export const BACKGROUND_COLOR = 'backgroundColor';
export const SCALE_TO_FIT = 'scaleToFit';
export const INPUT_TEXT_ROTATION = 'rotation';
export const LINK_URL = 'linkUrl';
export const TEXT = 'text';
export const START = 'start';
export const END = 'end';
export const CALL_TO_NOTIFY = 'callNotifyAddress';
export const OPEN_LINK = 'linkTarget';

export const fontsList = [
  'Kanit',
  'Russo One',
  'Beth Ellen',
  'Exo 2',
  'Italianno',
  'Fjalla One',
  'Gentium Book Basic',
  'Source Sans Pro',
  'Poppins',
  'Squada One',
  'Lato',
  'Questrial',
  'Sintony',
  'Lora',
  'Roboto',
  'Khula',
  'Yanone Kaffeesatz',
  'Syncopate',
  'Economica',
  'Vollkorn',
  'Rajdhani',
  'Merriweather',
  'Ek Mukta',
  'Merriweather Sans',
  'Istok Web',
  'Metrophobic',
  'Montserrat',
  'Gravitas One',
  'PT Sans',
  'Open Sans',
  'Oswald',
  'Palanquin',
  'Bangers',
  'Fredoka One',
  'Covered By Your Grace',
  'Coda',
  'Bowlby One SC',
  'Titan One',
  'Bevan',
  'Teko',
  'Tienne',
  'Alfa Slab One',
  'Martel Sans',
  'Raleway',
  'Fredericka the Great',
  'Cabin Sketch',
  'Special Elite',
  'Anton',
  'Zeyada',
  'La Belle Aurore',
  'Homemade Apple',
  'Crete Round',
  'Palanquin Dark',
  'Dawning of a New Day',
  'Give You Glory',
  'Indie Flower',
  'Just Me Again Down Here',
  'Over the Rainbow',
  'Permanent Marker',
  'Reenie Beanie',
  'Rock Salt',
  'Waiting for the Sunrise',
  'Walter Turncoat',
  'Vast Shadow',
  'Lily Script One',
  'Cookie',
];

export const BASIC = 'BASIC';
export const ADVANCED = 'ADVANCED';
export const SCRIPT = 'SCRIPT';

// TODO: delete this constant after creating a manifest for new trackEvent
export const INITIAL_VALUES = {
  type: VRTEXT_PRESET,
  popcornOptions: {
    text: 'Default text',
    linkUrl: 'https://example.com',
    linkTarget: '_blank',
    callNotifyAddress: 'example',
    position: 'custom',
    alignment: 'center',
    transition: 'popcorn-fade-in',
    rotation: 0,
    fontFamily: 'Anton',
    fontSize: 8,
    fontColor: '#ffffff',
    shadow: false,
    shadowColor: '#444444',
    background: false,
    stroke: false,
    end: 5,
    start: 0,
    strokeColor: '#000000',
    fontDecorations: {
      bold: false,
      italics: false,
      responsive: true,
    },
    left: 20,
    top: 20,
    width: 40,
    height: 40,
    zindex: 1000,
  },
};

export const ADVANCED_FIELDS = {
  [FONT_FAMILY]: {
    items: fontsList,
    label: 'Font',
    type: 'select',
    itemClass: 'item-select',
  },
  [FONT_SIZE]: {
    label: 'Font Size',
    type: 'slider',
    sliderWidth: 300,
  },
  [FONT_DECORATIONS]: {
    [FONT_DECORATIONS_BOLD]: {
      label: 'Bold',
      type: 'checkbox',
    },
    [FONT_DECORATIONS_ITALIC]: {
      label: 'Italic',
      type: 'checkbox',
    },
  },
  [ALIGNMENT]: {
    items: [{ position: 'Top' }, { position: 'Start' }, { position: 'End' }],
    type: 'radio',
  },
  [FONT_COLOR]: {
    label: 'Font Color',
    type: 'color',
  },
  [SHADOW]: {
    label: 'Shadow',
    type: 'checkbox',
  },
  [STROKE]: {
    stroke: {
      label: 'Outline',
      type: 'checkbox',
    },
  },
  [BACKGROUND]: {
    label: 'Background',
    type: 'checkbox',
  },
  [SHADOW_COLOR]: {
    label: 'Shadow',
    type: 'color',
  },
  [BACKGROUND_COLOR]: {
    label: 'Background',
    type: 'color',
  },
  [STROKE_COLOR]: {
    label: 'Outline',
    type: 'color',
  },
  [SCALE_TO_FIT]: {
    label: 'Scale to fit',
    type: 'checkbox',
  },
  [INPUT_TEXT_ROTATION]: {
    label: 'Rotation',
    type: 'inputTextRotation',
  },
  [LINK_URL]: {
    label: 'Link Url or Phone number',
    type: 'input',
  },
  [CALL_TO_NOTIFY]: {
    label: 'Email to notify about call attempt',
    type: 'input',
  },
  [TEXT]: {
    label: 'Text',
    type: 'textarea',
    rows: '5',
    variant: 'outlined',
  },
  [START]: {
    type: 'input',
  },
  [END]: {
    type: 'input',
  },
  [OPEN_LINK]: {
    items: ['New Tab', 'Current Tab'],
    values: ['_blank', '_parent'],
    type: 'select',
    containerClass: 'open-link',
    labelWidth: 0,
  },
};

export const TABS = [
  { label: BASIC },
  { label: ADVANCED },
  {
    label: SCRIPT,
    disabled: true,
  },
];
