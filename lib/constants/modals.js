import dynamic from 'next/dynamic';

import SocialPublisherModal from '../../components/modals/SocialPublisherModal';
import EmailCampaingModal from '../../components/modals/EmailCampaignModal';
import SaveProjectModal from '../../components/modals/SaveProjectModal';
import RetargetOptInModal from '../../components/modals/RetargetOptInModal';
import PersonalizationModal from '../../components/modals/PersonalizationModal';
import TemplateGeneratorModal from '../../components/modals/TemplateGeneratorModal';
import PresetsModal from '../../components/modals/Presets';
import ConnectModal from '../../components/modals/Connect';
import VideoPlayerModal from '../../components/modals/VideoPlayerModal';
import NicheScriptsModal from '../../components/modals/TemplateGenerator/NicheScriptsModalContent';
import ImageCropperModal from '../../components/modals/ImageCropperModal';
import VoiceModal from '../../components/modals/VoiceModal';
import PreRemixVoiceModal from '../../components/modals/PreRemixVoiceModal';
import PreviewMediaModal from '../../components/modals/PreviewMediaModal';
import UrlVideoModal from '../../components/modals/UrlVideoModal';
import SafariWarningModal from '../../components/modals/SafariWarningModal';
import TemplatePreviewModal from '../../components/modals/Templates/TemplatePreviewModal';

const RecorderModal = dynamic(() => import('../../components/modals/RecorderModal'), { ssr: false });
const TuiImageEditorModal = dynamic(() => import('../../components/modals/TuiImageEditorModal'), { ssr: false });

export const SOCIAL_CAMPAIGN_MODAL = 'social-campaign';
export const EMAIL_CAMPAIGN_MODAL = 'email-campaign';
export const RETARGET_OPT_IN_MODAL = 'retarget-opt-in';
export const SAVE_PROJECT_MODAL = 'save-project';
export const PERSONALIZATION_MODAL = 'personalization';
export const RECORDER_MODAL = 'recorder';
export const TEMPLATE_GENERATOR_MODAL = 'template-generator';
export const SAFARI_WARNING_MODAL = 'safari-warning';
export const PRESETS_MODAL = 'presets';
export const CONNECT = 'connect';
export const VIDEO_PLAYER_MODAL = 'video-player';
export const PREVIEW_MEDIA_MODAL = 'preview-media-modal';
export const NICHE_SCRIPTS_MODAL = 'niche-scripts';
export const IMAGE_CROPPER_MODAL = 'image-cropper';
export const TUI_IMAGE_EDITOR_MODAL = 'tui-image-editor';
export const VOICE_MODAL = 'voice';
export const URL_VIDEO_MODAL = 'url-video';
export const PRE_REMIX_VOICE_MODAL = 'pre-remix-voice';
export const TEMPLATE_PREVIEW_MODAL = 'template-preview';

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
      closeButton: true,
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
      closeButton: true,
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
      closeButton: true,
      className: 'recorder-header',
    },
  },
  {
    id: SAFARI_WARNING_MODAL,
    className: `${SAFARI_WARNING_MODAL}-modal`,
    renderer: SafariWarningModal,
    maxWidth: 'lg',
  },
  {
    id: TEMPLATE_GENERATOR_MODAL,
    className: `${TEMPLATE_GENERATOR_MODAL}-modal`,
    renderer: TemplateGeneratorModal,
    maxWidth: 'lg',
  },
  {
    id: PRESETS_MODAL,
    className: 'view-project-modal',
    renderer: PresetsModal,
    maxWidth: 'lg',
  },
  {
    id: VOICE_MODAL,
    className: 'voice-modal',
    renderer: VoiceModal,
    maxWidth: 'lg',
  },
  {
    id: PRE_REMIX_VOICE_MODAL,
    className: `${PRE_REMIX_VOICE_MODAL}-modal`,
    renderer: PreRemixVoiceModal,
    maxWidth: 'lg',
  },
  {
    id: CONNECT,
    className: 'view-project-modal',
    renderer: ConnectModal,
    maxWidth: 'lg',
  },
  {
    id: VIDEO_PLAYER_MODAL,
    className: `${VIDEO_PLAYER_MODAL}-modal`,
    renderer: VideoPlayerModal,
  },
  {
    id: PREVIEW_MEDIA_MODAL,
    className: 'modal-container__media-content',
    renderer: PreviewMediaModal,
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
  {
    id: TUI_IMAGE_EDITOR_MODAL,
    className: `${TUI_IMAGE_EDITOR_MODAL}-modal`,
    renderer: TuiImageEditorModal,
    maxWidth: 'lg',
  },
  {
    id: URL_VIDEO_MODAL,
    className: `${URL_VIDEO_MODAL}-modal`,
    renderer: UrlVideoModal,
    maxWidth: 'xl',
  },
  {
    id: TEMPLATE_PREVIEW_MODAL,
    className: `${TEMPLATE_PREVIEW_MODAL}-modal`,
    renderer: TemplatePreviewModal,
    maxWidth: 'xl',
    themeChange: true,
  },
];
