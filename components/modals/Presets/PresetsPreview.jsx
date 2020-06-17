import React, { useRef } from 'react';

import usePresetStore from '../../hooks/usePresetStore';

import PropTypes from '../../../lib/PropTypes';

const PresetsPreview = ({ preview, activeItem }) => {
  const wrapper = useRef(null);
  const presetStore = usePresetStore();

  const playPause = async () => {
    await presetStore.setPopcorn(wrapper.current);
    await presetStore.playPause();
  };

  return (
    <div className="presets-preview" ref={wrapper}>
      {preview && <img src={preview} className="presets-preview__img" alt="preview" />}
      {
        activeItem && (
          <button
            className="presets-preview__play"
            onClick={playPause}
          >
            Play
          </button>
        )
      }
    </div>
  );
};

PresetsPreview.propTypes = {
  preview: PropTypes.string,
  activeItem: PropTypes.shape(),
};

export default PresetsPreview;
