import * as React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { BASIC, ADVANCED } from '../../../lib/constants/popcorn';
import LottieEditor from '../../common/LottieEditor';
import Basic from './tabs/Basic';
import Advanced from './tabs/Advanced';

const TabMap = {
  [BASIC]: Basic,
  [ADVANCED]: Advanced,
};

const JsonAnimation = observer(({ tab = BASIC, element, update, fields }) => {
  const Tab = TabMap[tab];
  const handleChange = (field) => {
    update(field);
  };

  const handleSetColors = (colors) => {
    update({ colors });
  };

  return (
    <div className="json-animation-form">
      {element && element.popcornOptions && (
        <Tab options={element.popcornOptions} onChange={handleChange} fields={fields} />
      )}
      {element && element.popcornOptions && element.popcornOptions.url && (
        <LottieEditor
          showControls
          file={element.popcornOptions.url}
          setColor={handleSetColors}
        />
      )}
    </div>
  );
});

JsonAnimation.propTypes = {
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

export default JsonAnimation;
