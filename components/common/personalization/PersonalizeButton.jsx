import React from 'react';

import useModalStore from '../../hooks/useModalStore';

import PropTypes from '../../../lib/PropTypes';

import { PERSONALIZATION_MODAL } from '../../../lib/constants/modals';

const PersonalizeButton = ({ elementType }) => {
  const { openModal } = useModalStore();

  const openPersonalize = () => {
    openModal(PERSONALIZATION_MODAL, { elementType });
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
};

export default PersonalizeButton;
