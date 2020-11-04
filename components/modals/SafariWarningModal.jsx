import React from 'react';
import ErrorIcon from '@material-ui/icons/Error';
import PropTypes from '../../lib/PropTypes';
import { WARNINGS } from '../../lib/constants/text-info';

const SafariWarningModal = ({ handleClose }) => (
  <>
    <div className="generator-offer__warning">
      <ErrorIcon className="generator-offer__warning-icon" />
      <span className="generator-offer__warning-text">
        We recommend using
        <a href="https://www.google.com/chrome/" className="generator-offer__warning-link">Google Chrome</a>
        browser for the best experience.
      </span>
      <p className="generator-offer__warning-small-text">{WARNINGS.safariExpected}</p>
    </div>
    <div className="generator-offer__btns">
      <button
        className="generator-offer__btn generator-offer__yes"
        onClick={handleClose}
      >
        Accept
      </button>
    </div>
  </>
);

SafariWarningModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default SafariWarningModal;
