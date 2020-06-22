import dynamic from 'next/dynamic';

import SocialPublisherModal from '../../components/modals/SocialPublisherModal';
import EmailCampaingModal from '../../components/modals/EmailCampaignModal';
import SaveProjectModal from '../../components/modals/SaveProjectModal';
import RetargetOptInModal from '../../components/modals/RetargetOptInModal';
import PersonalizationModal from '../../components/modals/PersonalizationModal';
import TemplateGeneratorModal from '../../components/modals/TemplateGeneratorModal';
import PresetsModal from '../../components/modals/Presets/Presets';
import VideoPlayerModal from '../../components/modals/VideoPlayerModal';
import NicheScriptsModal from '../../components/modals/TemplateGenerator/NicheScriptsModalContent';
import ImageCropperModal from '../../components/modals/ImageCropperModal';

const RecorderModal = dynamic(() => import('../../components/modals/RecorderModal'), { ssr: false });

export const SOCIAL_CAMPAIGN_MODAL = 'social-campaign';
export const EMAIL_CAMPAIGN_MODAL = 'email-campaign';
export const RETARGET_OPT_IN_MODAL = 'retarget-opt-in';
export const SAVE_PROJECT_MODAL = 'save-project';
export const PERSONALIZATION_MODAL = 'personalization';
export const RECORDER_MODAL = 'recorder';
export const TEMPLATE_GENERATOR_MODAL = 'template-generator';
export const PRESETS_MODAL = 'presets';
export const VIDEO_PLAYER_MODAL = 'video-player';
export const NICHE_SCRIPTS_MODAL = 'niche-scripts';
export const IMAGE_CROPPER_MODAL = 'image-cropper';

export const MODAL_CONFIG = [
  {
    id: SOCIAL_CAMPAIGN_MODAL,
    className: `${SOCIAL_CAMPAIGN_MODAL}-modal`,
    renderer: SocialPublisherModal,
    header: {
      tabs: [{
        label: 'SHARE',
      }],
      activeTab: 0,
      className: 'publisher-header',
    },
  },
  {
    id: EMAIL_CAMPAIGN_MODAL,
    className: `${EMAIL_CAMPAIGN_MODAL}-modal`,
    renderer: EmailCampaingModal,
    header: {
      tabs: [{
        label: 'SHARE',
      }],
      activeTab: 0,
      className: 'publisher-header',
    },
  },
  {
    id: SAVE_PROJECT_MODAL,
    className: `${SAVE_PROJECT_MODAL}-modal`,
    renderer: SaveProjectModal,
    header: {
      title: 'Save as...',
    },
  },
  {
    id: RETARGET_OPT_IN_MODAL,
    className: `${RETARGET_OPT_IN_MODAL}-modal`,
    renderer: RetargetOptInModal,
  },
  {
    id: PERSONALIZATION_MODAL,
    className: `${PERSONALIZATION_MODAL}-modal`,
    renderer: PersonalizationModal,
    header: {
      tabs: [{
        label: 'Personalization',
      }],
      activeTab: 0,
      className: 'personalization-header',
    },
  },
  {
    id: RECORDER_MODAL,
    className: `${RECORDER_MODAL}-modal`,
    renderer: RecorderModal,
    header: {
      tabs: [{
        label: 'Recorder',
      }],
      activeTab: 0,
      className: 'recorder-header',
    },
  },
  {
    id: TEMPLATE_GENERATOR_MODAL,
    className: `${TEMPLATE_GENERATOR_MODAL}-modal`,
    renderer: TemplateGeneratorModal,
    maxWidth: 'lg',
  },
  {
    id: PRESETS_MODAL,
    className: `${PRESETS_MODAL}-modal`,
    renderer: PresetsModal,
    maxWidth: 'lg',
  },
  {
    id: VIDEO_PLAYER_MODAL,
    className: `${VIDEO_PLAYER_MODAL}-modal`,
    renderer: VideoPlayerModal,
  },
  {
    id: NICHE_SCRIPTS_MODAL,
    className: `${NICHE_SCRIPTS_MODAL}-modal`,
    renderer: NicheScriptsModal,
  },
  {
    id: IMAGE_CROPPER_MODAL,
    className: `${IMAGE_CROPPER_MODAL}-modal`,
    renderer: ImageCropperModal,
    maxWidth: 'lg',
  },
];
