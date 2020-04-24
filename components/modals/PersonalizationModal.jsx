import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';

import Personalization from '../common/personalization/Personalization';

const PersonalizationModal = observer(({ handleClose }) => (
  <Personalization
    closeModal={handleClose}
  />
));

PersonalizationModal.PropTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default PersonalizationModal;
