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
import AditiImg from '../../public/static/images/faces/Aditi.jpg';
import AstridImg from '../../public/static/images/faces/Astrid.jpg';
import BiancaImg from '../../public/static/images/faces/Bianca.jpg';
import CamilaImg from '../../public/static/images/faces/Camila.jpg';
import CarlaImg from '../../public/static/images/faces/Carla.jpg';
import CarmenImg from '../../public/static/images/faces/Carmen.jpg';
import CelineImg from '../../public/static/images/faces/Celine.jpg';
import ChantalImg from '../../public/static/images/faces/Chantal.jpg';
import ConchitaImg from '../../public/static/images/faces/Conchita.jpg';
import CristianoImg from '../../public/static/images/faces/Cristiano.jpg';
import DoraImg from '../../public/static/images/faces/Dora.jpg';
import EnriqueImg from '../../public/static/images/faces/Enrique.jpg';
import EwaImg from '../../public/static/images/faces/Ewa.jpg';
import FilizImg from '../../public/static/images/faces/Filiz.jpg';
import GiorgioImg from '../../public/static/images/faces/Giorgio.jpg';
import GwynethImg from '../../public/static/images/faces/Gwyneth.jpg';
import HansImg from '../../public/static/images/faces/Hans.jpg';
import InesImg from '../../public/static/images/faces/Ines.jpg';
import JacekImg from '../../public/static/images/faces/Jacek.jpg';
import JanImg from '../../public/static/images/faces/Jan.jpg';
import KarlImg from '../../public/static/images/faces/Karl.jpg';
import LeaImg from '../../public/static/images/faces/Lea.jpg';
import LivImg from '../../public/static/images/faces/Liv.jpg';
import LotteImg from '../../public/static/images/faces/Lotte.jpg';
import LuciaImg from '../../public/static/images/faces/Lucia.jpg';
import LupeImg from '../../public/static/images/faces/Lupe.jpg';
import MadsImg from '../../public/static/images/faces/Mads.jpg';
import MajaImg from '../../public/static/images/faces/Maja.jpg';
import MarleneImg from '../../public/static/images/faces/Marlene.jpg';
import MathieuImg from '../../public/static/images/faces/Mathieu.jpg';
import MaximImg from '../../public/static/images/faces/Maxim.jpg';
import MiaImg from '../../public/static/images/faces/Mia.jpg';
import MiguelImg from '../../public/static/images/faces/Miguel.jpg';
import MizukiImg from '../../public/static/images/faces/Mizuki.jpg';
import NajaImg from '../../public/static/images/faces/Naja.jpg';
import PenelopeImg from '../../public/static/images/faces/Penelope.jpg';
import RaveenaImg from '../../public/static/images/faces/Raveena.jpg';
import RicardoImg from '../../public/static/images/faces/Ricardo.jpg';
import RubenImg from '../../public/static/images/faces/Ruben.jpg';
import SeoyeonImg from '../../public/static/images/faces/Seoyeon.jpg';
import TakumiImg from '../../public/static/images/faces/Takumi.jpg';
import TatyanaImg from '../../public/static/images/faces/Tatyana.jpg';
import VickiImg from '../../public/static/images/faces/Vicki.jpg';
import VitoriaImg from '../../public/static/images/faces/Vitoria.jpg';
import ZeinaImg from '../../public/static/images/faces/Zeina.jpg';
import ZhiyuImg from '../../public/static/images/faces/Zhiyu.jpg';

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
  ENGB_STANDART: `en-GB-${ENGINE_TYPE_VALUES.STANDART}`,
  ENGB_NEURAL: `en-GB-${ENGINE_TYPE_VALUES.NEURAL}`,
  ENGBWLS: 'en-GB-WLS',
  ENIN: 'en-IN',
  ARB: 'arb',
  CMNCN: 'cmn-CN',
  DADK: 'da-DK',
  NLNL: 'nl-NL',
  FRFR: 'fr-FR',
  FRCA: 'fr-CA',
  DEDE: 'de-DE',
  HIIN: 'hi-IN',
  ISIS: 'is-IS',
  ITIT: 'it-IT',
  JAJP: 'ja-JP',
  KOKR: 'ko-KR',
  NBNO: 'nb-NO',
  PLPL: 'pl-PL',
  PTBR: 'pt-BR',
  PTBR_STANDART: `pt-BR-${ENGINE_TYPE_VALUES.STANDART}`,
  PTBR_NEURAL: `pt-BR-${ENGINE_TYPE_VALUES.NEURAL}`,
  PTPT: 'pt-PT',
  RORO: 'ro-RO',
  RURU: 'ru-RU',
  ESES: 'es-ES',
  ESMX: 'es-MX',
  ESUS: 'es-US',
  ESUS_STANDART: `es-US-${ENGINE_TYPE_VALUES.STANDART}`,
  ESUS_NEURAL: `es-US-${ENGINE_TYPE_VALUES.NEURAL}`,
  SVSE: 'sv-SE',
  TRTR: 'tr-TR',
  CYGB: 'cy-GB',
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
  [LANGUAGES_VALUES.ENGB_STANDART]: [
    { label: 'Amy/Female', value: 'Amy', img: AmyImg },
    { label: 'Emma/Female', value: 'Emma', img: EmmaImg },
    { label: 'Brian/Male', value: 'Brian', img: BrianImg },
  ],
  [LANGUAGES_VALUES.ENGB_NEURAL]: [
    { label: 'Amy/Female', value: 'Amy', img: AmyImg },
    { label: 'Emma/Female', value: 'Emma', img: EmmaImg },
    { label: 'Brian/Male', value: 'Brian', img: BrianImg },
  ],
  [LANGUAGES_VALUES.ENGBWLS]: [
    { label: 'Geraint/Male', value: 'Geraint', img: GeraintImg },
  ],

  [LANGUAGES_VALUES.ARB]: [
    { label: 'Zeina/Female', value: 'Zeina', img: ZeinaImg },
  ],
  [LANGUAGES_VALUES.CMNCN]: [
    { label: 'Zhiyu/Female', value: 'Zhiyu', img: ZhiyuImg },
  ],
  [LANGUAGES_VALUES.DADK]: [
    { label: 'Naja/Female', value: 'Naja', img: NajaImg },
    { label: 'Mads/Male', value: 'Mads', img: MadsImg },
  ],
  [LANGUAGES_VALUES.NLNL]: [
    { label: 'Lotte/Female', value: 'Lotte', img: LotteImg },
    { label: 'Ruben/Male', value: 'Ruben', img: RubenImg },
  ],
  [LANGUAGES_VALUES.ENIN]: [
    { label: 'Aditi/Female', value: 'Aditi', img: AditiImg },
    { label: 'Raveena/Female', value: 'Raveena', img: RaveenaImg },
  ],
  [LANGUAGES_VALUES.FRFR]: [
    { label: 'Celine/Female', value: 'Celine', img: CelineImg },
    { label: 'Lea/Female', value: 'Lea', img: LeaImg },
    { label: 'Mathieu/Male', value: 'Mathieu', img: MathieuImg },
  ],
  [LANGUAGES_VALUES.FRCA]: [
    { label: 'Chantal/Female', value: 'Chantal', img: ChantalImg },
  ],
  [LANGUAGES_VALUES.DEDE]: [
    { label: 'Marlene/Female', value: 'Marlene', img: MarleneImg },
    { label: 'Vicki/Female', value: 'Vicki', img: VickiImg },
    { label: 'Hans/Male', value: 'Hans', img: HansImg },
  ],
  [LANGUAGES_VALUES.HIIN]: [
    { label: 'Aditi/Female', value: 'Aditi', img: AditiImg },
  ],
  [LANGUAGES_VALUES.ISIS]: [
    { label: 'Dora/Female', value: 'Dora', img: DoraImg },
    { label: 'Karl/Male', value: 'Karl', img: KarlImg },
  ],
  [LANGUAGES_VALUES.ITIT]: [
    { label: 'Carla/Female', value: 'Carla', img: CarlaImg },
    { label: 'Bianca/Female', value: 'Bianca', img: BiancaImg },
    { label: 'Giorgio/Male', value: 'Giorgio', img: GiorgioImg },
  ],
  [LANGUAGES_VALUES.JAJP]: [
    { label: 'Mizuki/Female', value: 'Mizuki', img: MizukiImg },
    { label: 'Takumi/Male', value: 'Takumi', img: TakumiImg },
  ],
  [LANGUAGES_VALUES.KOKR]: [
    { label: 'Seoyeon/Female', value: 'Seoyeon', img: SeoyeonImg },
  ],
  [LANGUAGES_VALUES.NBNO]: [
    { label: 'Liv/Female', value: 'Liv', img: LivImg },
  ],
  [LANGUAGES_VALUES.PLPL]: [
    { label: 'Ewa/Female', value: 'Ewa', img: EwaImg },
    { label: 'Maja/Female', value: 'Maja', img: MajaImg },
    { label: 'Jacek/Male', value: 'Jacek', img: JacekImg },
    { label: 'Jan/Male', value: 'Jan', img: JanImg },
  ],
  [LANGUAGES_VALUES.PTBR_STANDART]: [
    { label: 'Camila/Female', value: 'Camila', img: CamilaImg },
    { label: 'Vitoria/Female', value: 'Vitoria', img: VitoriaImg },
    { label: 'Ricardo/Male', value: 'Ricardo', img: RicardoImg },
  ],
  [LANGUAGES_VALUES.PTBR_NEURAL]: [
    { label: 'Camila/Female', value: 'Camila', img: CamilaImg },
  ],
  [LANGUAGES_VALUES.PTPT]: [
    { label: 'Ines/Female', value: 'Ines', img: InesImg },
    { label: 'Cristiano/Male', value: 'Cristiano', img: CristianoImg },
  ],
  [LANGUAGES_VALUES.RORO]: [
    { label: 'Carmen/Female', value: 'Carmen', img: CarmenImg },
  ],
  [LANGUAGES_VALUES.RURU]: [
    { label: 'Tatyana/Female', value: 'Tatyana', img: TatyanaImg },
    { label: 'Maxim/Male', value: 'Maxim', img: MaximImg },
  ],
  [LANGUAGES_VALUES.ESES]: [
    { label: 'Conchita/Female', value: 'Conchita', img: ConchitaImg },
    { label: 'Lucia/Female', value: 'Lucia', img: LuciaImg },
    { label: 'Enrique/Male', value: 'Enrique', img: EnriqueImg },
  ],
  [LANGUAGES_VALUES.ESMX]: [
    { label: 'Mia/Female', value: 'Mia', img: MiaImg },
  ],
  [LANGUAGES_VALUES.ESUS_STANDART]: [
    { label: 'Lupe/Female', value: 'Lupe', img: LupeImg },
    { label: 'Penelope/Female', value: 'Penelope', img: PenelopeImg },
    { label: 'Miguel/Female', value: 'Miguel', img: MiguelImg },
  ],
  [LANGUAGES_VALUES.ESUS_NEURAL]: [
    { label: 'Lupe/Female', value: 'Lupe', img: LupeImg },
  ],
  [LANGUAGES_VALUES.SVSE]: [
    { label: 'Astrid/Female', value: 'Astrid', img: AstridImg },
  ],
  [LANGUAGES_VALUES.TRTR]: [
    { label: 'Filiz/Female', value: 'Filiz', img: FilizImg },
  ],
  [LANGUAGES_VALUES.CYGB]: [
    { label: 'Gwyneth/Female', value: 'Gwyneth', img: GwynethImg },
  ],
};

export const LANGUAGES_PRO = [
  { label: 'English', value: 'en-US' },
  { label: 'English (British)', value: 'en-GB' },
  { label: 'Portuguese (Brazilian)', value: 'pt-BR' },
  { label: 'Spanish (US)', value: 'es-US' },
];

export const LANGUAGES = [
  { label: 'English', value: 'en-US' },
  { label: 'English (Australian)', value: 'en-AU' },
  { label: 'English (British)', value: 'en-GB' },
  { label: 'English (Welsh)', value: 'en-GB-WLS' },
  { label: 'English (Indian)', value: 'en-IN' },
  { label: 'Arabic', value: 'arb' },
  { label: 'Chinese, Mandarin', value: 'cmn-CN' },
  { label: 'Danish', value: 'da-DK' },
  { label: 'Dutch', value: 'nl-NL' },
  { label: 'French', value: 'fr-FR' },
  { label: 'French (Canadian)', value: 'fr-CA' },
  { label: 'German', value: 'de-DE' },
  { label: 'Hindi', value: 'hi-IN' },
  { label: 'Icelandic', value: 'is-IS' },
  { label: 'Italian', value: 'it-IT' },
  { label: 'Japanese', value: 'ja-JP' },
  { label: 'Korean', value: 'ko-KR' },
  { label: 'Norwegian', value: 'nb-NO' },
  { label: 'Polish', value: 'pl-PL' },
  { label: 'Portuguese (Brazilian)', value: 'pt-BR' },
  { label: 'Portuguese (European)', value: 'pt-PT' },
  { label: 'Romanian', value: 'ro-RO' },
  { label: 'Russian', value: 'ru-RU' },
  { label: 'Spanish (European)', value: 'es-ES' },
  { label: 'Spanish (Mexican)', value: 'es-MX' },
  { label: 'Spanish (US)', value: 'es-US' },
  { label: 'Swedish', value: 'sv-SE' },
  { label: 'Turkish', value: 'tr-TR' },
  { label: 'Welsh', value: 'cy-GB' },
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
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.5db201c3-d032-4f8d-a04a-307e7db4ca82.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.045f23bd-403a-4d73-ba62-4039680b5464.mp3',
    },
    Joanna: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.e951fd40-fda6-469d-8dfc-c805c1bd5696.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.ad8ce85c-ed2e-49c0-837f-c326e562afbe.mp3',
    },
    Kendra: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.fb9a8fdd-11e9-4c08-ae19-ac2f18793281.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.f21446a6-a150-4b43-8a5f-0dbf07e30ecf.mp3',
    },
    Kimberly: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.2f5819ab-28a1-4310-860a-34313ac245fb.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.321f31f7-31d5-41b9-a244-eecdae796094.mp3',
    },
    Salli: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.0c9a85b2-7004-4d85-9d8b-e65e840c35e2.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.20b8bd95-0e4e-459b-b1f9-0dce8c933828.mp3',
    },
    Joey: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.03d1f5e1-dd88-453f-bcf6-a48c95e41d8b.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.0a297a27-0983-40e2-9eb7-9ef77273dcd3.mp3',
    },
    Justin: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.24bd5e2c-f6a7-4f74-932d-10ea127dc11b.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.83f1e096-e982-40ec-a463-53d6f4c03edf.mp3',
    },
    Kevin: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.0a59e63f-4406-4899-a899-41f4d9a4793e.mp3',
    },
    Matthew: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.fa3ea59c-3d25-4924-bec9-1fcbf111e2f9.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.17f65f8b-22c3-4275-8906-58047fd410ca.mp3',
    },
  },
  'en-AU': {
    Nicole: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.25aa0f40-68ff-4372-a665-bf55d59ffd33.mp3',
    },
    Russell: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.44294670-d87e-42cf-b6d3-dd8a1f5a082c.mp3',
    },
  },
  'en-GB': {
    Amy: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.d1c1f805-7807-4cbb-8d46-ecf53362b8f6.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.82caf0a0-14ff-4e46-9e88-3ed157069b3c.mp3',
    },
    Emma: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.ed92b85c-69c8-4e78-89ce-5009b3864e01.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.5cbc0579-a986-4d66-bb01-5b69dcf73bba.mp3',
    },
    Brian: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.980656ac-48a3-4f20-b8d3-11016824fc20.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.90076d7d-871b-4a6f-b17c-392e599a4921.mp3',
    },
  },
  'en-GB-WLS': {
    Geraint: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.3cff013d-db7c-41e0-8171-22ffa1312138.mp3',
    },
  },
  arb: {
    Zeina: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.c1402537-c536-43f1-9071-279556fcc0e6.mp3',
    },
  },
  'cmn-CN': {
    Zhiyu: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.109e7ea4-6ac0-41f0-9977-e317eaeb2402.mp3',
    },
  },
  'da-DK': {
    Naja: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.6fac0f9b-0022-4933-a557-fc437ef0df75.mp3',
    },
    Mads: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.61812687-3de7-45e8-8171-27fad0dd9b4c.mp3',
    },
  },
  'nl-NL': {
    Lotte: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.c67241b3-820c-4b1e-b224-f77bd7432467.mp3',
    },
    Ruben: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.5f04d2e7-fa14-4fac-8134-47d1adbbc590.mp3',
    },
  },
  'en-IN': {
    Aditi: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.ff9ae100-e364-4517-8f98-721672d31f71.mp3',
    },
    Raveena: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.9777d916-2423-41d3-a308-9360d07a0a95.mp3',
    },
  },
  'fr-FR': {
    Celine: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.19968da4-170d-4365-991a-c0f588d48523.mp3',
    },
    Lea: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.6cb846e6-24aa-45bd-a569-33b465b80700.mp3',
    },
    Mathieu: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.dd43dc99-5124-4da9-92e9-b1051d8f252c.mp3',
    },
  },
  'fr-CA': {
    Chantal: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.1e9adf05-9434-4cba-9405-065ff29cd0b3.mp3',
    },
  },
  'de-DE': {
    Marlene: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.8ef4fa5b-c97e-480e-9fbe-fd08640d8fa4.mp3',
    },
    Vicki: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.f1fcf1c8-59fa-4393-920d-8983ff4a3743.mp3',
    },
    Hans: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.3009faa1-0c10-4301-b82f-3b1a5cca898d.mp3',
    },
  },
  'hi-IN': {
    Aditi: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.c1c1d94c-b96b-4924-8e5f-784e5dd19dfc.mp3',
    },
  },
  'is-IS': {
    Dora: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.c46a44af-b4ac-4f89-95d0-b25fdde7800c.mp3',
    },
    Karl: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.7f8858f5-1460-4940-8651-1f78837b386f.mp3',
    },
  },
  'it-IT': {
    Carla: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.024a1c2e-28f5-47ab-9604-184d758a04f2.mp3',
    },
    Bianca: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.a3309810-3aac-4990-a835-c6615c014464.mp3',
    },
    Giorgio: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.5878080f-01bf-4d72-afb4-9a04bbcb017b.mp3',
    },
  },
  'ja-JP': {
    Mizuki: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.3f1c15b6-381c-4d77-8068-9ae7b6c00ba2.mp3',
    },
    Takumi: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.81f4822e-0335-4760-a069-fcd43eb17e43.mp3',
    },
  },
  'ko-KR': {
    Seoyeon: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.07ef638f-2f30-4a4d-a001-cbc39fee5f5f.mp3',
    },
  },
  'nb-NO': {
    Liv: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.61a93920-1694-412b-b4ad-059e06f8bed4.mp3',
    },
  },
  'pl-PL': {
    Ewa: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.23e911e9-2c8d-449f-82d9-96f21323dd01.mp3',
    },
    Maja: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.851f4715-4472-4e31-a88b-a99276c76217.mp3',
    },
    Jacek: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.af4d9d59-7761-4b96-8901-705d0ab73857.mp3',
    },
    Jan: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.dc4e0d1f-0511-4506-9e61-d6ef5898705d.mp3',
    },
  },
  'pt-BR': {
    Camila: {
      neural: 'https://cdn.vidcloud.io/voices/cbf072b8-3e10-495c-89f9-a3f38e75f171.mp3',
      standard: 'https://cdn.vidcloud.io/voices/332a02be-c5c8-49cd-af9f-8cacf76e9f20.mp3',
    },
    Vitoria: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.2db60772-adc0-42a9-9bc7-573f84000331.mp3',
    },
    Ricardo: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.5006c1bf-b85e-4f3a-84e1-25630cbe4f50.mp3',
    },
  },
  'pt-PT': {
    Ines: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.41e15afb-355d-4ca4-b72a-94c176b26bf8.mp3',
    },
    Cristiano: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.e37e3ac3-3db9-405b-8c13-8a8fe0023757.mp3',
    },
  },
  'ro-RO': {
    Carmen: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.ae0698bd-96d1-4730-affd-bb64e449a250.mp3',
    },
  },
  'ru-RU': {
    Tatyana: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.bf409698-fe05-49c1-962e-aeea7e6557a5.mp3',
    },
    Maxim: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.5e982dd8-024b-4121-a258-f6e85395a546.mp3',
    },
  },
  'es-ES': {
    Conchita: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.317bbdb9-9d2b-4985-82b6-b845ec259ce2.mp3',
    },
    Lucia: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.0a6206ed-79d3-45ca-9e0a-e1769aeaedbe.mp3',
    },
    Enrique: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.d4a52495-6c41-462c-a43b-56ea052ff12f.mp3',
    },
  },
  'es-MX': {
    Mia: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.78000377-e0f7-4e7d-aad1-c7f70967cee9.mp3',
    },
  },
  'es-US': {
    Lupe: {
      neural: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/neural.d6875a23-0101-4df7-a79d-6f6a78131ed9.mp3',
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.3350c888-309f-42ac-a6f1-b854664c28cf.mp3',
    },
    Penelope: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.2e030384-74af-450b-accb-e419b05af10c.mp3',
    },
    Miguel: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.94d2b1c4-eb7c-4ab4-861b-8a71cca1c562.mp3',
    },
  },
  'sv-SE': {
    Astrid: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.d303e332-94ff-4179-b5da-7dcb694991e9.mp3',
    },
  },
  'tr-TR': {
    Filiz: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.abaaeda9-3710-4685-84ab-d4247873ec0b.mp3',
    },
  },
  'cy-GB': {
    Gwyneth: {
      standard: 'https://s3.us-east-1.amazonaws.com/videoremix-tts/polly/standard.370c220d-e3c0-4a4d-ad1c-545f8c75300a.mp3',
    },
  },
};
