import React from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import { LIBRARY_TABS } from '../../lib/constants/library';

import useUIStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';

import svgTextToSpeech from '../../public/static/images/toolbar/voice.svg';
import svgArrow from '../../public/static/images/double-arrow.svg';

const VoiceModal = ({ handleClose }) => {
  const { toggleRightBlock, openMediaButton } = useUIStore();
  const { releaseElement } = useProjectStore();

  const goToLibrary = () => {
    handleClose();
    toggleRightBlock();
    releaseElement();
    openMediaButton(LIBRARY_TABS.VOICE);
  };

  return (
    <div className="voice-modal__container">
      <div className="voice-modal__header">Text to speech</div>
      <div className="voice-modal__body">
        <SVGInline
          className="voice-modal__icon"
          svg={svgTextToSpeech}
          cleanup={['title']}
        />
        <p className="voice-modal__text">Your voice is recorded and added to the library</p>
        <button className="voice-modal__btn" onClick={goToLibrary}>
          <span>Got to the library</span>
          <SVGInline
            className="voice-modal__icon-arrow"
            svg={svgArrow}
            cleanup={['title']}
          />
        </button>
      </div>
    </div>
  );
};

VoiceModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default VoiceModal;
