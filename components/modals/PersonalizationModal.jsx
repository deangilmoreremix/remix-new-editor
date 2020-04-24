import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';

import Personalization from '../common/personalization/Personalization';

const PersonalizationModal = observer(({ handleClose, options: { elementType } }) => (
  <Personalization
    closeModal={handleClose}
    type={elementType}
  />
));

PersonalizationModal.PropTypes = {
  handleClose: PropTypes.func.isRequired,
  type: PropTypes.func.string,
};

export default PersonalizationModal;
