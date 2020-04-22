import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC } from '../../../lib/constants/settings/image';
import Basic from './tabs/Basic';

const TabMap = {
  [BASIC]: Basic,
};

const ImageSettings = observer((props) => {
  const { tab = BASIC, element, update, fields, handleClose } = props;
  const Tab = TabMap[tab];

  return (
    <div className="image-settings-form">
      {element && element.popcornOptions && (
        <Tab
          values={element.popcornOptions}
          onChange={(field) => update(field)}
          fields={fields}
          handleClose={handleClose}
        />
      )}
    </div>
  );
});

ImageSettings.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    track: PropTypes.string,
    popcornOptions: PropTypes.shape({
      url: PropTypes.string.isRequired,
    }).isRequired,
  }),
  tab: PropTypes.string,
  update: PropTypes.func.isRequired,
};

export default ImageSettings;
