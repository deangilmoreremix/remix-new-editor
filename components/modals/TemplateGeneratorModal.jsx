import React, { useEffect } from 'react';
import { observer } from 'mobx-react';

import {
  TEMPLATE_GENERATOR_MODAL,
  TEMPLATE_GENERATOR_MODAL_CONTENT,
} from '../../lib/constants/modals';
import useModalStore from '../hooks/useModalStore';
import InitialModalContent from './TemplateGenerator/InitialModalContent';
import { useRouter } from 'next/router';

const TemplateGeneratorModal = observer(({ handleClose }) => {
  const {
    pathname,
    query: { isAutomationCreator },
    push,
  } = useRouter();
  useEffect(() => {
    const automationCreator = (isAutomationCreator === "true");
    if(automationCreator) {
      openModal(TEMPLATE_GENERATOR_MODAL_CONTENT);
      closeModal(TEMPLATE_GENERATOR_MODAL);
    }
  },[])
  const { openModal, closeModal } = useModalStore();
  const accept = () => {
    openModal(TEMPLATE_GENERATOR_MODAL_CONTENT);
    closeModal(TEMPLATE_GENERATOR_MODAL);
  };

  return (
    <InitialModalContent
      accept={accept}
      decline={handleClose}
    />
  );
});

export default TemplateGeneratorModal;
