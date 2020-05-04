import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC, ADVANCED } from '../../../lib/constants/popcorn';
import Basic from './tabs/Basic';
import Advanced from './tabs/Advanced';

const TabMap = {
  [BASIC]: Basic,
  [ADVANCED]: Advanced,
};

const TextSettings = observer(({ tab = BASIC, element, update, fields, handleClose }) => {
  const Tab = TabMap[tab];

  const handleChange = (value, options) => {
    let newOptions = { ...value };
    if (options) {
      newOptions = { ...newOptions, ...options };
    }
    update(newOptions);
  };

  return (
    <div className="text-form">
      {element && element.popcornOptions && (
        <Tab
          values={element.popcornOptions}
          onChange={(field, options) => handleChange(field, options)}
          fields={fields}
          closeModal={handleClose}
        />
      )}
    </div>
  );
});

TextSettings.propTypes = {
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

export default TextSettings;
