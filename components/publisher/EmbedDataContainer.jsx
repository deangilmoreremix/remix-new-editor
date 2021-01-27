import React, { Fragment, useState } from 'react';

import PropTypes from '../../lib/PropTypes';
import { DEFAULT_IFRAME_SIZE } from '../../lib/constants/campaigns/constants';
import { styledIframeWithScript } from '../../lib/generators/iframe';

const EmbedDataContainer = ({
  url,
  thumbnail,
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
        </div>
        {playCheckbox
        && (
          <div className="embed-group mb-3">
            <label className="cell row mb-2" htmlFor="preload-check">
              <div className="col-md-4">Show Play Button</div>
              <div className="col-md-8">
                <div className="custom-checkbox">
                  <input
                    className="cell"
                    type="checkbox"
                    id="preload-check"
                    checked={needPlayButton}
                    onChange={() => setNeedPlayButton(!needPlayButton)}
                  />
                  <span className="label" />
                </div>
              </div>
            </label>
          </div>
        )}
        <textarea
          readOnly
          rows={4}
          value={stringGenerator(url, width, height, thumbnail, needPlayButton)}
          onClick={handleTextAreaClick}
        />
      </div>
    </Fragment>
  );
};

EmbedDataContainer.propTypes = {
  className: PropTypes.string,
  thumbnail: PropTypes.string,
  url: PropTypes.string.isRequired,
  resizable: PropTypes.bool,
  stringGenerator: PropTypes.func,
  playCheckbox: PropTypes.bool,
};

export default EmbedDataContainer;
