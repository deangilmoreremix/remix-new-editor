import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';

import Personalization from '../common/personalization/Personalization';

import { POPCORN_ELEMENT_TYPES } from '../../lib/constants/popcorn';
import { tokens, imgTokens } from '../../lib/constants/tokens';

const PersonalizationModal = observer(({ handleClose, options: { elementType } }) => {
  const tokensArr = elementType && elementType === POPCORN_ELEMENT_TYPES.IMAGE
    ? imgTokens
    : tokens;
  return (
    <Personalization
      closeModal={handleClose}
      tokenList={tokensArr}
    />
  );
});

PersonalizationModal.PropTypes = {
  handleClose: PropTypes.func.isRequired,
  elementType: PropTypes.string,
};

export default PersonalizationModal;
