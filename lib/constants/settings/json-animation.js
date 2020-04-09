export const JSON_ANIMATION = 'json-animation';

export const BASIC = 'BASIC';
export const ADVANCED = 'ADVANCED';
export const SCRIPT = 'SCRIPT';

// TODO: delete this constant after creating a manifest for new trackEvent
export const INITIAL_VALUES = {
  type: JSON_ANIMATION,
  popcornOptions: {
    // url: 'https://vremix-int.s3.amazonaws.com/resources/jsonTemplates/Simple_Lower_Third_13.json',
    url: 'https://vremix-int.s3.amazonaws.com/resources/jsonTemplates/LT_13.json',
    scale: 1,
    start: 2.00,
    end: 10.00,
    colors: null,
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
