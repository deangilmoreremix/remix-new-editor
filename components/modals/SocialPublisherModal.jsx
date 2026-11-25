// Legacy social *campaign* tool (iframe-based Facebook / LinkedIn campaigns, opened as SOCIAL_CAMPAIGN_MODAL).
// It is NOT the "Publish to Social" modal. To publish or schedule a post from a studio, call openSocialPublish()
// (src/lib/socialPublishHelpers.js), which opens components/modals/SocialPublishModal.jsx.
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
