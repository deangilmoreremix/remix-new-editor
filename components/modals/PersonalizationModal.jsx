import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';

import Personalization from '../common/personalization/Personalization';
import mediaConstants from '../../lib/constants/media';
import { tokens, imgTokens } from '../../lib/constants/tokens';

const PersonalizationModal = observer(({ handleClose, options: { elementType } }) => {
  const tokensArr = elementType && elementType === mediaConstants.ASSET_TYPES.IMAGE
    ? imgTokens
    : tokens;
  return (
    <Personalization
      closeModal={handleClose}
      itemsToken={tokensArr}
    />
  );
});

PersonalizationModal.PropTypes = {
  handleClose: PropTypes.func.isRequired,
  elementType: PropTypes.string,
};

export default PersonalizationModal;
