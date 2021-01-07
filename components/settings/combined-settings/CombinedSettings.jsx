import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC, POPCORN_ELEMENT_TYPES, TEXT_TAB } from '../../../lib/constants/popcorn';
import Basic from './tabs/Basic';
import Text from './tabs/Text';

const CombinedSettings = observer((props) => {
  const { tab = BASIC, element, update, fields } = props;
  const combinedTextItems = [];
  let options = {};

  if (element?.popcornOptions?.items) {
    element.popcornOptions.items.forEach(combinedItem => {
      if (combinedItem.type === POPCORN_ELEMENT_TYPES.TEXT) {
        combinedTextItems.push(combinedItem);
      }
    });

    if (tab.includes(TEXT_TAB)) {
      const index = tab.split('').find(sign => Number.isInteger(+sign));
      options = combinedTextItems[index - 1];
    } else if (tab.includes(BASIC)) {
      options = element.popcornOptions;
    }
  }

  const TabMap = useMemo(() => {
    if (!element?.popcornOptions?.items) {
      return null;
    }

    const combinedTabs = {
      [BASIC]: Basic,
    };

    combinedTextItems.forEach((combinedItem, i) => {
      if (combinedTextItems.length < 2) {
        combinedTabs[TEXT_TAB] = Text;
      } else {
        combinedTabs[`${TEXT_TAB}${i + 1}`] = Text;
      }
    });

    return combinedTabs;
  }, [element?.popcornOptions?.items]);

  const Tab = TabMap[tab];

  return (
    <div className="combined-settings">
      {element && element.popcornOptions && (
        <Tab
          values={options}
          element={element}
          onChange={(field) => update(field)}
          fields={fields}
        />
      )}
    </div>
  );
});

CombinedSettings.propTypes = {
  tab: PropTypes.string,
  update: PropTypes.func.isRequired,
};

export default CombinedSettings;
