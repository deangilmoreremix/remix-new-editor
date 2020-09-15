import React from 'react';

import PropTypes from '../../../../lib/PropTypes';
import FormCheckboxField from '../../../form/FormCheckboxField';

// todo update layout
const Is360 = React.memo(({ value, onChange, className, showHint }) => (
  <div className="is-360-wrapper">
    <FormCheckboxField
      label="360 video"
      onChange={onChange}
      value={value}
      floatClassName={className}
    />
    {showHint
      && (
        <div className="hint-360">
        For 360 videos, we recommend using only videos downloaded from your computer. You can use
          &nbsp;
          <a
            href="http://download.vidcloud.io/"
            className="library__block--title"
            target="_blank"
            rel="noopener noreferrer"
          >
          our downloader
          </a>
        </div>
      )}
  </div>
));

Is360.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.bool,
  showHint: PropTypes.bool,
  className: PropTypes.string,
};

export default Is360;
