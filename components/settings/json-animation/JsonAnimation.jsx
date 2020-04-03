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

const JsonAnimation = ({ tab = BASIC, element, update }) => {
  const Tab = TabMap[tab];
  console.log('SVGPresets element', element);

  const handleChange = (field) => {
    console.log('SVGPresets onChange ', { ...field });
    update(field);
  };

  const handleSetColors = (colors) => {
    console.log('SVGPresets updating colors', colors);
  };

  console.log('SVGPresets popcornOptions', element && element.popcornOptions);

  return (
    <div className="svg-presets-form">
      {element && element.popcornOptions && (
        <Tab options={element.popcornOptions} onChange={handleChange} />
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
};

export default JsonAnimation;
