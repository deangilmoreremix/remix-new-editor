import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC, ADVANCED } from '../../../lib/constants/settings/vrtext-preset';
import Basic from './tabs/Basic';
import Advanced from './tabs/Advanced';


const TabMap = {
  [BASIC]: Basic,
  [ADVANCED]: Advanced,
};

const VRTEXTPreset = observer(({ tab = Basic, element, update }) => {
  console.log('eleemnt', element);
  const Tab = React.useMemo(() => TabMap[tab], [tab]);

  const handleChange = (field) => {
    console.log('SVGPresets onChange ', { ...field });
    // const newOptions = { ...field };
    update(field);
  };

  // const handleSetColors = (colors) => {
  //   console.log('SVGPresets updating colors', colors);
  // };

  const { popcornOptions } = element || {};

  console.log(' popcornOptions', popcornOptions);

  return (
    <div className="vrtext-presets-form">
      {popcornOptions && (
        <Tab options={popcornOptions} onChange={handleChange} />
      )}
    </div>
  );
});

VRTEXTPreset.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.number.isRequired,
    popcornOptions: PropTypes.shape({
      url: PropTypes.string,
    }),
  }).isRequired,
  tab: PropTypes.string.isRequired,
  update: PropTypes.func.isRequired,
};

export default VRTEXTPreset;
