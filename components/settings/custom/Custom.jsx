import * as React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC } from '../../../lib/constants/popcorn';
import Basic from '../default-tabs/Basic';

const Custom = observer(({ tab = BASIC, element, update, fields }) => {
  const TabMap = {
    [tab]: Basic,
  };
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

Custom.propTypes = {
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

export default Custom;
