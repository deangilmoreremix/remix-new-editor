import React, { useCallback, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import usePresetStore from '../../hooks/usePresetStore';

import { DEFAULT_FONT_SIZE, DEFAULT_VIDEO_WIDTH, DEFAULT_THUMBNAIL } from '../../../lib/constants/project';
import PropTypes from '../../../lib/PropTypes';

const Preview = observer(({ preview, activeItem, className, instantStart }) => {
  const [fontSize, setFontSize] = React.useState(DEFAULT_FONT_SIZE);
  const wrapper = useRef(null);
  const { isPlayed, setPopcorn, playPreset, destroyPopcorn } = usePresetStore();

  useEffect(() => {
    if (wrapper && activeItem) {
      destroyPopcorn();
      setPopcorn(wrapper.current);
    }
  }, [wrapper, activeItem]);

  useEffect(() => () => destroyPopcorn(), []);

  useEffect(() => {
    if (wrapper.current) {
      setFontSize(`${DEFAULT_FONT_SIZE * (wrapper.current.offsetWidth / DEFAULT_VIDEO_WIDTH)}px`);
    }
  }, []);

  const play = useCallback(() => {
    playPreset();
  }, [activeItem]);

  return (
    <div className={classnames('project-data-preview', className)} ref={wrapper} style={{ fontSize }}>
      {instantStart && !preview ? (
        <div className="project-data-preview__unselect" />
      ) : (
        <div className={classnames(
          'project-data-preview__button-block',
          { 'project-data-preview__button-bg': !preview && !isPlayed, 'project-data-preview__button-active': isPlayed },
        )}
        >
          { activeItem && !isPlayed && (
            <button
              className="project-data-preview__play"
              onClick={play}
            />
          )}
        </div>
      )}
    </div>
  );
});

Preview.propTypes = {
  preview: PropTypes.string,
  activeItem: PropTypes.shape(),
  className: PropTypes.string,
  instantStart: PropTypes.bool,
};

Preview.defaultProps = {
  instantStart: false,
};

export default Preview;
