import { observable, action } from 'mobx';

import SocialCampaignModal from '../../components/modals/SocialCampaignModal';

export const SOCIAL_CAMPAIGN_MODAL = 'social-campaign';
export const EMAIL_CAMPAIGN_MODAL = 'email-campaign';

export default (/* { request  } */) => {
  const modalIds = observable([]);

  const modals = [
    {
      id: SOCIAL_CAMPAIGN_MODAL,
      className: `${SOCIAL_CAMPAIGN_MODAL}-modal`,
      renderer: SocialCampaignModal,
      title: 'Social Campaigns',
    },
  ];

  const openModal = (modalId) => {
    if (!modalId) return;
    if (!modalIds.includes(modalId)) {
      modalIds.push(modalId);
    }
  };

  const closeModal = (modalId) => {
    if (!modalId) return;
    modalIds.remove(modalId);
  };

  return {
    modalIds,
    modals,
    openModal: action(openModal),
    closeModal: action(closeModal),
  };
};
