import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC, ADVANCED } from '../../../lib/constants/settings/vrtext-element';
import Basic from './tabs/Basic';
import Advanced from './tabs/Advanced';

const TabMap = {
  [BASIC]: Basic,
  [ADVANCED]: Advanced,
};

const TextElement = observer(({ tab = BASIC, element, update, fields }) => {
  const Tab = TabMap[tab];

  const isKeyPresent = (objKey, parentObjKey) => {
    const { popcornOptions } = element;
    if (parentObjKey) {
      if (popcornOptions.hasOwnProperty(parentObjKey)
        && popcornOptions[parentObjKey].hasOwnProperty(objKey)) {
        return popcornOptions[parentObjKey][objKey];
      } else {
        return fields[parentObjKey].default[objKey];
      }
    }
    return popcornOptions.hasOwnProperty(objKey) ? popcornOptions[objKey] : fields[objKey].default;
  };

  return (
    <div className="vrtext-presets-form">
      {element && element.popcornOptions && (
        <Tab
          values={element.popcornOptions}
          onChange={(field) => update(field)}
          fields={fields}
          checkKeyInObj={isKeyPresent}
        />
      )}
    </div>
  );
});

TextElement.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    track: PropTypes.number.isRequired,
    popcornOptions: PropTypes.shape({
      url: PropTypes.string,
    }).isRequired,
  }).isRequired,
  tab: PropTypes.string,
  update: PropTypes.func.isRequired,
};

export default TextElement;
