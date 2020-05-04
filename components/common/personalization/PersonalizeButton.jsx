import React from 'react';

import useModalStore from '../../hooks/useModalStore';

import PropTypes from '../../../lib/PropTypes';

import { PERSONALIZATION_MODAL } from '../../../lib/constants/modals';

const PersonalizeButton = ({ elementType, onAdd }) => {
  const { openModal } = useModalStore();

  const openPersonalize = () => {
    openModal(PERSONALIZATION_MODAL, { elementType, onAdd });
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

PersonalizeButton.propTypes = {
  elementType: PropTypes.string,
  onAdd: PropTypes.func.isRequired,
};

export default PersonalizeButton;
