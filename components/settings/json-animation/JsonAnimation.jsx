import * as React from 'react';
import { observer } from 'mobx-react';

import lottie from 'lottie-web';
import useUserStore from '../../hooks/useUserStore';

import PropTypes from '../../../lib/PropTypes';
import { BASIC, ADVANCED, POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import LottieEditor from '../../common/LottieEditor';
import Basic from '../default-tabs/Basic';
import Advanced from './tabs/Advanced';
import { loadUrl } from '../../../lib/requestCreator';

const TabMap = {
  [BASIC]: Basic,
  [ADVANCED]: Advanced,
};

const JsonAnimation = observer(({ tab = BASIC, element, update, fields }) => {
  const { isSuperAdmin } = useUserStore();

  const Tab = TabMap[tab];

  const handleChange = async (field) => {
    const { url } = field;
    if (element && element.popcornOptions.type === POPCORN_ELEMENT_TYPES.JSON_TRANSITION && url) {
      const animationData = await loadUrl(url);
      const animation = await lottie.loadAnimation({ animationData });
      return update({
        url,
        end: element.popcornOptions.start + (animation.totalFrames / animation.animationData.fr),
      });
    }
    update(field);
  };

  const handleSetColors = (colors) => {
    update({ colors });
  };

  return (
    <div className="json-animation-form">
      {(element && element.popcornOptions) && isSuperAdmin && (
        <Tab
          options={element.popcornOptions}
          onChange={handleChange}
          fields={fields}
          update={update}
        />
      )}
      {element && element.popcornOptions && element.popcornOptions.url && (
        <LottieEditor
          showControls
          file={element.popcornOptions.url}
          setColor={handleSetColors}
          value={element.popcornOptions.colors}
          className="json-animation-preview"
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
