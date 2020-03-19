import React, { Fragment, useState } from 'react';

import PropTypes from '../../lib/PropTypes';
import { DEFAULT_IFRAME_SIZE } from '../../lib/constants/campaigns/constants';
import { iframeGenerator } from '../../lib/generators/iframe';

const EmbedDataContainer = ({
  url,
  className,
  resizable = false,
  stringGenerator = iframeGenerator,
}) => {
  const [size, setSize] = useState(DEFAULT_IFRAME_SIZE);

  const handleInputChange = ({ target: { name, value } }) => setSize({ ...size, [name]: value });

  const handleTextAreaClick = ({ target }) => { target.select(); };

  const { width, height } = size;

  return (
    <Fragment>
      <div className={className}>
        <div className={resizable ? 'resizer' : 'hidden'}>
          <span>Size</span>
          <span style={{ float: 'right' }}>
            <input
              className="dimension-input"
              type="text"
              name="height"
              value={height}
              onChange={handleInputChange}
            />
            <span>X</span>
            <input
              className="dimension-input"
              type="text"
              name="width"
              value={width}
              onChange={handleInputChange}
            />
          </span>
        </div>
        <textarea
          readOnly
          rows={4}
          value={stringGenerator(url, width, height)}
          onClick={handleTextAreaClick}
        />
      </div>
    </Fragment>
  );
};

EmbedDataContainer.propTypes = {
  className: PropTypes.string,
  url: PropTypes.string.isRequired,
  resizable: PropTypes.bool,
  stringGenerator: PropTypes.func,
};

export default EmbedDataContainer;
