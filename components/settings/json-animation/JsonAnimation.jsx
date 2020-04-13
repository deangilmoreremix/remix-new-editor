import * as React from 'react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC, ADVANCED } from '../../../lib/constants/settings/json-animation';
import LottieEditor from '../../common/LottieEditor';
import Basic from './tabs/Basic';
import Advanced from './tabs/Advanced';

const TabMap = {
  [BASIC]: Basic,
  [ADVANCED]: Advanced,
};

const JsonAnimation = ({ tab = BASIC, element, update, fields }) => {
  const Tab = TabMap[tab];
  const handleChange = (field) => {
    update(field);
  };

  const handleSetColors = (colors) => {
    console.log('SVGPresets updating colors', colors);
  };

  return (
    <div className="json-animation-form">
      {element && element.popcornOptions && (
        <Tab options={element.popcornOptions} onChange={handleChange} fields={fields} />
      )}
      {element && element.popcornOptions && element.popcornOptions.url && (
        <LottieEditor
          showControls
          file={element.popcornOptions.url}
          setColor={handleSetColors}
        />
      )}
    </div>
  );
};

JsonAnimation.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string,
    popcornOptions: PropTypes.shape({
      url: PropTypes.string,
    }),
  }),
  tab: PropTypes.string.isRequired,
  update: PropTypes.func.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  fields: PropTypes.object,
};

export default JsonAnimation;
