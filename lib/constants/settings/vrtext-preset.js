// eslint-disable-next-line no-unused-vars
import React from 'react';

export const VRTEXT_PRESET = 'text';
export const BASIC = 'BASIC';
export const ADVANCED = 'ADVANCED';
export const SCRIPT = 'SCRIPT';

// TODO: delete this constant after creating a manifest for new trackEvent
export const INITIAL_VALUES = {
  type: VRTEXT_PRESET,
  popcornOptions: {
    text: 'Default text',
    linkUrl: 'https://example.com',
    callNotifyAddress: 'example',
    position: 'custom',
    alignment: 'center',
    transition: 'popcorn-fade-in',
    rotation: 0,
    fontSize: 8,
    fontColor: '#ffffff',
    shadow: false,
    shadowColor: '#444444',
    background: false,
    backgroundColor: '#14ebca',
    stroke: false,
    end: 0.05,
    start: 0,
    strokeColor: '#000000',
    fontDecorations: {
      bold: true,
    },
    left: 20,
    top: 20,
    width: 40,
    height: 40,
    zindex: 1000,
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
