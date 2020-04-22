import SocialPublisherModal from '../../components/modals/SocialPublisherModal';
import EmailCampaingModal from '../../components/modals/EmailCampaignModal';
import SaveProjectModal from '../../components/modals/SaveProjectModal';
import RetargetOptInModal from '../../components/modals/RetargetOptInModal';
import SettingsModal from '../../components/modals/SettingsModal';

export const SOCIAL_CAMPAIGN_MODAL = 'social-campaign';
export const EMAIL_CAMPAIGN_MODAL = 'email-campaign';
export const RETARGET_OPT_IN_MODAL = 'retarget-opt-in';
export const SAVE_PROJECT_MODAL = 'save-project';
export const SETTINGS_MODAL = 'settings';

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
    id: SETTINGS_MODAL,
    className: `${SETTINGS_MODAL}-modal`,
    renderer: SettingsModal,
    header: {
      tabs: [{
        label: 'SETTINGS',
      }],
      activeTab: 0,
      className: 'settings-header',
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
];
