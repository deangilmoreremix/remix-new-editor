import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';

import Publisher from '../publisher/Publisher';
import CampaignSelector from '../publisher/flows/CampaignSelector';

@inject('common')
@observer
class SocialPublisherModal extends Component {
  render() {
    return (
      <div className="social-campaign-modal">
        <Publisher>
          {props => <CampaignSelector {...props} />}
        </Publisher>
      </div>
    );
  }
}

SocialPublisherModal.propTypes = {
  setHeader: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default SocialPublisherModal;
