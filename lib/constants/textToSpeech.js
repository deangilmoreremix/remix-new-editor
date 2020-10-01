export const VOICES = {
  'en-US': [
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
  'en-AU': [
    { label: 'Nicole/Female', value: 'Nicole' },
    { label: 'Russell/Male', value: 'Russell' },
  ],
  'en-GB': [
    { label: 'Amy/Female', value: 'Amy' },
    { label: 'Emma/Female', value: 'Emma' },
    { label: 'Brian/Male', value: 'Brian' },
  ],
  'en-GB-WLS': [
    { label: 'Geraint/Male', value: 'Geraint' },
  ],
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
    value: 'standard',
    label: 'Standart Voice',
    position: 'start',
    icon: '',
    checkedIcon: '',
  },
  {
    value: 'neural',
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
