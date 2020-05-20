import React from 'react';
import classnames from 'classnames';

import useModalStore from '../../hooks/useModalStore';

import PropTypes from '../../../lib/PropTypes';

import { PERSONALIZATION_MODAL } from '../../../lib/constants/modals';

const PersonalizeButton = ({ elementType, onAdd, text, className }) => {
  const { openModal } = useModalStore();

  const openPersonalize = () => {
    openModal(PERSONALIZATION_MODAL, { elementType, onAdd });
  };

  return (
    <div className={classnames('personalize-container', className)}>
      <button
        className="btn-personalize"
        onClick={() => openPersonalize()}
      >
        {text}
      </button>
    </div>
  );
};

PersonalizeButton.propTypes = {
  elementType: PropTypes.string,
  onAdd: PropTypes.func.isRequired,
  text: PropTypes.string,
  className: PropTypes.string,
};

PersonalizeButton.defaultProps = {
  text: 'Personalize',
};

export default PersonalizeButton;
