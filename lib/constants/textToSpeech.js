export const ENGINE_TYPE_VALUES = {
  STANDART: 'standard',
  NEURAL: 'neural',
};

export const LANGUAGES_VALUES = {
  ENUS: 'en-US',
  ENUS_STANDART: `en-US-${ENGINE_TYPE_VALUES.STANDART}`,
  ENUS_NEURAL: `en-US-${ENGINE_TYPE_VALUES.NEURAL}`,
  ENAU: 'en-AU',
  ENGB: 'en-GB',
  ENGBWLS: 'en-GB-WLS',
};

export const VOICES = {
  [LANGUAGES_VALUES.ENUS_STANDART]: [
    { label: 'Ivy/Female (child)', value: 'Ivy' },
    { label: 'Joanna/Female', value: 'Joanna' },
    { label: 'Kendra/Female', value: 'Kendra' },
    { label: 'Kimberly/Female', value: 'Kimberly' },
    { label: 'Salli/Female', value: 'Salli' },
    { label: 'Joey/Male', value: 'Joey' },
    { label: 'Justin/Male (child)', value: 'Justin' },
    { label: 'Matthew/Male', value: 'Matthew' },
  ],
  [LANGUAGES_VALUES.ENUS_NEURAL]: [
    { label: 'Ivy/Female (child)', value: 'Ivy' },
    { label: 'Joanna/Female', value: 'Joanna' },
    { label: 'Kendra/Female', value: 'Kendra' },
    { label: 'Kimberly/Female', value: 'Kimberly' },
    { label: 'Salli/Female', value: 'Salli' },
    { label: 'Joey/Male', value: 'Joey' },
    { label: 'Justin/Male (child)', value: 'Justin' },
    { label: 'Kevin/Male (child)', value: 'Kevin' },
    { label: 'Matthew/Male', value: 'Matthew' },
  ],
  [LANGUAGES_VALUES.ENAU]: [
    { label: 'Nicole/Female', value: 'Nicole' },
    { label: 'Russell/Male', value: 'Russell' },
  ],
  [LANGUAGES_VALUES.ENGB]: [
    { label: 'Amy/Female', value: 'Amy' },
    { label: 'Emma/Female', value: 'Emma' },
    { label: 'Brian/Male', value: 'Brian' },
  ],
  [LANGUAGES_VALUES.ENGBWLS]: [
    { label: 'Geraint/Male', value: 'Geraint' },
  ],
};

export const DEFAULT_VOICES = {
  [ENGINE_TYPE_VALUES.STANDART]: VOICES[LANGUAGES_VALUES.ENUS_STANDART],
  [ENGINE_TYPE_VALUES.NEURAL]: VOICES[LANGUAGES_VALUES.ENUS_NEURAL],
};

export const LANGUAGES_PRO = [
  { label: 'English', value: 'en-US' },
  { label: 'English (British)', value: 'en-GB' },
  { label: 'Portuguese (Brazilian)', value: 'pt-BR' },
  { label: 'US Spanish', value: 'es-US' },
];

export const LANGUAGES = [
  { label: 'English', value: 'en-US' },
  { label: 'English (Australian)', value: 'en-AU' },
  { label: 'English (British)', value: 'en-GB' },
  { label: 'English (Welsh)', value: 'en-GB-WLS' },
];

export const engineType = [
  {
    value: ENGINE_TYPE_VALUES.STANDART,
    label: 'Standart Voice',
    position: 'start',
    icon: '',
    checkedIcon: '',
  },
  {
    value: ENGINE_TYPE_VALUES.NEURAL,
    label: 'PRO Voice',
    position: 'start',
    icon: '',
    checkedIcon: '',
  },
];

export const maxSymbols = {
  text: 150,
  personalized: 70,
};
