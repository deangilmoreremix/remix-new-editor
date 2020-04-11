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
  const Tab = TabMap[tab];

  const handleChange = (field) => {
    update(field);
  };

  return (
    <div className="vrtext-presets-form">
      {element && element.popcornOptions && (
        <Tab options={element.popcornOptions} onChange={handleChange} />
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
