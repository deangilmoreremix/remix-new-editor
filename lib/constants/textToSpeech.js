import AmyImg from '../../public/static/images/faces/Amy.jpg';
import BrianImg from '../../public/static/images/faces/Brian.jpg';
import EmmaImg from '../../public/static/images/faces/Emma.jpg';
import GeraintImg from '../../public/static/images/faces/Geraint.jpg';
import IvyImg from '../../public/static/images/faces/Ivy.jpg';
import JoannaImg from '../../public/static/images/faces/Joanna.jpg';
import JoeyImg from '../../public/static/images/faces/Joey.jpg';
import JustinImg from '../../public/static/images/faces/Justin.jpg';
import KendraImg from '../../public/static/images/faces/Kendra.jpg';
import KevinImg from '../../public/static/images/faces/Kevin.jpg';
import KimberlyImg from '../../public/static/images/faces/Kimberly.jpg';
import MatthewImg from '../../public/static/images/faces/Matthew.jpg';
import NicoleImg from '../../public/static/images/faces/Nicole.jpg';
import RussellImg from '../../public/static/images/faces/Russell.jpg';
import SalliImg from '../../public/static/images/faces/Salli.jpg';

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
    { label: 'Ivy/Female (child)', value: 'Ivy', img: IvyImg },
    { label: 'Joanna/Female', value: 'Joanna', img: JoannaImg },
    { label: 'Kendra/Female', value: 'Kendra', img: KendraImg },
    { label: 'Kimberly/Female', value: 'Kimberly', img: KimberlyImg },
    { label: 'Salli/Female', value: 'Salli', img: SalliImg },
    { label: 'Joey/Male', value: 'Joey', img: JoeyImg },
    { label: 'Justin/Male (child)', value: 'Justin', img: JustinImg },
    { label: 'Matthew/Male', value: 'Matthew', img: MatthewImg },
  ],
  [LANGUAGES_VALUES.ENUS_NEURAL]: [
    { label: 'Ivy/Female (child)', value: 'Ivy', img: IvyImg },
    { label: 'Joanna/Female', value: 'Joanna', img: JoannaImg },
    { label: 'Kendra/Female', value: 'Kendra', img: KendraImg },
    { label: 'Kimberly/Female', value: 'Kimberly', img: KimberlyImg },
    { label: 'Salli/Female', value: 'Salli', img: SalliImg },
    { label: 'Joey/Male', value: 'Joey', img: JoeyImg },
    { label: 'Justin/Male (child)', value: 'Justin', img: JustinImg },
    { label: 'Kevin/Male (child)', value: 'Kevin', img: KevinImg },
    { label: 'Matthew/Male', value: 'Matthew', img: MatthewImg },
  ],
  [LANGUAGES_VALUES.ENAU]: [
    { label: 'Nicole/Female', value: 'Nicole', img: NicoleImg },
    { label: 'Russell/Male', value: 'Russell', img: RussellImg },
  ],
  [LANGUAGES_VALUES.ENGB]: [
    { label: 'Amy/Female', value: 'Amy', img: AmyImg },
    { label: 'Emma/Female', value: 'Emma', img: EmmaImg },
    { label: 'Brian/Male', value: 'Brian', img: BrianImg },
  ],
  [LANGUAGES_VALUES.ENGBWLS]: [
    { label: 'Geraint/Male', value: 'Geraint', img: GeraintImg },
  ],
};

export const VOICES_PRO = [
  { label: 'Kevin/Male (child)', value: 'Kevin', img: KevinImg },
];

export const DEFAULT_VOICES = {
  [ENGINE_TYPE_VALUES.STANDART]: VOICES[LANGUAGES_VALUES.ENUS_STANDART],
  [ENGINE_TYPE_VALUES.NEURAL]: VOICES[LANGUAGES_VALUES.ENUS_NEURAL],
};

export const LANGUAGES_PRO = [
  { label: 'English', value: 'en-US' },
  { label: 'English (British)', value: 'en-GB' },
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

export const PREVIEW = {
  'en-US': {
    Ivy: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.19fd788e-8ed2-4b7e-9e62-5fc33997caa8.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.60508fe4-fb0c-49ed-aebf-42a99ffd8e9b.mp3',
    },
    Joanna: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.1a36dc74-ef4e-404b-97b5-2b8413eede1b.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.015b960d-a455-463f-947a-e189c0204859.mp3',
    },
    Kendra: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.2b856d23-1df6-454b-9c77-3b938f67dbe8.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.2d119084-cb7d-481a-948f-12cc6029ca3f.mp3',
    },
    Kimberly: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.76dc74ed-ee9a-44fb-9872-8be3fc005236.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.f845e17b-4554-43e2-af49-e41b973c3c98.mp3',
    },
    Salli: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.3bdd7f09-88a1-4be8-86bc-ccaa3a322a5d.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.fde73655-0b7d-460d-ba9e-82b7cb21b896.mp3',
    },
    Joey: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.1fb5ab3c-c350-49df-9e25-da9a57f91b01.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.8c477986-75a2-4c8e-9141-1d4c3c1ad4e4.mp3',
    },
    Justin: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.ca24a666-9990-456d-ad66-21ed3f422499.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.bd5c39f9-fa66-45a6-9bda-d7f11adfdda8.mp3',
    },
    Kevin: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.272ddcaf-e1ab-4e02-8265-d946eb2b5e5c.mp3',
      // standard: 'This voice does not support the selected engine: standard',
    },
    Matthew: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.13bd6c93-a04f-4704-b764-ea538fd26ccf.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.b1c95f6e-1733-4196-8f68-e3c374473220.mp3',
    },
  },
  'en-AU': {
    Nicole: {
      // neural: 'This voice does not support the selected engine: neural',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.0e2f6405-9a5b-4cb0-9d3e-7e30fe835e5a.mp3',
    },
    Russell: {
      // neural: 'This voice does not support the selected engine: neural',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.8e802a14-5428-4367-871b-6d59aa20bfa9.mp3',
    },
  },
  'en-GB': {
    Amy: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.71a22254-e557-4aef-9384-62733a5bb25e.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.6acaffdc-45dc-4b21-80f0-7a58e8cfeaf4.mp3',
    },
    Emma: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.ef4ae947-8a9c-41a2-a215-a8fcf93056c2.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.eeba5187-895b-40c3-970c-1de6c74db84e.mp3',
    },
    Brian: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.2b730728-ec0a-40a8-93f2-99d04728cadc.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.3bafb3d1-a5d5-40af-a4b2-52eb054e2046.mp3',
    },
  },
  'en-GB-WLS': {
    Geraint: {
      // neural: 'This voice does not support the selected engine: neural',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.771cc3b4-8f25-41e6-b133-644e5bb61b62.mp3',
    },
  },
};
