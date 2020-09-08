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
  const { isSuperAdmin, isfeatureEnabled } = useUserStore();

  const handleChange = (field) => {
    update(field);
  };

  return (
    <div className="json-button-form">
      {(element && element.popcornOptions) && isSuperAdmin && (
        <div>
          <DropButton
            accept={[mediaConstants.JSON_CONTENT_TYPE]}
            mediaType={mediaConstants.JSON_CONTENT_TYPE}
            onUploaded={({ url: src }) => update({ src })}
            multiple={false}
            needSaveAsset={false}
          />
          {fields && Object.keys(fields).map(key => {
            const { label, type, featureLabels } = fields[key];
            let newLabel = null;
            if (featureLabels) {
              const labelKey = Object.keys(featureLabels)
                .find(feature => isfeatureEnabled(feature));
              if (labelKey) {
                newLabel = featureLabels[labelKey];
              }
            }
            return (
              <FieldBuilder
                onChange={handleChange}
                label={newLabel || label}
                type={type}
                value={element.popcornOptions[key]}
                key={key}
                name={key}
                className="json-button-container"
                element={element.popcornOptions}
              />
            );
          })}
        </div>
      )}
      {element && element.popcornOptions && element.popcornOptions.src && (
        <>
          {!isSuperAdmin && (
            <div>
              {fields && Object.keys(fields).map(key => {
                const { label, type, featureLabels } = fields[key];
                let newLabel = null;
                if (featureLabels) {
                  const labelKey = Object.keys(featureLabels)
                    .find(feature => isfeatureEnabled(feature));
                  if (labelKey) {
                    newLabel = featureLabels[labelKey];
                  }
                }
                return (
                  key === constant.LINK_URL && (
                    <FieldBuilder
                      onChange={handleChange}
                      label={newLabel || label}
                      type={type}
                      value={element.popcornOptions[key]}
                      key={key}
                      name={key}
                      className="json-button-container"
                    />
                  ));
              })}
            </div>
          )}
          <LottiePlayer
            url={element.popcornOptions.src}
            className="button-preview"
          />
        </>
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
