import React, { useEffect, useRef } from 'react';

import usePresetStore from '../../hooks/usePresetStore';

import PropTypes from '../../../lib/PropTypes';

const PresetsPreview = ({ preview, items }) => {
  const wrapper = useRef(null);
  const presetStore = usePresetStore();

  const playPause = () => {
    presetStore.setPopcorn(wrapper.current);
  };

  return (
    <div className="presets-preview" ref={wrapper}>
      {preview && <img src={preview} className="presets-preview__img" alt="preview" />}
      {
        items && items.length && (
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
  items: PropTypes.arrayOrObservableArray,
};

export default PresetsPreview;
