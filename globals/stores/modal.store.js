import { set, observable, action } from 'mobx';

import { MODAL_CONFIG } from '../../lib/constants/modals';

export default () => {
  const modalIds = observable.set([]);

  const modals = observable(MODAL_CONFIG);

  const options = observable({});

  const openModal = (modalId, modalOptions) => {
    if (modalId) {
      modalIds.add(modalId);
      if (modalOptions) {
        set(options, { ...modalOptions });
      }
    }
  };

  const closeModal = (modalId) => {
    if (modalId) {
      modalIds.delete(modalId);
      set(options, {});
    }
  };

  const updateHeader = (modalId, header) => {
    if (modalId) {
      const mutatedModalIndex = modals.findIndex(modal => modal.id === modalId);
      const originalModal = MODAL_CONFIG.find(modal => modal.id === modalId);

      modals[mutatedModalIndex].header = header || originalModal.header;
    }
  };

  const updateClassName = (modalId, className) => {
    if (modalId) {
      const mutatedModalIndex = modals.findIndex(modal => modal.id === modalId);
      const originalModal = MODAL_CONFIG.find(modal => modal.id === modalId);

      modals[mutatedModalIndex].className = className || originalModal.className;
    }
  };

  return {
    modalIds,
    modals,
    openModal: action(openModal),
    closeModal: action(closeModal),
    updateHeader: action(updateHeader),
    updateClassName: action(updateClassName),
    options,
  };
};
