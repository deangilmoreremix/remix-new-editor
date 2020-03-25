import * as React from 'react';

import Publisher from '../publisher/Publisher';
import EmailCampaign from '../publisher/flows/email/EmailCampaign';

const EmailCampaignModal = () => (
  <Publisher withIframe={false}>
    {({ isLoading }) => <EmailCampaign isLoading={isLoading} />}
  </Publisher>
);

EmailCampaignModal.propTypes = {};

export default EmailCampaignModal;
