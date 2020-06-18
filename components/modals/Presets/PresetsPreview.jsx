import React, { useCallback, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';

import usePresetStore from '../../hooks/usePresetStore';

import PropTypes from '../../../lib/PropTypes';

const PresetsPreview = observer(({ preview, activeItem }) => {
  const wrapper = useRef(null);
  const { isPlayed, setPopcorn, playPause, destroyPopcorn } = usePresetStore();

  useEffect(() => {
    if (wrapper && activeItem) {
      destroyPopcorn();
      setPopcorn(wrapper.current);
    }
  }, [wrapper, activeItem]);

  const play = useCallback(async () => {
    await playPause();
  }, [activeItem]);

  return (
    <div className="presets-preview" ref={wrapper}>
      {preview && !isPlayed && <img src={preview} className="presets-preview__img" alt="preview" />}
      {
        activeItem && !isPlayed && (
          <div className="presets-button-block">
            <button
              className="presets-preview__play"
              onClick={play}
            />
          </div>
        )
      }
    </div>
  );
});

PresetsPreview.propTypes = {
  preview: PropTypes.string,
  activeItem: PropTypes.shape(),
};

export default PresetsPreview;
