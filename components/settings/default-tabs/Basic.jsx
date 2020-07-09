import React, { useState } from 'react';
import lottie from 'lottie-web';

import mediaConstants from '../../../lib/constants/media';
import { POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import { loadUrl } from '../../../lib/requestCreator';

import PropTypes from '../../../lib/PropTypes';
import FieldBuilder from '../../form/FieldBuilder';
import DropButton from '../../media/DropButton';

const Basic = ({ options, update, fields, onChange, ...props }) => {
  const [isDisabled, setIsDisabled] = useState(false);

  const onUploaded = async ({ url, duration }) => {
    if (options.type === POPCORN_ELEMENT_TYPES.JSON_TRANSITION && duration) {
      return update({ url, end: options.start + duration });
    }
    update({ url });
  };

  const handleChange = async ({ url }) => {
    if (options.type === POPCORN_ELEMENT_TYPES.JSON_TRANSITION && url) {
      const animationData = await loadUrl(url);
      const animation = await lottie.loadAnimation({ animationData });
      return onChange({
        url,
        end: options.start + (animation.totalFrames / animation.animationData.fr),
      });
    }
    onChange({ url });
  };

  const startUpload = () => {
    setIsDisabled(true);
  };

  const endUpload = () => {
    setIsDisabled(false);
  };

  return (
    <div>
      {update && (
        <DropButton
          accept={[mediaConstants.JSON_CONTENT_TYPE]}
          type={mediaConstants.JSON_CONTENT_TYPE}
          onUploaded={onUploaded}
          startUpload={startUpload}
          endUpload={endUpload}
          multiple={false}
          needSaveAsset={false}
          getDuration={options.type === POPCORN_ELEMENT_TYPES.JSON_TRANSITION}
          isDisabled={isDisabled}
        />
      )}
      {fields && Object.keys(fields).map(key => {
        const { label, type, ...fieldProps } = fields[key];
        return (
          <FieldBuilder
            {...fieldProps}
            {...props}
            label={label}
            type={type}
            value={options[key]}
            key={key}
            name={key}
            disabled={isDisabled}
            onChange={handleChange}
          />
        );
      })}
    </div>
  );
};

Basic.propTypes = {
  options: PropTypes.shape({
    type: PropTypes.string,
    start: PropTypes.number,
  }),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.objectOf(
    PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string,
    }),
  ),
  update: PropTypes.func,
};

export default Basic;
