import { observable, action } from 'mobx';

import SocialPublisherModal from '../../components/modals/SocialPublisherModal';
import { SOCIAL_CAMPAIGN_MODAL } from '../../lib/constants/modals';

const modalsConfig = [
  {
    id: SOCIAL_CAMPAIGN_MODAL,
    className: `${SOCIAL_CAMPAIGN_MODAL}-modal`,
    renderer: SocialPublisherModal,
    title: 'Social Campaigns',
  },
];

export default () => {
  const modalIds = observable.set([]);

  const modals = observable(modalsConfig);

  const openModal = (modalId) => {
    if (modalId) modalIds.add(modalId);
  };

  const closeModal = (modalId) => {
    if (modalId) {
      modalIds.delete(modalId);
    }
  };

  const updateTitle = (modalId, title) => {
    if (modalId) {
      const mutatedModalIndex = modals.findIndex(modal => modal.id === modalId);
      const originalModal = modalsConfig.find(modal => modal.id === modalId);

      modals[mutatedModalIndex].title = title || originalModal.title;
    }
  };

  return {
    modalIds,
    modals,
    openModal: action(openModal),
    closeModal: action(closeModal),
    updateTitle: action(updateTitle),
  };
};
