import React from 'react';

import useModalStore from '../../hooks/useModalStore';

import { PERSONALIZATION_MODAL } from '../../../lib/constants/modals';

const PersonalizeButton = () => {
  const { openModal } = useModalStore();

  const openPersonalize = () => {
    openModal(PERSONALIZATION_MODAL);
  };

  return (
    <div className="personalize-container">
      <button
        className="btn-personalize"
        onClick={() => openPersonalize()}
      >
        Personalize
      </button>
    </div>
  );
};


export default PersonalizeButton;
