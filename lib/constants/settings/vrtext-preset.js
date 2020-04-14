// eslint-disable-next-line no-unused-vars
import React from 'react';

export const VRTEXT_PRESET = 'text';
export const BASIC = 'BASIC';
export const ADVANCED = 'ADVANCED';
export const SCRIPT = 'SCRIPT';

// TODO: delete this constant after creating a manifest for new trackEvent
export const INITIAL_VALUES = {
  type: VRTEXT_PRESET,
  text: 'Default text',
  fontSize: 8,
  fontColor: '#000000',
  fontDecorations: {
    bold: false,
  },
  top: 20,
  left: 30,
  width: 40,
  height: 40,
  zindex: 1000,
};

export const TABS = [
  { label: BASIC },
  { label: ADVANCED },
  {
    label: SCRIPT,
    disabled: true,
  },
];
