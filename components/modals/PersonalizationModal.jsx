import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';

import Personalization from '../common/personalization/Personalization';

import { POPCORN_ELEMENT_TYPES } from '../../lib/constants/popcorn';
import { tokens, imgTokens } from '../../lib/constants/tokens';

const PersonalizationModal = observer((props) => {
  const {
    handleClose,
    options: { elementType, onAdd, tokenModes },
  } = props;

  const tokensArr = elementType && elementType === POPCORN_ELEMENT_TYPES.IMAGE
    ? imgTokens
    : tokens;
  return (
    <Personalization
      closeModal={handleClose}
      tokenList={tokensArr}
      onAdd={onAdd}
      elementType={elementType}
      tokenModes={tokenModes}
    />
  );
});

PersonalizationModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  elementType: PropTypes.string,
  tokenModes: PropTypes.shape({
    plain: PropTypes.string,
    fallbackValue: PropTypes.string,
    uppercase: PropTypes.string,
  }),
};

export default PersonalizationModal;
