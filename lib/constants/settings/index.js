import JsonAnimation from '../../../components/settings/json-animation/JsonAnimation';
import ImageSettings from '../../../components/settings/image-settings/ImageSettings';
import TextSettings from '../../../components/settings/text-settings/TextSettings';
import DefaultSettings from '../../../components/settings/default-settings/DefaultSettings';
import VrImageSettings from '../../../components/settings/vr-image/VrImageSettings';
import VideoTransitionSettings from '../../../components/settings/video-transition-settings/VideoTransitionSettings';
import VideoSettings from '../../../components/settings/video-settings/VideoSettings';
import JsonButtonSettings from '../../../components/settings/json-button/JsonButtonSettings';
import FormSettings from '../../../components/settings/lead-generator/FormSettings';
import GoogleMapSettings from '../../../components/settings/google-map/GoogleMapSettings';
import SocialSettings from '../../../components/settings/social/Social';

// todo fix it and fix images menu
import { INITIAL_VALUES as jsonAnimationValues } from './json-animation';
import { INITIAL_VALUES as jsonTransitionValues } from './json-transition';
import { INITIAL_VALUES as imageValues } from './image';
import {
  POPCORN_ELEMENT_TYPES,
  ADVANCED,
  BASIC,
  SCRIPT,
  TRANSITION_TAB,
  STYLES,
  FIELDS,
  CLIP_EDITOR_TAB,
  JSON_BUTTON_TAB,
  INTEGRATIONS,
} from '../popcorn';
import { INITIAL_VALUES as vrtextValues } from './vrtext-element';
import { INITIAL_VALUES as vrImageValues } from './vr-image';
import { INITIAL_VALUES as videoTransitionValues } from './video-transition';
import { INITIAL_VALUES as retargetSettings } from './retarget-settings';
import { INITIAL_VALUES as advancedOptinSettings } from './advanced-optin';
import { INITIAL_VALUES as videoSettings } from './video';
import { INITIAL_VALUES as pauseSettings } from './pause';
import { INITIAL_VALUES as jsonButtonValues } from './json-button';
import { INITIAL_VALUES as leadGeneratorValues } from './lead-generator';
import { INITIAL_VALUES as socialValues } from './social';
import { INITIAL_VALUES as loopSettings } from './loop';
import { INITIAL_VALUES as skipSettings } from './skip';
import { INITIAL_VALUES as googleMapSettings } from './google-map';
import { INITIAL_VALUES as backgroundSettings } from './background';

export const SETTINGS_COMPONENTS = {
  [POPCORN_ELEMENT_TYPES.PAUSE]: DefaultSettings,
  [POPCORN_ELEMENT_TYPES.TEXT]: TextSettings,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: JsonAnimation,
  [POPCORN_ELEMENT_TYPES.JSON_TRANSITION]: JsonAnimation,
  [POPCORN_ELEMENT_TYPES.IMAGE]: ImageSettings,
  [POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]: VrImageSettings,
  [POPCORN_ELEMENT_TYPES.LOOP]: DefaultSettings,
  [POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION]: VideoTransitionSettings,
  [POPCORN_ELEMENT_TYPES.RETARGET]: FormSettings,
  [POPCORN_ELEMENT_TYPES.ADVANCED_OPTIN]: FormSettings,
  [POPCORN_ELEMENT_TYPES.LEAD_GENERATOR]: FormSettings,
  [POPCORN_ELEMENT_TYPES.SEQUENCER]: VideoSettings,
  [POPCORN_ELEMENT_TYPES.JSON_BUTTON]: JsonButtonSettings,
  [POPCORN_ELEMENT_TYPES.SOCIAL]: SocialSettings,
  [POPCORN_ELEMENT_TYPES.SKIP]: DefaultSettings,
  [POPCORN_ELEMENT_TYPES.GOOGLE_MAP]: GoogleMapSettings,
  [POPCORN_ELEMENT_TYPES.BACKGROUND]: DefaultSettings,
};

export const DEFAULT_SETTINGS = {
  [POPCORN_ELEMENT_TYPES.PAUSE]: pauseSettings,
  [POPCORN_ELEMENT_TYPES.TEXT]: vrtextValues,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: jsonAnimationValues,
  [POPCORN_ELEMENT_TYPES.JSON_TRANSITION]: jsonTransitionValues,
  [POPCORN_ELEMENT_TYPES.IMAGE]: imageValues,
  [POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]: vrImageValues,
  [POPCORN_ELEMENT_TYPES.LOOP]: loopSettings,
  [POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION]: videoTransitionValues,
  [POPCORN_ELEMENT_TYPES.RETARGET]: retargetSettings,
  [POPCORN_ELEMENT_TYPES.ADVANCED_OPTIN]: advancedOptinSettings,
  [POPCORN_ELEMENT_TYPES.SEQUENCER]: videoSettings,
  [POPCORN_ELEMENT_TYPES.JSON_BUTTON]: jsonButtonValues,
  [POPCORN_ELEMENT_TYPES.LEAD_GENERATOR]: leadGeneratorValues,
  [POPCORN_ELEMENT_TYPES.SOCIAL]: socialValues,
  [POPCORN_ELEMENT_TYPES.SKIP]: skipSettings,
  [POPCORN_ELEMENT_TYPES.GOOGLE_MAP]: googleMapSettings,
  [POPCORN_ELEMENT_TYPES.BACKGROUND]: backgroundSettings,
};

export const DEFAULT_TABS = [
  { label: BASIC },
  { label: ADVANCED },
  {
    label: SCRIPT,
    disabled: true,
  },
];

export const CUSTOM_TABS = {
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: [{ label: BASIC }],
  [POPCORN_ELEMENT_TYPES.JSON_TRANSITION]: [{ label: BASIC }],
  [POPCORN_ELEMENT_TYPES.IMAGE]: [{ label: BASIC }],
  [POPCORN_ELEMENT_TYPES.PAUSE]: [{ label: BASIC }],
  [POPCORN_ELEMENT_TYPES.LOOP]: [{ label: BASIC }],
  [POPCORN_ELEMENT_TYPES.SKIP]: [{ label: BASIC }],
  [POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]: [{ label: BASIC }],
  [POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION]: [{ label: TRANSITION_TAB }],
  [POPCORN_ELEMENT_TYPES.JSON_BUTTON]: [{ label: JSON_BUTTON_TAB }],
  [POPCORN_ELEMENT_TYPES.RETARGET]: [
    { label: STYLES },
    { label: FIELDS },
    { label: INTEGRATIONS },
  ],
  [POPCORN_ELEMENT_TYPES.ADVANCED_OPTIN]: [
    { label: STYLES },
    { label: FIELDS },
  ],
  [POPCORN_ELEMENT_TYPES.LEAD_GENERATOR]: [
    { label: STYLES },
    { label: FIELDS },
    { label: INTEGRATIONS },
  ],
  [POPCORN_ELEMENT_TYPES.SEQUENCER]: [{ label: CLIP_EDITOR_TAB }],
  [POPCORN_ELEMENT_TYPES.GOOGLE_MAP]: [{ label: BASIC }],
  [POPCORN_ELEMENT_TYPES.SOCIAL]: [{ label: BASIC }],
  [POPCORN_ELEMENT_TYPES.BACKGROUND]: [{ label: BASIC }],
};
