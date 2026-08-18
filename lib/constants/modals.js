import dynamic from 'next/dynamic';

import SocialPublisherModal from '../../components/modals/SocialPublisherModal';
import EmailCampaingModal from '../../components/modals/EmailCampaignModal';
import SaveProjectModal from '../../components/modals/SaveProjectModal';
import RetargetOptInModal from '../../components/modals/RetargetOptInModal';
import PersonalizationModal from '../../components/modals/PersonalizationModal';
import TemplateGeneratorModal from '../../components/modals/TemplateGeneratorModal';
import CreativeGeneratorModal from '../../components/modals/CreativeGeneratorModal';
import PresetsModal from '../../components/modals/Presets';
import ImageLTPresetModal from '../../components/modals/ImageLTPresets';
import EndScreensModal from '../../components/modals/EndScreen';
import AiArtGenerator from '../../components/modals/AiArtGenerator';
import BGDiffusion from '../../components/modals/BackgroundDiffusion';


import ConnectModal from '../../components/modals/Connect';
import VideoPlayerModal from '../../components/modals/VideoPlayerModal';
import NicheScriptsModal from '../../components/modals/TemplateGenerator/NicheScriptsModalContent';
import NicheScriptsPreviewModal from '../../components/modals/TemplateGenerator/NicheScriptsPreviewModal';
import ImageCropperModal from '../../components/modals/ImageCropperModal';
import VoiceModal from '../../components/modals/VoiceModal';
import PreRemixVoiceModal from '../../components/modals/PreRemixVoiceModal';
import PreviewMediaModal from '../../components/modals/PreviewMediaModal';
import UrlVideoModal from '../../components/modals/UrlVideoModal';
import SafariWarningModal from '../../components/modals/SafariWarningModal';
import TemplatePreviewModal from '../../components/modals/Templates/TemplatePreviewModal';
import CancellationModal from '../../components/modals/Billing/CancellationModal';
import DetailsModal from '../../components/modals/Billing/DetailsModal';
import ProjectSettingsModal from '../../components/modals/Projects/ProjectSettingsModal';
import FolderModal from '../../components/modals/Projects/FolderModal';
import ModalContent from '../../components/modals/TemplateGenerator/ModalContent';

import nicheScriptsIcon from '../../public/static/svgImages/template-generator/niche-scripts-icon.svg';
import lowerThirdIcon from '../../public/static/images/toolbar/lowerThirds.svg'
import ctaModesIcon from '../../public/static/images/toolbar/CTA.svg';
import templatePackIcon from '../../public/static/images/toolbar/template_pack.svg';
import nicheTemplatesIcon from '../../public/static/svgImages/template-generator/niche-templates-icon.svg';
import overlaysIcon from '../../public/static/svgImages/template-generator/overlays-icon.svg';
import previewIcon from '../../public/static/svgImages/template-generator/preview-icon.svg';
import CreativeModalContent from '../../components/modals/Creatives/CreativeModalContent';
const SocialPublishModal = dynamic(() => import('../../components/modals/SocialPublishModal'), { ssr: false });

const RecorderModal = dynamic(() => import('../../components/modals/RecorderModal'), { ssr: false });
const PixoImageEditorModal = dynamic(() => import('../../components/modals/PixoImageEditorModal'), { ssr: false });
const ImglyImageEditorModal = dynamic(() => import('../../components/modals/ImglyImageEditorModal'), { ssr: false });
const ImglyImageEditorModalCropper = dynamic(() => import('../../components/modals/ImglyImageEditorModalCropper'), { ssr: false });

const AdvanceImageEditorModal = dynamic(() => import('../../components/modals/AdvanceImageEditorModal'), { ssr: false });
// const PinturaImageEditorModal = dynamic(() => import('../../components/modals/PinturaImageEditorModal'), { ssr: false });
const PassportMarkerModal = dynamic(() => import('../../components/common/AdvanceImageEditor/PassportMakerModal'), { ssr: false });


export const SOCIAL_CAMPAIGN_MODAL = 'social-campaign';
export const EMAIL_CAMPAIGN_MODAL = 'email-campaign';
export const RETARGET_OPT_IN_MODAL = 'retarget-opt-in';
export const SAVE_PROJECT_MODAL = 'save-project';
export const PERSONALIZATION_MODAL = 'personalization';
export const RECORDER_MODAL = 'recorder';
export const TEMPLATE_GENERATOR_MODAL = 'template-generator';
export const TEMPLATE_GENERATOR_MODAL_CONTENT = 'template-generator-content';
export const CREATIVE_MODAL = "creative-modal";
export const CREATIVE_MODAL_CONTENT = "creative-modal-content";
export const SAFARI_WARNING_MODAL = 'safari-warning';
export const PRESETS_MODAL = 'presets';
export const IMAGE_LT_PRESETS_MODAL = 'image-lt-presets';
export const RETRO_LT_MODAL = 'retro-lt';
export const NEON_LT_MODAL = 'neon-lt';
export const NEON_SOCIAL_MEDIA_LT_MODAL = 'neon-social-media-lt';
export const LOCATION_TITLES_MODAL = 'location-titles';
export const SOCIAL_MEDIA_ICON_3D_MODAL = 'social-media-icon-3D'
export const CALL_OUT_TITLE_PACKAGE_MODAL = 'call-out-title-package'
export const NEON_ARROW_PACK_MODAL = 'neon-arrow-pack'
export const SOCIAL_MEDIA_PACK_MODAL = 'social-media-pack'
export const SOCIAL_MEIDA_BUTTON_PACK_MODAL = 'social-media-button-pack'
export const END_SCREENS_MODAL = 'end-screens';
export const AI_ART_GENERATOR_MODAL = 'ai-art-generator';
export const BG_DIFFUSION_MODAL = 'background-diffusion';

export const SOCIAL_PUBLISH_MODAL = 'social-publish';


export const CONNECT = 'connect';
export const VIDEO_PLAYER_MODAL = 'video-player';
export const PREVIEW_MEDIA_MODAL = 'preview-media-modal';
export const NICHE_SCRIPTS_MODAL = 'niche-scripts';
export const NICHE_SCRIPTS_PREVIEW_MODAL = 'niche-scripts-preview';
export const IMAGE_CROPPER_MODAL = 'image-cropper';
export const PIXO_IMAGE_EDITOR_MODAL = 'pixo-image-editor';
export const IMGLY_IMAGE_EDITOR_MODAL = ' imgly-image-editor';
export const IMGLY_IMAGE_EDITOR_MODAL_CROPPER = ' imgly-image-editor-cropper';

export const ADVANCE_IMAGE_EDITOR_MODAL = 'advance-image-editor';
export const PINTURA_IMAGE_EDITOR_MODAL = 'pintura-image-editor';
export const VOICE_MODAL = 'voice';
export const URL_VIDEO_MODAL = 'url-video';
export const PRE_REMIX_VOICE_MODAL = 'pre-remix-voice';
export const TEMPLATE_PREVIEW_MODAL = 'template-preview';
export const CREATE_PROJECT_MODAL = 'create-project';
export const FOLDER_MODAL = 'add-folder';
export const PROJECT_SETTINGS_MODAL = 'project-settings';
export const CANCELLATION_MODAL = 'cancellation';
export const DETAILS_MODAL = 'details';
export const PASSPORT_MARKER_MODAL = 'passport-marker-editor';


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
    id: TEMPLATE_GENERATOR_MODAL_CONTENT,
    className: `${TEMPLATE_GENERATOR_MODAL}-modal max-size content`,
    renderer: ModalContent,
    maxWidth: false,
    header: {
      tabs: [
        { label: 'Niche Templates', icon: nicheTemplatesIcon },
        { label: 'Niche Scripts', icon: nicheScriptsIcon },
        { label: 'Overlays', icon: overlaysIcon },
        { label: 'Preview', icon: previewIcon },
      ],
      activeTab: 0,
      closeButton: true,
      isExtendCloseButton: true,
      allowedMultiButton: false,
      className: 'template-generator-header',
    },
  },
  {
    id: CREATIVE_MODAL,
    className: `${TEMPLATE_GENERATOR_MODAL}-modal`,
    renderer: CreativeGeneratorModal,
    maxWidth: 'lg',
  },
  {
    id: CREATIVE_MODAL_CONTENT,
    className: `${TEMPLATE_GENERATOR_MODAL}-modal max-size content`,
    renderer: CreativeModalContent,
    maxWidth: false,
    header: {
      tabs: [
        { label: 'Lower Thirds', icon: lowerThirdIcon },
        { label: 'CTA & Modes', icon: ctaModesIcon },
        { label: 'Template Pack', icon: templatePackIcon },
      ],
      activeTab: 0,
      closeButton: true,
      isExtendCloseButton: true,
      allowedMultiButton: false,
      className: 'template-generator-header',
    },
  },
  {
    id: AI_ART_GENERATOR_MODAL,
    className: `${TEMPLATE_GENERATOR_MODAL}-modal max-size content`,
    renderer: AiArtGenerator,
    closeButton: true,
    isExtendCloseButton: true,
    maxWidth: 'lg',
  },
  {
    id: BG_DIFFUSION_MODAL,
    className: `${TEMPLATE_GENERATOR_MODAL}-modal max-size content`,
    renderer: BGDiffusion,
    closeButton: true,
    isExtendCloseButton: true,
    maxWidth: 'lg',
  },
  {
    id: PRESETS_MODAL,
    className: 'view-project-modal',
    renderer: PresetsModal,
    maxWidth: 'lg',
  },
  {
    id: IMAGE_LT_PRESETS_MODAL,
    className: 'view-project-modal',
    renderer: ImageLTPresetModal,
    maxWidth: 'lg',
  },
  {
    id: END_SCREENS_MODAL,
    className: 'view-project-modal',
    renderer: EndScreensModal,
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
    id: NICHE_SCRIPTS_PREVIEW_MODAL,
    className: `${NICHE_SCRIPTS_PREVIEW_MODAL}-modal`,
    renderer: NicheScriptsPreviewModal,
  },
  {
    id: IMAGE_CROPPER_MODAL,
    className: `${IMAGE_CROPPER_MODAL}-modal`,
    renderer: ImageCropperModal,
    maxWidth: 'lg',
  },
  {
    id: PIXO_IMAGE_EDITOR_MODAL,
    className: `${PIXO_IMAGE_EDITOR_MODAL}-modal`,
    renderer: PixoImageEditorModal,
    maxWidth: 'lg',
  },
  {
    id: IMGLY_IMAGE_EDITOR_MODAL,
    className: `${IMGLY_IMAGE_EDITOR_MODAL}-modal`,
    renderer: ImglyImageEditorModal,
    maxWidth: 'lg',
  },
  {
    id: IMGLY_IMAGE_EDITOR_MODAL_CROPPER,
    className: `${IMGLY_IMAGE_EDITOR_MODAL}-modal`,
    renderer: ImglyImageEditorModalCropper,
    maxWidth: 'lg',
  },
  {
    id: ADVANCE_IMAGE_EDITOR_MODAL,
    className: `${PIXO_IMAGE_EDITOR_MODAL}-modal`,
    renderer: AdvanceImageEditorModal,
    maxWidth: 'lg',
  },
  // {
  //   id: PINTURA_IMAGE_EDITOR_MODAL,
  //   className: `${PINTURA_IMAGE_EDITOR_MODAL}-modal`,
  //   renderer: PinturaImageEditorModal,
  //   maxWidth: 'lg',
  // },
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
  {
    id: CANCELLATION_MODAL,
    className: `${CANCELLATION_MODAL}-modal`,
    renderer: CancellationModal,
    maxWidth: 'xl',
    themeChange: true,
  },
  {
    id: DETAILS_MODAL,
    className: `${DETAILS_MODAL}-modal`,
    renderer: DetailsModal,
    maxWidth: 'xl',
    themeChange: true,
  },
  {
    id: PROJECT_SETTINGS_MODAL,
    className: `${PROJECT_SETTINGS_MODAL}-modal`,
    renderer: ProjectSettingsModal,
    maxWidth: 'xl',
    themeChange: true,
  },
  {
    id: FOLDER_MODAL,
    className: `${FOLDER_MODAL}-modal`,
    renderer: FolderModal,
    maxWidth: 'xl',
    themeChange: true,
  },
  {
    id: PASSPORT_MARKER_MODAL,
    className: `${PIXO_IMAGE_EDITOR_MODAL}-modal`,
    renderer: PassportMarkerModal,
    maxWidth: 'md',
  },
  {
    id: SOCIAL_PUBLISH_MODAL,
    className: `${SOCIAL_PUBLISH_MODAL}-modal`,
    renderer: SocialPublishModal,
    maxWidth: 'md',
  },
];
