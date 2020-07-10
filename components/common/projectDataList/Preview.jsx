import React, { useCallback, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import usePresetStore from '../../hooks/usePresetStore';

import PropTypes from '../../../lib/PropTypes';

const Preview = observer(({ preview, activeItem, className }) => {
  const wrapper = useRef(null);
  const { isPlayed, setPopcorn, playPreset, destroyPopcorn } = usePresetStore();

  useEffect(() => {
    if (wrapper && activeItem) {
      destroyPopcorn();
      setPopcorn(wrapper.current);
    }
  }, [wrapper, activeItem]);

  useEffect(() => () => destroyPopcorn(), []);

  const play = useCallback(() => {
    playPreset();
  }, [activeItem]);

  return (
    <div className={classnames('presets-preview', className)} ref={wrapper}>
      {preview && !isPlayed && <img src={preview} className="presets-preview__img" alt="preview" />}
      <div className={classnames(
        'presets-button-block',
        { 'presets-button-bg': !preview && !isPlayed, 'presets-button-active': isPlayed },
      )}
      >
        { activeItem && !isPlayed && (
          <button
            className="presets-preview__play"
            onClick={play}
          />
        )}
      </div>
    </div>
  );
});

Preview.propTypes = {
  preview: PropTypes.string,
  activeItem: PropTypes.shape(),
  className: PropTypes.string,
};

export default Preview;
