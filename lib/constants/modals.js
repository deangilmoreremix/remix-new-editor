import React from 'react';

// All modal renderers are React.lazy so importing this registry does NOT
// eagerly pull all ~35 modal component trees (many share heavy/legacy deps).
// Each modal file loads only when its ID is opened. IDs/config below are
// unchanged — this only changes HOW each renderer is loaded. (Replaces the
// former next/dynamic + eager static imports, both dead/eager in Vite.)
const SocialPublisherModal = React.lazy(() => import('../../components/modals/SocialPublisherModal'));
const EmailCampaingModal = React.lazy(() => import('../../components/modals/EmailCampaignModal'));
const SaveProjectModal = React.lazy(() => import('../../components/modals/SaveProjectModal'));
const RetargetOptInModal = React.lazy(() => import('../../components/modals/RetargetOptInModal'));
const PersonalizationModal = React.lazy(() => import('../../components/modals/PersonalizationModal'));
const TemplateGeneratorModal = React.lazy(() => import('../../components/modals/TemplateGeneratorModal'));
const PresetsModal = React.lazy(() => import('../../components/modals/Presets'));
const ImageLTPresetModal = React.lazy(() => import('../../components/modals/ImageLTPresets'));
const EndScreensModal = React.lazy(() => import('../../components/modals/EndScreen'));

const ConnectModal = React.lazy(() => import('../../components/modals/Connect'));
const VideoPlayerModal = React.lazy(() => import('../../components/modals/VideoPlayerModal'));
const NicheScriptsModal = React.lazy(() => import('../../components/modals/TemplateGenerator/NicheScriptsModalContent'));
const NicheScriptsPreviewModal = React.lazy(() => import('../../components/modals/TemplateGenerator/NicheScriptsPreviewModal'));
const ImageCropperModal = React.lazy(() => import('../../components/modals/ImageCropperModal'));
const VoiceModal = React.lazy(() => import('../../components/modals/VoiceModal'));
const PreRemixVoiceModal = React.lazy(() => import('../../components/modals/PreRemixVoiceModal'));
const PreviewMediaModal = React.lazy(() => import('../../components/modals/PreviewMediaModal'));
const UrlVideoModal = React.lazy(() => import('../../components/modals/UrlVideoModal'));
const SafariWarningModal = React.lazy(() => import('../../components/modals/SafariWarningModal'));
const PageShotModal = React.lazy(() => import('../../components/modals/PageShotModal'));
const EnhancedRecorderModal = React.lazy(() => import('../../components/modals/EnhancedRecorderModal'));
const TemplatePreviewModal = React.lazy(() => import('../../components/modals/Templates/TemplatePreviewModal'));
const CancellationModal = React.lazy(() => import('../../components/modals/Billing/CancellationModal'));
const DetailsModal = React.lazy(() => import('../../components/modals/Billing/DetailsModal'));
const ProjectSettingsModal = React.lazy(() => import('../../components/modals/Projects/ProjectSettingsModal'));
const FolderModal = React.lazy(() => import('../../components/modals/Projects/FolderModal'));
const ModalContent = React.lazy(() => import('../../components/modals/TemplateGenerator/ModalContent'));

// Tab icons for TEMPLATE_GENERATOR_MODAL_CONTENT. These were top-level
// `import x from '...svg'` statements, but that public/ asset import rejects
// at runtime under this repo's Vite public-url handling and took the whole
// registry (and every modal) down with it. They only feed header.tabs[].icon,
// which ModalContainer skips for now. Use the plain public URL strings so the
// registry loads; the icon values are unchanged.
const nicheScriptsIcon = '/static/svgImages/template-generator/niche-scripts-icon.svg';
const nicheTemplatesIcon = '/static/svgImages/template-generator/niche-templates-icon.svg';
const overlaysIcon = '/static/svgImages/template-generator/overlays-icon.svg';
const previewIcon = '/static/svgImages/template-generator/preview-icon.svg';

const RecorderModal = React.lazy(() => import('../../components/modals/RecorderModal'));
const ImglyImageEditorModal = React.lazy(() => import('../../components/modals/ImglyImageEditorModal'));
const ImglyImageEditorModalCropper = React.lazy(() => import('../../components/modals/ImglyImageEditorModalCropper'));
const SocialPublishModal = React.lazy(() => import('../../components/modals/SocialPublishModal'));

const VideoPersonalizationHub = React.lazy(() => import('../../components/VideoPersonalizationHub'));


export const SOCIAL_CAMPAIGN_MODAL = 'social-campaign';
export const EMAIL_CAMPAIGN_MODAL = 'email-campaign';
export const RETARGET_OPT_IN_MODAL = 'retarget-opt-in';
export const SAVE_PROJECT_MODAL = 'save-project';
export const PERSONALIZATION_MODAL = 'personalization';
export const RECORDER_MODAL = 'recorder';
export const ENHANCED_RECORDER_MODAL = 'enhanced-recorder';
export const TEMPLATE_GENERATOR_MODAL = 'template-generator';
export const TEMPLATE_GENERATOR_MODAL_CONTENT = 'template-generator-content';
export const SAFARI_WARNING_MODAL = 'safari-warning';
export const PRESETS_MODAL = 'presets';
export const IMAGE_LT_PRESETS_MODAL = 'image-lt-presets';
export const END_SCREENS_MODAL = 'end-screens';
export const VIDEO_PERSONALIZER_MODAL = 'video-personalizer';

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
export const PAGE_SHOT_MODAL = 'page-shot';
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
    id: ENHANCED_RECORDER_MODAL,
    className: `${ENHANCED_RECORDER_MODAL}-modal`,
    renderer: EnhancedRecorderModal,
    maxWidth: 'xl',
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
    id: URL_VIDEO_MODAL,
    className: `${URL_VIDEO_MODAL}-modal`,
    renderer: UrlVideoModal,
    maxWidth: 'xl',
  },
  {
    id: PAGE_SHOT_MODAL,
    className: `${PAGE_SHOT_MODAL}-modal`,
    renderer: PageShotModal,
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
    id: VIDEO_PERSONALIZER_MODAL,
    className: `${VIDEO_PERSONALIZER_MODAL}-modal`,
    renderer: VideoPersonalizationHub,
    maxWidth: 'xl',
    themeChange: true,
  },
  {
    id: SOCIAL_PUBLISH_MODAL,
    className: `${SOCIAL_PUBLISH_MODAL}-modal`,
    renderer: SocialPublishModal,
    maxWidth: 'md',
  },
];
