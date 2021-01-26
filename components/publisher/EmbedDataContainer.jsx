import React, { Fragment, useState } from 'react';

import PropTypes from '../../lib/PropTypes';
import { DEFAULT_IFRAME_SIZE } from '../../lib/constants/campaigns/constants';
import { styledIframeWithScript } from '../../lib/generators/iframe';
import FormCheckboxField from '../form/FormCheckboxField';

const EmbedDataContainer = ({
  url,
  className,
  resizable = false,
  playCheckbox,
  stringGenerator = styledIframeWithScript,
}) => {
  const [size, setSize] = useState(DEFAULT_IFRAME_SIZE);
  const [needPlayButton, setNeedPlayButton] = useState(playCheckbox);

  const handleInputChange = ({ target: { name, value } }) => setSize({ ...size, [name]: value });

  const handleTextAreaClick = ({ target }) => { target.select(); };

  const { width, height } = size;

  return (
    <Fragment>
      <div className={className}>
        <div className={resizable ? 'resizer row mb-2' : 'hidden'}>
          <div className="col-md-4">Size</div>
          <div className="col-md-8 d-flex justify-content-between">
            <input
              className="dimension-input"
              type="text"
              name="height"
              value={height}
              onChange={handleInputChange}
            />
            <span className="mx-1">X</span>
            <input
              className="dimension-input"
              type="text"
              name="width"
              value={width}
              onChange={handleInputChange}
            />
          </div>
          {playCheckbox
          && (
          <FormCheckboxField
            label="Show Play Button"
            value={needPlayButton}
            onChange={setNeedPlayButton}
          />
          )}
        </div>
        <textarea
          readOnly
          rows={4}
          value={stringGenerator(url, width, height, null, needPlayButton)}
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
  playCheckbox: PropTypes.bool,
};

export default EmbedDataContainer;
