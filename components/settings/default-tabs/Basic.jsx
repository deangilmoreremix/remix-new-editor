import React, { useState } from 'react';

import mediaConstants from '../../../lib/constants/media';
import { POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';

import PropTypes from '../../../lib/PropTypes';
import FieldBuilder from '../../form/FieldBuilder';
import DropButton from '../../media/DropButton';

const Basic = ({ options, update, fields, ...props }) => {
  const [isDisabled, setIsDisabled] = useState(false);

  const onUploaded = ({ url, duration }) => {
    if (options.type === POPCORN_ELEMENT_TYPES.JSON_TRANSITION && duration) {
      return update({ url, end: options.start + duration });
    }
    update({ url });
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
          getDuration
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
