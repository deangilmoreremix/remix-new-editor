import ElementsPanel from '../../components/common/toolbar/ElementsPanel';
import Produce from '../../components/common/toolbar/Produce';
import SettingsPanel from '../../components/common/produce/SettingsPanel';
import ProducePanel from '../../components/common/produce/ProducePanel';

import svgAddMedia from '../../public/static/images/toolbar/addMedia.svg';
// import svgAnimation from '../../public/static/images/toolbar/animation.svg';
// import svgAudio from '../../public/static/images/toolbar/audio.svg';
import svgElements from '../../public/static/images/toolbar/elements.svg';
import svgImage from '../../public/static/images/toolbar/image.svg';
import svgLowerThirds from '../../public/static/images/toolbar/lowerThirds.svg';
import svgProduce from '../../public/static/images/toolbar/produce.svg';
// import svgTransitions from '../../public/static/images/toolbar/transitions.svg';
import svgVRImage from '../../public/static/images/toolbar/vrImage.svg';
import svgListBuilder from '../../public/static/images/toolbar/listBuilder.svg';
// import svgScreenRec from '../../public/static/images/toolbar/screenRec.svg';
import svgVRText from '../../public/static/images/toolbar/vrText.svg';
import svgJson from '../../public/static/images/toolbar/json.svg';
import svgStickers from '../../public/static/images/toolbar/stickers.svg';
import svgEmailCampaign from '../../public/static/svgImages/produce/email-campaign.svg';
import svgList from '../../public/static/svgImages/produce/list-builder.svg';
// import svgRetarget from '../../public/static/svgImages/produce/retarget.svg';
import svgSocialCampaign from '../../public/static/svgImages/produce/social-campaign.svg';

import {
  EMAIL_CAMPAIGN_MODAL,
  // RETARGET_OPT_IN_MODAL,
  SOCIAL_CAMPAIGN_MODAL,
} from '../constants/modals';
import { LIBRARY_TABS } from '../constants/library';
import { STICKERS_TABS } from '../constants/stickers';
import { LOWER_THIRDS_TABS } from '../constants/lowerThirds';
import { POPCORN_ELEMENT_TYPES } from '../constants/popcorn';
import { DEFAULT_SETTINGS } from '../constants/settings';
import { PRODUCE_TABS, TOOLBARS } from '../constants/ui';

export const elementItems = ({ actions }) => [
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
    action: () => actions.openStickers(STICKERS_TABS.STICKERS.value),
    label: 'Stickers',
    icon: svgStickers,
    disabled: false,
  },
  {
    action: () => actions.addRetargetForm(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.RETARGET]),
    label: 'Advanced Optin',
    icon: svgListBuilder,
    disabled: false,
  },
  {
    action: () => actions.setLibraryType(LIBRARY_TABS.IMAGE),
    label: 'Image',
    icon: svgImage,
    disabled: false,
  },
  // {
  //   action: () => {},
  //   label: 'ScreenRec',
  //   icon: svgScreenRec,
  //   disabled: false,
  // },
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
    action: () => actions.openLowerThird(LOWER_THIRDS_TABS.LOWER_THIRDS.value),
    label: 'Lower Thirds',
    icon: svgLowerThirds,
    disabled: false,
  },
  // {
  //   action: () => {},
  //   label: 'Transitions',
  //   icon: svgTransitions,
  //   disabled: false,
  // },
  {
    action: () => actions.addElement(DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.JSON_ANIMATION]),
    label: 'JSON',
    icon: svgJson,
    disabled: false,
  },
];

export const sharePanelItems = ({
  // Todo Add argv "optinCodeEnabled", when we need Retarget
  actions, project: { allowedSocials: socials, modified },
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
  isActive: socials && socials.length > 0,
  errorMessage: 'Please allow Facebook and LinkedIn in our project to continue',
},
// ToDo remove "//"
// {
//   action: () => actions.openModal(RETARGET_OPT_IN_MODAL),
//   label: 'Retarget / opt-in',
//   icon: svgRetarget,
//   isActive: (!socials || (socials && !socials.some(s => s === 'facebook')))
// && optinCodeEnabled && !modified,
//   errorMessage: 'Please disable Facebook in our project to continue',
// },
{
  action: () => actions.openModal(),
  label: 'Watch Video',
  icon: svgList,
  isActive: true,
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
    func: () => {
      modifiers.actions.setWideWindow(false);
      modifiers.actions.setLibraryType(modifiers.actions.libraryType || LIBRARY_TABS.VIDEO);
    },
  },
  {
    id: TOOLBARS.ELEMENTS,
    label: 'Elements',
    icon: svgElements,
    items: elementItems(modifiers),
    renderer: ElementsPanel,
    func: () => {
      modifiers.actions.setWideWindow(false);
    },
  },
  {
    id: TOOLBARS.PRODUCE,
    label: 'Produce',
    icon: svgProduce,
    items: produceItems(modifiers),
    renderer: Produce,
    func: () => {
      modifiers.actions.setWideWindow(true);
      modifiers.actions.setLibraryType(null, true);
    },
  },
];
