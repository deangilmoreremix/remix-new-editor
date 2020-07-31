import * as React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC } from '../../../lib/constants/popcorn';
import Basic from '../default-tabs/Basic';

const TabMap = {
  [BASIC]: Basic,
};

const DefaultSettings = observer(({ tab = BASIC, element, update, fields }) => {
  const Tab = TabMap[tab];
  const handleChange = (field) => {
    update(field);
  };

  return (
    <div className="json-animation-form">
      <Tab options={element.popcornOptions} onChange={handleChange} fields={fields} />
    </div>
  );
});

DefaultSettings.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string,
    popcornOptions: PropTypes.shape({
      url: PropTypes.string,
    }),
  }),
  tab: PropTypes.string.isRequired,
  update: PropTypes.func.isRequired,
  fields: PropTypes.shape({}),
};

export default DefaultSettings;
