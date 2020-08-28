import * as React from 'react';

import PropTypes from '../../lib/PropTypes';

import Publisher from '../publisher/Publisher';
import EmailCampaign from '../publisher/flows/email/EmailCampaign';

const EmailCampaignModal = ({ handleClose }) => (
  <Publisher withIframe={false}>
    {({ isLoading }) => <EmailCampaign isLoading={isLoading} handleClose={handleClose} />}
  </Publisher>
);

EmailCampaignModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default EmailCampaignModal;
