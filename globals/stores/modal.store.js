import { observable, action } from 'mobx';

import BaseStore from './base.store';
import SocialCampaignModal from '../../components/modals/SocialCampaignModal';

export const SOCIAL_CAMPAIGN_MODAL = 'social-campaign';
export const EMAIL_CAMPAIGN_MODAL = 'email-campaign';

export default class ModalStore extends BaseStore {
  @observable modalIds = new Set([]);

  @observable modals = [
    {
      id: SOCIAL_CAMPAIGN_MODAL,
      className: `${SOCIAL_CAMPAIGN_MODAL}-modal`,
      renderer: SocialCampaignModal,
      title: 'Social Campaigns',
    },
  ];

  @action
  openModal = (modalId) => {
    console.log('opening modal ', modalId);
    if (!modalId) return;
    this.modalIds.add(modalId);
    console.log('this.modalIds => ', this.modalIds);
  };

  @action
  closeModal = (modalId) => {
    console.log('closing modal ', modalId);
    if (!modalId) return;
    this.modalIds.delete(modalId);
  };
}
