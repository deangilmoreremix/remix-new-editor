import React from 'react';
import PropTypes from 'prop-types';
import SVGInline from 'react-svg-inline';
import ErrorIcon from '@material-ui/icons/Error';

import generatorImg from '../../../public/static/images/generator.svg';
import HelpIconComponent from '../../common/HelpIcon';
import { mainTooltips } from '../../../lib/constants/tooltips';
import { WARNINGS } from '../../../lib/constants/text-info';

export default function InitialModalContent({ accept, decline }) {
  const [isWarningClosed, setWarning] = React.useState(false);

  const ua = navigator.userAgent;
  const isSafari = (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1);

  return (
    <>
      { (!isSafari || isWarningClosed) ? (
        <>
          <div className="generator-offer__text-box">
            <p className="generator-offer__text">Do you want to use the Template Generator?</p>
            <HelpIconComponent mouseEntered isBottom message={mainTooltips.templateGenerator} />
          </div>
          <SVGInline
            className="generator-img"
            svg={generatorImg}
            cleanup={['title']}
          />
          <div className="generator-offer__btns">
            <button
              className="generator-offer__btn generator-offer__yes"
              onClick={accept}
            >
              Yes
            </button>
            <button
              className="generator-offer__btn generator-offer__no"
              onClick={decline}
            >
              No, thanks
            </button>
          </div>
        </>
      ) : (
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
          <button
            className="generator-offer__btn generator-offer__yes"
            onClick={() => setWarning(true)}
          >
            Accept
          </button>
        </>
      )}
    </>
  );
}

InitialModalContent.propTypes = {
  accept: PropTypes.func.isRequired,
  decline: PropTypes.func.isRequired,
};
