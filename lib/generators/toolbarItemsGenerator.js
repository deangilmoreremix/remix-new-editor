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
import svgVRImage from '../../public/static/images/toolbar/vrImage.svg';
import svgListBuilder from '../../public/static/images/toolbar/listBuilder.svg';
import svgAdvanceOptin from '../../public/static/images/toolbar/advanced-optin.svg';
import svgScreenRec from '../../public/static/images/toolbar/screenRec.svg';
import svgVRText from '../../public/static/images/toolbar/vrText.svg';
import svgJson from '../../public/static/images/toolbar/json.svg';
import svgStickers from '../../public/static/images/toolbar/stickers.svg';
import svgCTA from '../../public/static/images/toolbar/call-to-action.svg';
import svgBlendModes from '../../public/static/images/toolbar/blendModes.svg';
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
  CONNECT,
} from '../constants/modals';
import { LIBRARY_TABS } from '../constants/library';
import { STICKERS_TABS } from '../constants/stickers';
import { LOWER_THIRDS_TABS } from '../constants/lowerThirds';
import { POPCORN_ELEMENT_TYPES } from '../constants/popcorn';
import { DEFAULT_SETTINGS } from '../constants/settings';
import { PRODUCE_TABS, SCREEN_RATIO, TOOLBARS, WINDOW_TYPES } from '../constants/ui';
import { FEATURES } from '../constants/features';

export const elementItems = ({
  actions,
  project: {
    isSuperAdmin,
    isfeatureEnabled,
    recorderEnabled,
    stickersEnabled,
    lowerThirdsEnabled,
    presetsEnabled,
    ctaEnabled,
    releaseElement,
    blendModeEnabled,
    connectEnabled,
    gifsEnabled,
    libraryStickerEnabled,
    jsonTransitionEnabled,
    leadGeneratorEnabled,
    width,
    height,
    googleMapsEnabled,
    socialFbEnabled,
    wrapperFeatureEnabled,
  },
}) => [
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.TEXT]),
    label: 'Smart Text',
    icon: svgVRText,
    disabled: false,
  },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]),
    label: 'Personalized Image',
    icon: svgVRImage,
    disabled: false,
  },
  {
    action: () => {
      releaseElement();
      actions.openStickers(STICKERS_TABS.STICKERS.value);
    },
    label: 'Stickers',
    icon: svgStickers,
    disabled: !stickersEnabled,
  },
  {
    action: () => {
      actions.addRetargetForm(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.RETARGET]);
      actions.setListBuilder();
    },
    label: 'Video List Builder',
    icon: svgListBuilder,
    disabled: !isfeatureEnabled(FEATURES.LISTBUILDER),
  },
  {
    action: () => {
      actions.addRetargetForm(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.ADVANCED_OPTIN]);
      actions.setListBuilder();
    },
    label: 'Advanced Opt-In',
    icon: svgAdvanceOptin,
    disabled: !isfeatureEnabled(FEATURES.REVOLUTION_ADVANCED_OPTIN),
  },
  {
    action: () => {
      releaseElement();
      actions.setLibraryType(LIBRARY_TABS.IMAGE);
    },
    label: 'Image',
    icon: svgImage,
    disabled: false,
  },
  {
    action: () => {
      releaseElement();
      actions.setLibraryType(WINDOW_TYPES.RECORDER);
    },
    label: 'ScreenRec',
    icon: svgScreenRec,
    disabled: !recorderEnabled,
  },
  {
    action: () => {
      actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.SOCIAL]);
    },
    label: 'Social',
    icon: svgSocial,
    disabled: !socialFbEnabled,
  },
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
  {
    action: () => {
      releaseElement();
      actions.openLowerThird(LOWER_THIRDS_TABS.LOWER_THIRDS.value);
    },
    label: 'Lower Thirds',
    icon: svgLowerThirds,
    disabled: !lowerThirdsEnabled,
  },
  {
    action: () => {
      actions.openToolbarElement(SCREEN_RATIO[`${width}:${height}`].value);
    },
    label: 'Overlays',
    icon: svgOverlay,
    disabled: !jsonTransitionEnabled,
  },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.BACKGROUND]),
    label: 'Wrapper',
    icon: svgBackground,
    disabled: !wrapperFeatureEnabled,
  },
  {
    action: () => {
      actions.toggleRightBlock(false);
      actions.openModal(PRESETS_MODAL);
    },
    label: 'LT Presets',
    icon: svgPresets,
    disabled: !presetsEnabled,
  },
  {
    action: () => {
      actions.toggleRightBlock(false);
      actions.openModal(CONNECT);
    },
    label: 'Connect Form',
    icon: svgConnect,
    disabled: !connectEnabled,
  },
  // {
  //   action: () => {},
  //   label: 'Transitions',
  //   icon: svgTransitions,
  //   disabled: false,
  // },
  {
    action: () => actions.openToolbarElement(WINDOW_TYPES.CTA),
    label: 'CTA',
    icon: svgCTA,
    disabled: !ctaEnabled,
  },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.JSON_ANIMATION]),
    label: 'JSON',
    icon: svgJson,
    disabled: !isSuperAdmin,
  },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.JSON_BUTTON]),
    label: 'JSON Button',
    icon: svgJson,
    disabled: !isSuperAdmin,
  },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.JSON_TRANSITION]),
    label: 'JSON Transition',
    icon: svgJson,
    disabled: !isSuperAdmin,
  },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.LOOP]),
    label: 'Loop',
    icon: svgLoop,
    disabled: false,
  },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.PAUSE]),
    label: 'Pause',
    icon: svgPause,
    disabled: false,
  },
  {
    action: () => actions.openToolbarElement(WINDOW_TYPES.BLEND_MODE_LIBRARY),
    label: 'Blend Modes',
    icon: svgBlendModes,
    disabled: !blendModeEnabled,
  },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.LEAD_GENERATOR]),
    label: 'Lead Generator',
    icon: svgLeadGenerator,
    disabled: !leadGeneratorEnabled,
  },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.SKIP]),
    label: 'Skip',
    icon: svgSkip,
  },
  {
    action: () => actions.openGif(WINDOW_TYPES.GIF),
    label: 'Gif',
    icon: svgGif,
    disabled: !gifsEnabled,
  },
  {
    action: () => actions.openSticker(WINDOW_TYPES.STICKER),
    label: 'Sticker',
    icon: svgNewStickers,
    disabled: !libraryStickerEnabled,
  },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.GOOGLE_MAP]),
    label: 'Google Map',
    icon: svgMaps,
    disabled: !googleMapsEnabled,
  },
];

export const sharePanelItems = ({
  // Todo Add argv "optinCodeEnabled", when we need Retarget
  actions, project: { allowedSocials: socials, modified, videoUrl, linkedinEnabled },
}) => ([{
  action: () => actions.openModal(EMAIL_CAMPAIGN_MODAL),
  label: 'Email campaign',
  icon: svgEmailCampaign,
  isActive: !modified,
  errorMessage: 'Please save a project',
},
{
  action: () => actions.openModal(SOCIAL_CAMPAIGN_MODAL),
  label: 'Social campaign',
  icon: svgSocialCampaign,
  isActive: !modified && socials && socials.length > 0,
  errorMessage: modified ? 'Please save a project'
    : `Please allow Facebook ${linkedinEnabled ? 'or LinkedIn' : ''}in our project to continue`,
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
  isActive: !modified,
  errorMessage: 'Please save a project',
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
    items: produceItems(modifiers),
    renderer: Produce,
    func: () => {
      modifiers.actions.changeRadioButton(radioButton.BOTTOM);
    },
  },
];
