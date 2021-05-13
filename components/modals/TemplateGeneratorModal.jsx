import React from 'react';
import { observer } from 'mobx-react';

import {
  TEMPLATE_GENERATOR_MODAL,
  TEMPLATE_GENERATOR_MODAL_CONTENT,
} from '../../lib/constants/modals';
import useModalStore from '../hooks/useModalStore';
import InitialModalContent from './TemplateGenerator/InitialModalContent';

const TemplateGeneratorModal = observer(({ handleClose }) => {
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
