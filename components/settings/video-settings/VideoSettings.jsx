import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { CLIP_EDITOR_TAB } from '../../../lib/constants/popcorn';
import ClipEditor from './tabs/ClipEditor';

const TabMap = {
  [CLIP_EDITOR_TAB]: ClipEditor,
};

const VideoSettings = observer(({ tab = CLIP_EDITOR_TAB, element, update, fields }) => {
  const Tab = TabMap[tab];
  const handleChange = (value, options) => {
    let newOptions = { ...value };
    if (options) {
      newOptions = { ...newOptions, ...options };
    }
    update(newOptions);
  };

  return (
    <div className="video-settings-form">
      {element && element.popcornOptions && (
        <Tab
          values={element.popcornOptions}
          onChange={(field, options) => handleChange(field, options)}
          fields={fields}
          element={element}
        />
      )}
    </div>
  );
});

VideoSettings.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    track: PropTypes.string.isRequired,
    popcornOptions: PropTypes.shape({
      url: PropTypes.string,
    }).isRequired,
  }).isRequired,
  tab: PropTypes.string,
  update: PropTypes.func.isRequired,
};

export default VideoSettings;
