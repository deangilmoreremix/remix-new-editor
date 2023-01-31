import React from 'react';
import { observer } from 'mobx-react';

import {
  CREATIVE_MODAL,
  CREATIVE_MODAL_CONTENT,
} from '../../lib/constants/modals';
import useModalStore from '../hooks/useModalStore';
import InitialModalContent from './TemplateGenerator/InitialModalContent';

const CreativeGeneratorModal = observer(({ handleClose }) => {
  const { openModal, closeModal } = useModalStore();
  const accept = () => {
    openModal(CREATIVE_MODAL_CONTENT);
    closeModal(CREATIVE_MODAL);
  };

  return (
    <InitialModalContent
      accept={accept}
      decline={handleClose}
    />
  );
});

export default CreativeGeneratorModal;
