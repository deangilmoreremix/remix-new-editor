import ElementsPanel from '../../components/common/toolbar/ElementsPanel';
import ProducePanel from '../../components/common/toolbar/ProducePanel';
import SettingsPanel from '../../components/common/produce/SettingsPanel';
import SharePanel from '../../components/common/produce/SharePanel';

import svg3D from '../../public/static/images/toolbar/3D.svg';
import svgAddMedia from '../../public/static/images/toolbar/addMedia.svg';
import svgAnimation from '../../public/static/images/toolbar/animation.svg';
import svgAudio from '../../public/static/images/toolbar/audio.svg';
import svgElements from '../../public/static/images/toolbar/elements.svg';
import svgImage from '../../public/static/images/toolbar/image.svg';
import svgLeadGen from '../../public/static/images/toolbar/leadGen.svg';
import svgLoop from '../../public/static/images/toolbar/loop.svg';
import svgLowerThirds from '../../public/static/images/toolbar/lowerThirds.svg';
import svgMaps from '../../public/static/images/toolbar/maps.svg';
import svgPause from '../../public/static/images/toolbar/pause.svg';
import svgPopUp from '../../public/static/images/toolbar/popUp.svg';
import svgProduce from '../../public/static/images/toolbar/produce.svg';
import svgSketchEditor from '../../public/static/images/toolbar/sketchEditor.svg';
import svgSkip from '../../public/static/images/toolbar/skip.svg';
import svgSocial from '../../public/static/images/toolbar/social.svg';
import svgTextMask from '../../public/static/images/toolbar/textMask.svg';
import svgTransitions from '../../public/static/images/toolbar/transitions.svg';
import svgVRImage from '../../public/static/images/toolbar/vrImage.svg';
import svgVRText from '../../public/static/images/toolbar/vrText.svg';
import svgWiki from '../../public/static/images/toolbar/wiki.svg';
import svgJson from '../../public/static/images/toolbar/json.svg';

import {
  EMAIL_CAMPAIGN_MODAL,
  SETTINGS_MODAL,
  SOCIAL_CAMPAIGN_MODAL,
} from '../constants/modals';
import { LIBRARY_TABS } from '../constants/library';
import { JSON_ANIMATION, TABS as JSON_ANIMATION_TABS } from '../constants/settings/json-animation';
import { VRTEXT, TABS as VRTEXT_PRESET_TABS } from '../constants/settings/vrtext-element';

export const elementItems = ({ actions }) => [
  {
    action: () => actions.openModal(SETTINGS_MODAL, {
      type: JSON_ANIMATION,
      header: {
        tabs: JSON_ANIMATION_TABS,
        className: 'json-animation-settings-header',
      },
    }),
    label: 'JSON',
    icon: svgJson,
    disabled: false,
  },
  {
    action: () => actions.openModal(SETTINGS_MODAL, {
      type: VRTEXT,
      header: {
        tabs: VRTEXT_PRESET_TABS,
        className: 'text-preset-settings-header',
      },
    }),
    label: 'VR Text',
    icon: svgVRText,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Text Mask',
    icon: svgTextMask,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Pop-up',
    icon: svgPopUp,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Google Map',
    icon: svgMaps,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Image',
    icon: svgImage,
    disabled: false,
  },
  {
    action: () => {},
    label: 'VR Image',
    icon: svgVRImage,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Loop',
    icon: svgLoop,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Skip',
    icon: svgSkip,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Pause',
    icon: svgPause,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Lead Gen',
    icon: svgLeadGen,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Wikipedia',
    icon: svgWiki,
    disabled: false,
  },
  {
    action: () => {},
    label: '3D Model',
    icon: svg3D,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Social',
    icon: svgSocial,
    disabled: false,
  },
  {
    action: () => {},
    label: 'lower third',
    icon: svgLowerThirds,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Sketch',
    icon: svgSketchEditor,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Audio',
    icon: svgAudio,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Animation',
    icon: svgAnimation,
    disabled: false,
  },
  {
    action: () => {},
    label: 'Transitions',
    icon: svgTransitions,
    disabled: false,
  },
];

export const sharePanelItems = ({ actions }) => ([
  {
    action: () => actions.openModal(EMAIL_CAMPAIGN_MODAL),
    label: 'Email campaign',
    icon: svgVRText,
  },
  {
    action: () => actions.openModal(SOCIAL_CAMPAIGN_MODAL),
    label: 'Social campaign',
    icon: svgTextMask,
  },
]);

export const produceItems = (modifiers) => [
  {
    label: 'Settings',
    icon: svgVRText,
    renderer: SettingsPanel,
  },
  {
    label: 'Share',
    icon: svgTextMask,
    items: sharePanelItems(modifiers),
    renderer: SharePanel,
  },
];

export default (modifiers) => [
  {
    label: 'Add Media',
    icon: svgAddMedia,
    func: () => {
      modifiers.actions.setLibraryType(LIBRARY_TABS.VIDEO);
    },
  },
  {
    label: 'Elements',
    icon: svgElements,
    items: elementItems(modifiers),
    renderer: ElementsPanel,
  },
  {
    label: 'Produce',
    icon: svgProduce,
    items: produceItems(modifiers),
    renderer: ProducePanel,
  },
];
