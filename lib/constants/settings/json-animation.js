export const JSON_ANIMATION = 'json-animation';

export const BASIC = 'BASIC';
export const ADVANCED = 'ADVANCED';
export const SCRIPT = 'SCRIPT';

// TODO: delete this constant after creating a manifest for new trackEvent
export const INITIAL_VALUES = {
  type: JSON_ANIMATION,
  popcornOptions: {
    url: 'https://vremix-int.s3.amazonaws.com/resources/jsonTemplates/Simple_Lower_Third_13.json',
    scale: 1,
    start: 0,
    end: 10.00,
    colors: null,
  },
};

export const BASIC_FIELDS = {
  url: {
    label: 'URL',
    type: 'input',
  },
  scale: {
    label: 'Scale',
    type: 'number',
  },
  start: {
    label: 'Start',
    type: 'time',
  },
  end: {
    label: 'End',
    type: 'time',
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
