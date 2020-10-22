import React from 'react';
import classnames from 'classnames';

import useModalStore from '../../hooks/useModalStore';

import PropTypes from '../../../lib/PropTypes';

import { PERSONALIZATION_MODAL } from '../../../lib/constants/modals';

const PersonalizeButton = ({ elementType, onAdd, text, className, disabled, tokenModes }) => {
  const { openModal } = useModalStore();

  const openPersonalize = () => {
    openModal(PERSONALIZATION_MODAL, { elementType, onAdd, tokenModes });
  };

  return (
    <div className={classnames('personalize-container', className)}>
      <button
        className={classnames('btn-personalize', { 'btn-personalize-disabled': disabled })}
        onClick={() => openPersonalize()}
        disabled={disabled}
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
  disabled: PropTypes.bool,
  tokenModes: PropTypes.shape({
    plain: PropTypes.string,
    fallbackValue: PropTypes.string,
    uppercase: PropTypes.string,
  }),
};

PersonalizeButton.defaultProps = {
  text: 'Personalize',
  disabled: false,
};

export default PersonalizeButton;
