import ElementsPanel from '../../components/common/toolbar/ElementsPanel';
import Produce from '../../components/common/toolbar/Produce';
import SettingsPanel from '../../components/common/produce/SettingsPanel';
import ProducePanel from '../../components/common/produce/ProducePanel';

import { radioButton } from '../constants/windowsLogics';

import svgPause from '../../public/static/images/toolbar/pause.svg';
import svgAddMedia from '../../public/static/images/toolbar/addMedia.svg';
import svgElements from '../../public/static/images/toolbar/elements.svg';
import svgImage from '../../public/static/images/toolbar/image.svg';
import svgLowerThirds from '../../public/static/images/toolbar/lowerThirds.svg';
import svgPresets from '../../public/static/images/toolbar/presets.svg';
import svgProduce from '../../public/static/images/toolbar/produce.svg';
import svgTemplateGen from '../../public/static/images/toolbar/template_gen.svg';
import svgVRImage from '../../public/static/images/toolbar/vrImage.svg';
import svgCopyPlayback from '../../public/static/svgImages/produce/copy_playback.svg';
import svgListBuilder from '../../public/static/images/toolbar/listBuilder.svg';
import svgAdvanceOptin from '../../public/static/images/toolbar/advanced-optin.svg';
import svgScreenRec from '../../public/static/images/toolbar/screenRec.svg';
import svgVRText from '../../public/static/images/toolbar/vrText.svg';
import svgJson from '../../public/static/images/toolbar/json.svg';
import svgStickers from '../../public/static/images/toolbar/stickers.svg';
import svgCTA from '../../public/static/images/toolbar/call-to-action.svg';
import svgBlendModes from '../../public/static/images/toolbar/blendModes.svg';
import svgTextToSpeech from '../../public/static/images/toolbar/voice.svg';
import svgEmailCampaign from '../../public/static/svgImages/produce/email-campaign.svg';
import svgList from '../../public/static/svgImages/produce/list-builder.svg';
import svgSocialCampaign from '../../public/static/svgImages/produce/social-campaign.svg';
import svgLeadGenerator from '../../public/static/images/toolbar/lead-generator.svg';
import svgSocial from '../../public/static/images/toolbar/social.svg';
import svgOverlay from '../../public/static/images/toolbar/overlay.svg';

import svgLoop from '../../public/static/images/toolbar/loop.svg';
import svgSkip from '../../public/static/images/toolbar/skip.svg';
import svgConnect from '../../public/static/images/toolbar/connect.svg';
import svgGif from '../../public/static/images/toolbar/gif.svg';
import svgNewStickers from '../../public/static/images/toolbar/newstickers.svg';
import svgMaps from '../../public/static/images/toolbar/maps.svg';
import svgTextMask from '../../public/static/images/toolbar/textMask.svg';
import svgBackground from '../../public/static/images/toolbar/background.svg';
// import svgAnimation from '../../public/static/images/toolbar/animation.svg';
// import svgAudio from '../../public/static/images/toolbar/audio.svg';
// import svgTransitions from '../../public/static/images/toolbar/transitions.svg';
// import svgRetarget from '../../public/static/svgImages/produce/retarget.svg';

import {
  EMAIL_CAMPAIGN_MODAL,
  PERSONALIZATION_MODAL,
  // RETARGET_OPT_IN_MODAL,
  SOCIAL_CAMPAIGN_MODAL,
  PRESETS_MODAL,
  IMAGE_LT_PRESETS_MODAL,
  CONNECT,
  TEMPLATE_GENERATOR_MODAL_CONTENT,
} from '../constants/modals';
import { LIBRARY_TABS } from '../constants/library';
import { STICKERS_TABS } from '../constants/stickers';
import { LOWER_THIRDS_TABS } from '../constants/lowerThirds';
import { POPCORN_ELEMENT_TYPES } from '../constants/popcorn';
import { DEFAULT_SETTINGS, SECTIONS } from '../constants/settings';
import { PRODUCE_TABS, SCREEN_RATIO, TOOLBARS, WINDOW_TYPES } from '../constants/ui';
import { FEATURES } from '../constants/features';
import { copyPlaybackLink } from '../utils/copy-url';

export const elementItems = ({
  actions,
  project: {
    isSuperAdmin,
    isfeatureEnabled,
    upgradeLink,
    recorderEnabled,
    stickersEnabled,
    lowerThirdsEnabled,
    presetsEnabled,
    ctaEnabled,
    releaseElement,
    getRoleDetails,
    blendModeEnabled,
    userStore,
    connectEnabled,
    gifsEnabled,
    libraryStickerEnabled,
    jsonTransitionEnabled,
    leadGeneratorEnabled,
    width,
    height,
    textToSpeechStandardEnabled,
    textToSpeechNeuralEnabled,
    textToSpeechLimitedEnabled,
    googleMapsEnabled,
    roleDetail,
    collborateEnabled,
    socialFbEnabled,
    wrapperFeatureEnabled,
    textMaskEnabled,
    evolutionOverlayEnabled,
    evolutionPresetEnabled,
    evolutionBlendModeEnabled,
    evolutionLowerThirdEnabled,
    evolutionCtaEnabled,
    evolutionImageLTPresetEnabled,
  },

}) => [
  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.TEXT] }, newOptions);
    },
    label: 'Smart Text',
    icon: svgVRText,
    disabled: false,
    uiSection: SECTIONS.basic,
  },
  {
    action: () => actions.openTextToSpeech(WINDOW_TYPES.TEXT_TO_SPEECH),
    label: 'Smart Speech',
    icon: svgTextToSpeech,
    disabled: !(textToSpeechStandardEnabled
        || textToSpeechNeuralEnabled
        || textToSpeechLimitedEnabled),
    upgradeLink: upgradeLink(!textToSpeechStandardEnabled && FEATURES.REVOLUTION_TEXT_TO_SPEECH_STANDARD || !textToSpeechNeuralEnabled && FEATURES.REVOLUTION_TEXT_TO_SPEECH_NEURAL || !textToSpeechLimitedEnabled && FEATURES.REVOLUTION_TEXT_TO_SPEECH_BASE),
    uiSection: SECTIONS.basic,
  },
  {
    action: (newOptions) => {
      getRoleDetails();
      actions.toggleLeftBlock(false);
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.TEXT_MASK] }, newOptions);
    },
    label: 'Text Mask',
    icon: svgTextMask,
    disabled: !textMaskEnabled,
    upgradeLink: upgradeLink(FEATURES.TEXT_MASK),
    uiSection: SECTIONS.basic,
  },
  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      actions.addElement(
        { ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE] },
        newOptions,
      );
    },
    label: 'Personalized Image',
    icon: svgVRImage,
    disabled: false,
    uiSection: SECTIONS.basic,
  },
  {
    action: () => {
      releaseElement();
      actions.openMediaButton(LIBRARY_TABS.IMAGE);
    },
    label: 'Image',
    icon: svgImage,
    disabled: false,
    uiSection: SECTIONS.basic,
  },
  {
    action: () => {
      actions.addRetargetForm(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.ADVANCED_OPTIN]);
      actions.setListBuilder();
    },
    label: 'Personalizer',
    icon: svgAdvanceOptin,
    upgradeLink: upgradeLink(FEATURES.REVOLUTION_ADVANCED_OPTIN),
    disabled: !isfeatureEnabled(FEATURES.REVOLUTION_ADVANCED_OPTIN),
    uiSection: SECTIONS.basic,
  },


  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      getRoleDetails();
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.SOCIAL] }, newOptions);
    },
    label: 'Social',
    icon: svgSocial,
    upgradeLink: upgradeLink(FEATURES.SOCIAL_FB_ELEMENT),
    disabled: !socialFbEnabled,
    uiSection: SECTIONS.basic,
  },


  {
    action: () => {
      releaseElement();
      actions.setSecondaryWindowType(STICKERS_TABS.STICKERS.value);
    },
    label: 'Stickers',
    icon: svgStickers,
    upgradeLink: upgradeLink(FEATURES.STICKERS),
    disabled: !stickersEnabled,
    uiSection: SECTIONS.basic,
  },

  // CREATIVE SECTION
  {
    action: () => 
    {
      getRoleDetails();
      console.log(userStore.roleDetail,"detail==========");
      actions.setSecondaryWindowType(WINDOW_TYPES.BLEND_MODE_LIBRARY);},
    label: 'Blend Modes',
    icon: svgBlendModes,
    upgradeLink: upgradeLink(!blendModeEnabled && FEATURES.BLEND_MODE || !evolutionBlendModeEnabled && FEATURES.EVOLUTION_BLEND_MODE),
    disabled: !(blendModeEnabled || evolutionBlendModeEnabled),
    uiSection: SECTIONS.creative,
  },

  {
    action: () => {
      actions.setSecondaryWindowType(SCREEN_RATIO[`${width}:${height}`].value);
    },
    label: 'Overlays',
    icon: svgOverlay,
    upgradeLink: upgradeLink(!jsonTransitionEnabled && FEATURES.SVG_TRANSITIONS && !evolutionOverlayEnabled && FEATURES.EVOLUTION_OVERLAY),
    disabled: !(jsonTransitionEnabled || evolutionOverlayEnabled),
    uiSection: SECTIONS.creative,
  },

  {
    action: () => actions.setSecondaryWindowType(WINDOW_TYPES.CTA),
    label: 'CTA',
    icon: svgCTA,
    upgradeLink: upgradeLink(!ctaEnabled && FEATURES.REVOLUTION_CTA || !evolutionCtaEnabled && FEATURES.EVOLUTION_CTA),
    disabled: !(ctaEnabled || evolutionCtaEnabled),
    uiSection: SECTIONS.creative,
  },


  {
    action: () => {
      releaseElement();
      getRoleDetails();
      actions.setSecondaryWindowType(LOWER_THIRDS_TABS.LOWER_THIRDS.value);
    },
    label: 'Lower Thirds',
    icon: svgLowerThirds,
    upgradeLink: upgradeLink(!lowerThirdsEnabled && FEATURES.LOWER_THIRDS || !evolutionLowerThirdEnabled && FEATURES.EVOLUTION_LOWER_THIRDS),
    disabled: !(lowerThirdsEnabled || evolutionLowerThirdEnabled),
    uiSection: SECTIONS.creative,
  },

  {
    action: () => {
      actions.toggleRightBlock(false);
      actions.openModal(PRESETS_MODAL);
    },
    label: 'LT Presets',
    icon: svgPresets,
    upgradeLink:upgradeLink(!presetsEnabled &&  FEATURES.PRESETS || !evolutionPresetEnabled && FEATURES.EVOLUTION_PRESETS ),
    disabled: !(presetsEnabled || evolutionPresetEnabled),
    uiSection: SECTIONS.creative,
  },
  {
    action: () => {
      actions.toggleRightBlock(false);
      actions.openModal(IMAGE_LT_PRESETS_MODAL);
    },
    label: 'Image LT ',
    icon: svgPresets,
    upgradeLink:upgradeLink(FEATURES.EVOLUTION_IMAGE_LT_PRESETS),
    disabled: !evolutionImageLTPresetEnabled,
    uiSection: SECTIONS.creative,
  },

  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      getRoleDetails();
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.BACKGROUND] }, newOptions);
    },
    label: 'Wrapper',
    icon: svgBackground,
    upgradeLink:upgradeLink(FEATURES.WRAPPER),
    disabled: !wrapperFeatureEnabled,
    uiSection: SECTIONS.creative,
  },


  {
    action: () => actions.setSecondaryWindowType(WINDOW_TYPES.STICKER),
    label: 'GIF - Stickers',
    icon: svgNewStickers,
    upgradeLink:upgradeLink(FEATURES.STICKER_LIBRARY),
    disabled: !libraryStickerEnabled,
    uiSection: SECTIONS.creative,
  },
  {
    action: () => actions.setSecondaryWindowType(WINDOW_TYPES.GIF),
    label: 'Giphy',
    icon: svgGif,
    upgradeLink:upgradeLink(FEATURES.GIFS),
    disabled: !gifsEnabled,
    uiSection: SECTIONS.creative,
  },

  // Video Controls
  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.SKIP] }, newOptions);
    },
    label: 'Skip',
    icon: svgSkip,
    uiSection: SECTIONS.videoControl,
  },
  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.PAUSE] }, newOptions);
    },
    label: 'Pause',
    icon: svgPause,
    disabled: false,
    uiSection: SECTIONS.videoControl,
  },
  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.LOOP] }, newOptions);
    },
    label: 'Loop',
    icon: svgLoop,
    disabled: false,
    uiSection: SECTIONS.videoControl,
  },


  {
    action: () => {
      actions.toggleRightBlock(false);
      actions.openModal(CONNECT);
    },
    label: 'Connect Form',
    icon: svgConnect,
    upgradeLink: upgradeLink(FEATURES.CONNECT),
    disabled: !connectEnabled,
    uiSection: SECTIONS.leadGeneration,
  },
  {
    action: () => {
      actions.addRetargetForm(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.RETARGET]);
      actions.setListBuilder();
    },
    label: 'List Builder',
    icon: svgListBuilder,
    upgradeLink: upgradeLink(FEATURES.LISTBUILDER),
    disabled: !isfeatureEnabled(FEATURES.LISTBUILDER),
    uiSection: SECTIONS.leadGeneration,
  },
  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.LEAD_GENERATOR] }, newOptions);
    },
    label: 'Lead Generator',
    icon: svgLeadGenerator,
    upgradeLink: upgradeLink(FEATURES.REVOLUTION_LEAD_GENERATOR),
    disabled: !leadGeneratorEnabled,
    uiSection: SECTIONS.leadGeneration,
  },

  // personalization

  // {
  //   action: () => {},
  //   label: 'Animation',
  //   icon: svgAnimation,
  //   disabled: false,
  // },
  // {
  //   action: () => actions.setLibraryType(LIBRARY_TABS.AUDIO),
  //   label: 'Audio',
  //   icon: svgAudio,
  //   disabled: false,
  // },
  // {
  //   action: () => {},
  //   label: 'Transitions',
  //   icon: svgTransitions,
  //   disabled: false,
  // },

  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.JSON_ANIMATION] }, newOptions);
    },
    label: 'JSON',
    icon: svgJson,
    adminElement: !isSuperAdmin,
    disabled: !isSuperAdmin,
    uiSection: SECTIONS.basic,
  },
  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.JSON_BUTTON] }, newOptions);
    },
    label: 'JSON Button',
    icon: svgJson,
    adminElement: !isSuperAdmin,
    disabled: !isSuperAdmin,
    uiSection: SECTIONS.basic,
  },
  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      actions.addElement(
        { ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.JSON_TRANSITION] },
        newOptions,
      );
    },
    label: 'JSON Transition',
    icon: svgJson,
    adminElement: !isSuperAdmin,
    disabled: !isSuperAdmin,
    uiSection: SECTIONS.basic,
  },

  // Advanced Features
  {
    action: () => {
      releaseElement();
      actions.setSecondaryWindowType(WINDOW_TYPES.RECORDER);
    },
    label: 'ScreenRec',
    icon: svgScreenRec,
    upgradeLink: upgradeLink(FEATURES.RECORDER),
    disabled: !recorderEnabled,
    uiSection: SECTIONS.advanced,
  },
  {
    action: (newOptions) => {
      actions.toggleLeftBlock(false);
      actions.addElement({ ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.GOOGLE_MAP] }, newOptions);
    },
    label: 'Google Map',
    icon: svgMaps,
    upgradeLink: upgradeLink(FEATURES.GOOGLE_MAPS),
    disabled: !googleMapsEnabled,
    uiSection: SECTIONS.advanced,
  },
  // {
  //   action: (newOptions) => {
  //     releaseElement()
  //     actions.addTogetherJS(true);
  //   },
  //   label: 'Collaborate',
  //   icon: svgMaps,
  //   disabled: true,
  //   uiSection: SECTIONS.advanced,
  // },
];

export const sharePanelItems = ({
  // Todo Add argv "optinCodeEnabled", when we need Retarget
  actions, project: { allowedSocials: socials, modified, videoUrl, linkedinEnabled },
}) => ([{
  action: () => actions.openModal(EMAIL_CAMPAIGN_MODAL),
  label: 'Email campaign',
  icon: svgEmailCampaign,
  tooltip: `Use to share your personalized video project via Email Service providers like
  MailChimp, GetResponse, SendinBlue, e.t.c., or embed on a Landing page/WordPress Site.`,
  isActive: !modified,
  errorMessage: 'Please save a project',
},
{
  action: () => actions.openModal(SOCIAL_CAMPAIGN_MODAL),
  label: 'Social campaign',
  icon: svgSocialCampaign,
  tooltip: 'Use to share your personalized video project to Facebook and LinkedIn.',
  isActive: !modified && socials && socials.length > 0,
  errorMessage: modified ? 'Please save a project'
    : `Please allow Facebook ${linkedinEnabled ? 'or LinkedIn' : ''} in our project to continue`,
},
// ToDo remove "//"
// {
//   action: () => actions.openModal(RETARGET_OPT_IN_MODAL),
//   label: 'Retarget / opt-in',
//   icon: svgRetarget,
//   isActive: (!socials || (socials && !socials.some(s => s === 'facebook')))
// && optinCodeEnabled && !modified,
//   errorMessage: (modified && 'Please save a project')
//  || (!optinCodeEnabled && 'Retarget / opt-in feature is required')
//  || (socials && socials.some(s => s === 'facebook')
//  && 'Please disable Facebook in our project to continue'),
// },
{
  action: () => actions.openModal(PERSONALIZATION_MODAL),
  label: 'Watch the video',
  icon: svgList,
  tooltip: 'Click to watch the video project on playback.',
  isActive: !modified,
  errorMessage: 'Please save a project',
  url: videoUrl,
},
{
  action: (url) => copyPlaybackLink(url),
  label: 'Copy playback link',
  icon: svgCopyPlayback,
  tooltip: 'Use to copy link of your playback.',
  errorMessage: 'Please save a project before copy link',
  isActive: !modified,
  copiedTooltip: 'Copied!',
  url: videoUrl,
},
]);

export const produceItems = (modifiers) => [
  {
    id: PRODUCE_TABS.PRODUCE,
    label: 'Produce',
    items: sharePanelItems(modifiers),
    renderer: ProducePanel,
  },
  {
    id: PRODUCE_TABS.SETTINGS,
    label: 'Settings',
    renderer: SettingsPanel,
  },
];

export default (modifiers) => [
  {
    id: TOOLBARS.MEDIA,
    label: 'Add Media',
    icon: svgAddMedia,
    tooltip: `
      Click to add Image, Video, and Audio from your computer.
      You can also add a video URL from YouTube and Vimeo to import into the editor.
    `,
    items: elementItems(modifiers),
    renderer: ElementsPanel,
    func: () => {
      modifiers.project.releaseElement();
      modifiers.actions.openMediaButton(modifiers.actions.libraryType || LIBRARY_TABS.VIDEO);
    },
  },

  {
    id: TOOLBARS.ELEMENTS,
    label: 'Elements',
    icon: svgElements,
    tooltip: `
      Click to add Elements that will make your video project look great.
      Elements like Smart Text, Personalized Images, CTA, and much more.
    `,
    items: elementItems(modifiers),
    renderer: ElementsPanel,
    func: () => {
      modifiers.actions.changeRadioButton(radioButton.TOP);
    },
  },

  {
    id: TOOLBARS.PRODUCE,
    label: 'Produce',
    icon: svgProduce,
    tooltip: `
      Click to add a title, description, tags, thumbnail to your project.
      You can also enable Facebook/LinkedIn personalization and share via Social or Email Campaign.
    `,
    items: produceItems(modifiers),
    renderer: Produce,
    func: () => {
      modifiers.actions.changeRadioButton(radioButton.BOTTOM);
    },
  },

  {
    id: TOOLBARS.TEMPLATE_GEN,
    label: 'Video Automation Creator',
    icon: svgTemplateGen,
    tooltip: `
      Click to open Video Automation Creator
    `,
    func: () => {
      modifiers.actions.openModal(TEMPLATE_GENERATOR_MODAL_CONTENT);
    },
  },
];
