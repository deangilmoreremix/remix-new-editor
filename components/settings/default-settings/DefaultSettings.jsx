import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import { BASIC } from '../../../lib/constants/popcorn';
import Basic from '../default-tabs/Basic';
import { CUSTOM_ELEMENT_TABS } from '../../../lib/constants/settings';

const TabMap = {
  [BASIC]: Basic,
};

const DefaultSettings = observer(({ tab = BASIC, element, update, fields }) => {
  const Tab = useMemo(() => (CUSTOM_ELEMENT_TABS[element.type]
    ? CUSTOM_ELEMENT_TABS[element.type][tab]
    : TabMap[tab]), [element.type][tab]);

  const handleChange = (value = {}, options = {}) => {
    update({ ...value, ...options });
  };

  return (
    <div className={classnames(element && element.type ? element.type : null, 'json-animation-form')}>
      <Tab
        options={element.popcornOptions}
        element={element}
        onChange={handleChange}
        fields={fields}
      />
    </div>
  );
});

DefaultSettings.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.string.isRequired,
    popcornOptions: PropTypes.shape({
      url: PropTypes.string,
    }),
  }),
  tab: PropTypes.string.isRequired,
  update: PropTypes.func.isRequired,
  fields: PropTypes.shape({}),
};

export default DefaultSettings;
