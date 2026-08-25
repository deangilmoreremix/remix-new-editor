import * as React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC } from '../../../lib/constants/popcorn';
import Basic from './tabs/Basic';

const TabMap = {
  [BASIC]: Basic,
};

const Social = observer(({ tab = BASIC, element, update, fields }) => {
  const Tab = TabMap[tab];

  return (
    <div className="social-settings">
      <Tab
        values={element.popcornOptions}
        element={element}
        onChange={update}
        fields={fields}
      />
    </div>
  );
});

Social.propTypes = {
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

export default Social;
