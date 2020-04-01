import * as React from 'react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC, ADVANCED } from '../../../lib/constants/settings/svg-preset';
import LottieEditor from '../../common/LottieEditor';
import Basic from './tabs/Basic';
import Advanced from './tabs/Advanced';

const TabMap = {
  [BASIC]: Basic,
  [ADVANCED]: Advanced,
};

const SVGPresets = ({ tab = BASIC, element, update }) => {
  const Tab = React.useMemo(() => TabMap[tab], [tab]);

  const handleChange = (field) => {
    console.log('SVGPresets onChange ', { ...field });
    // const newOptions = { ...field };
    update(field);
  };

  const handleSetColors = (colors) => {
    console.log('SVGPresets updating colors', colors);
  };

  const { popcornOptions } = element || {};

  console.log('SVGPresets popcornOptions', popcornOptions);

  return (
    <div className="svg-presets-form">
      {popcornOptions && (
        <Tab options={popcornOptions} onChange={handleChange} />
      )}
      {popcornOptions && popcornOptions.url && (
        <LottieEditor
          showControls
          file={popcornOptions.url}
          setColor={handleSetColors}
        />
      )}
    </div>
  );
};

SVGPresets.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.number.isRequired,
    popcornOptions: PropTypes.shape({
      url: PropTypes.string,
    }),
  }).isRequired,
  tab: PropTypes.string.isRequired,
  update: PropTypes.func.isRequired,
};

export default SVGPresets;
