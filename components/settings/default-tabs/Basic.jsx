import React, { useState } from 'react';
import lottie from 'lottie-web';
import classnames from 'classnames';

import { POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import { loadUrl } from '../../../lib/requestCreator';

import PropTypes from '../../../lib/PropTypes';
import FieldBuilder from '../../form/FieldBuilder';

const Basic = ({ options, update, fields, element, containerClass, ...props }) => {
  const [isDisabled, setIsDisabled] = useState(false);

  const onUploaded = async ({ url }) => {
    if (options.type === POPCORN_ELEMENT_TYPES.JSON_TRANSITION) {
      const animationData = await loadUrl(url);
      const animation = await lottie.loadAnimation({ animationData });
      const duration = animation.totalFrames / animation.animationData.fr;
      return update({ url, end: options.start + duration });
    }
    update({ url });
  };

  const processUpload = (processFileUpload) => {
    setIsDisabled(processFileUpload);
  };

  // ToDo move dropzone to manifest.
  return (
    <div className={classnames(`inputs-${options.type}-wrapper`, containerClass)}>
      {fields && Object.keys(fields).map(key => {
        const { label, type, ...fieldProps } = fields[key];
        return (
          <FieldBuilder
            {...fieldProps}
            {...props}
            label={label}
            type={type}
            value={options[key] || fields[key].default}
            key={key}
            name={key}
            disabled={isDisabled}
            onUploaded={onUploaded}
            startUpload={() => processUpload(true)}
            endUpload={() => processUpload(false)}
            isDisabled={isDisabled}
            element={element}
          />
        );
      })}
    </div>
  );
};

Basic.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    popcornOptions: PropTypes.shape().isRequired,
    track: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  }).isRequired,
  options: PropTypes.shape({
    type: PropTypes.string,
    start: PropTypes.number,
    end: PropTypes.number,
    duration: PropTypes.number,
    loop: PropTypes.number,
  }),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.objectOf(
    PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string,
      default: PropTypes.any,
    }),
  ),
  update: PropTypes.func,
  containerClass: PropTypes.string,
};

export default Basic;
