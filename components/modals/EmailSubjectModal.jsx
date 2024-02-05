import * as React from 'react';

import PropTypes from '../../lib/PropTypes';

import Publisher from '../publisher/Publisher';
import EmailSubject from '../settings/email-subject/EmailSubject';

const EmailSubjectModal = ({ handleClose }) => (
  <Publisher withIframe={false}>
    {({ isLoading }) => <EmailSubject isLoading={isLoading} handleClose={handleClose} />}
  </Publisher>
);

EmailSubjectModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default EmailSubjectModal;
