import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC } from '../../../lib/constants/popcorn';
import Basic from './tabs/Basic';

const TabMap = {
  [BASIC]: Basic,
};

const GoogleMapSettings = observer((props) => {
  const { tab = BASIC, element, fields, update, handleClose } = props;
  const Tab = TabMap[tab];

  const handleChange = (value, options = {}) => update({ ...value, ...options });

  return (
    <div className="map-settings">
      {element && element.popcornOptions && (
        <Tab
          values={element.popcornOptions}
          element={element}
          onChange={(field, options) => handleChange(field, options)}
          fields={fields}
          closeModal={handleClose}
        />
      )}
    </div>
  );
});

GoogleMapSettings.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    track: PropTypes.string,
  }).isRequired,
  tab: PropTypes.string,
  update: PropTypes.func.isRequired,
};

export default GoogleMapSettings;
