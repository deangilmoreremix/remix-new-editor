import * as React from 'react';
import { observer } from 'mobx-react';

import useUserStore from '../../hooks/useUserStore';

import PropTypes from '../../../lib/PropTypes';
import FieldBuilder from '../../form/FieldBuilder';
import mediaConstants from '../../../lib/constants/media';
import * as constant from '../../../lib/constants/popcorn';
import LottiePlayer from '../../../lib/lottie/LottiePlayer';
import DropButton from '../../media/DropButton';

const JsonButtonSettings = observer(({ element, update, fields }) => {
  const { isSuperAdmin } = useUserStore();

  const handleChange = (field) => {
    update(field);
  };

  return (
    <div className="json-button-form">
      {(element && element.popcornOptions) && isSuperAdmin && (
        <div>
          <DropButton
            accept={[mediaConstants.JSON_CONTENT_TYPE]}
            type={mediaConstants.JSON_CONTENT_TYPE}
            onUploaded={({ url: src }) => update({ src })}
            multiple={false}
            needSaveAsset={false}
          />
          {fields && Object.keys(fields).map(key => {
            const { label, type } = fields[key];
            return (
              <FieldBuilder
                onChange={handleChange}
                label={key === constant.LINK_URL ? constant.LABEL_CLICK_TO_PHONE : label}
                type={type}
                value={element.popcornOptions[key]}
                key={key}
                name={key}
                className="json-button-container"
              />
            );
          })}
        </div>
      )}
      {element && element.popcornOptions && element.popcornOptions.src && (
        <LottiePlayer
          url={element.popcornOptions.src}
          className="button-preview"
        />
      )}
    </div>
  );
});

JsonButtonSettings.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string,
    popcornOptions: PropTypes.shape({
      linkUrl: PropTypes.string,
      src: PropTypes.string,
    }),
  }),
  tab: PropTypes.string.isRequired,
  update: PropTypes.func.isRequired,
  fields: PropTypes.shape({}),
};

export default JsonButtonSettings;
